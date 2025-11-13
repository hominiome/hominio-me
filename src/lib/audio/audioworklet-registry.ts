export type WorkletGraph = {
  node?: AudioWorkletNode;
  handlers: Array<(this: MessagePort, ev: MessageEvent) => unknown>;
};

export const registeredWorklets: Map<
  AudioContext,
  Record<string, WorkletGraph>
> = new Map();

// Track which worklets have been registered per AudioContext to prevent duplicate registration
const registeredWorkletNames = new WeakMap<AudioContext, Set<string>>();

export const createWorkletFromSrc = (
  workletName: string,
  workletSrc: string,
  audioContext: AudioContext,
) => {
  // Check if this worklet is already registered for this AudioContext
  if (!registeredWorkletNames.has(audioContext)) {
    registeredWorkletNames.set(audioContext, new Set());
  }
  const registered = registeredWorkletNames.get(audioContext)!;
  
  if (registered.has(workletName)) {
    // Worklet already registered - return a dummy URL (won't be used)
    // The AudioWorkletNode will use the already-registered processor
    return URL.createObjectURL(new Blob([""], { type: "application/javascript" }));
  }
  
  // Mark as registered before creating the blob
  registered.add(workletName);
  
  const script = new Blob(
    [`registerProcessor("${workletName}", ${workletSrc})`],
    {
      type: "application/javascript",
    },
  );

  return URL.createObjectURL(script);
};

