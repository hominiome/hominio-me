export type GetAudioContextOptions = AudioContextOptions & {
  id?: string;
};

const map: Map<string, AudioContext> = new Map();

export const audioContext: (
  options?: GetAudioContextOptions
) => Promise<AudioContext> = async (options?: GetAudioContextOptions) => {
  try {
    if (options?.id && map.has(options.id)) {
      const ctx = map.get(options.id);
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        return ctx;
      }
    }

    const ctx = new AudioContext(options);

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (options?.id) {
      map.set(options.id, ctx);
    }
    return ctx;
  } catch (error) {
    console.error('[audio/utils] Error in audioContext function:', error);
    throw error;
  }
};

export function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

