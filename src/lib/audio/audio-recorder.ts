import { audioContext, arrayBufferToBase64 } from "./utils";
import AudioRecordingWorklet from "./worklets/audio-processing";
import VolMeterWorklet from "./worklets/vol-meter";
import { createWorkletFromSrc } from "./audioworklet-registry";
import EventEmitter from "eventemitter3";

export class AudioRecorder extends EventEmitter {
    stream: MediaStream | undefined;
    audioContext: AudioContext | undefined;
    source: MediaStreamAudioSourceNode | undefined;
    recording: boolean = false;
    recordingWorklet: AudioWorkletNode | undefined;
    vuWorklet: AudioWorkletNode | undefined;

    private starting: Promise<void> | null = null;

    constructor(public sampleRate = 16000) {
        super();
    }

    async start() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Could not request user media");
        }

        this.starting = new Promise((resolve, reject) => {
            (async () => {
                try {
                    // Request microphone with preferred constraints
                    // IMPORTANT: Enable echoCancellation to prevent AI from hearing its own voice output
                    // This prevents feedback loops where AI responds to its own speech
                    const preferredConstraints: MediaStreamConstraints = {
                        audio: {
                            channelCount: 1,
                            sampleRate: this.sampleRate,
                            echoCancellation: true, // Enable to prevent AI hearing its own voice
                            noiseSuppression: true, // Enable for better audio quality
                            autoGainControl: true, // Enable for consistent volume
                        },
                    };

                    try {
                        this.stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
                    } catch (err) {
                        console.warn("⚠️ Preferred audio constraints failed, falling back to basic audio:", (err as Error).message);
                        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    }

                    this.audioContext = await audioContext({
                        id: "voice-call-recorder",
                        sampleRate: this.sampleRate
                    });
                    this.source = this.audioContext.createMediaStreamSource(this.stream);

                    const workletName = "audio-recorder-worklet";
                    const src = createWorkletFromSrc(workletName, AudioRecordingWorklet, this.audioContext);

                    // Try to add module, but catch error if already registered (e.g., during hot reload)
                    try {
                        await this.audioContext.audioWorklet.addModule(src);
                    } catch (err: any) {
                        // If worklet is already registered, that's okay - we can still use it
                        if (err.message?.includes("already registered") || err.name === "NotSupportedError") {
                            console.log("⚠️ AudioWorklet already registered (likely hot reload), continuing...");
                        } else {
                            throw err; // Re-throw if it's a different error
                        }
                    }
                    this.recordingWorklet = new AudioWorkletNode(
                        this.audioContext,
                        workletName,
                    );

                    this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
                        const arrayBuffer = ev.data.data?.int16arrayBuffer;

                        if (arrayBuffer && arrayBuffer.byteLength > 0) {
                            const base64String = arrayBufferToBase64(arrayBuffer);
                            this.emit("data", base64String);
                        } else {
                            // Log if we're getting empty or invalid data
                            console.warn("⚠️ AudioRecorder received empty or invalid data:", {
                                hasData: !!ev.data.data,
                                hasInt16Buffer: !!ev.data.data?.int16arrayBuffer,
                                bufferLength: ev.data.data?.int16arrayBuffer?.byteLength || 0,
                            });
                        }
                    };
                    this.source.connect(this.recordingWorklet);

                    // vu meter worklet - keeps stream active and provides volume feedback
                    const vuWorkletName = "vu-meter";
                    try {
                        await this.audioContext.audioWorklet.addModule(
                            createWorkletFromSrc(vuWorkletName, VolMeterWorklet, this.audioContext),
                        );
                    } catch (err: any) {
                        // If worklet is already registered, that's okay - we can still use it
                        if (err.message?.includes("already registered") || err.name === "NotSupportedError") {
                            console.log("⚠️ VU Meter Worklet already registered (likely hot reload), continuing...");
                        } else {
                            throw err; // Re-throw if it's a different error
                        }
                    }
                    this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
                    this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
                        this.emit("volume", ev.data.volume);
                    };

                    this.source.connect(this.vuWorklet);
                    this.recording = true;
                    console.log("✅ AudioRecorder started with AudioWorklet");
                    resolve();
                } catch (error) {
                    console.error('[AudioRecorder] Error during start:', error);
                    reject(error);
                } finally {
                    this.starting = null;
                }
            })();
        });
        return this.starting;
    }

    stop() {
        const handleStop = () => {
            this.source?.disconnect();
            this.recordingWorklet?.disconnect();
            this.vuWorklet?.disconnect();
            this.stream?.getTracks().forEach((track) => {
                track.stop();
            });
            this.stream = undefined;
            this.recordingWorklet = undefined;
            this.vuWorklet = undefined;
            this.recording = false;
            this.emit('stopped');
        };

        if (this.starting) {
            this.starting.then(handleStop).catch(err => {
                console.error('[AudioRecorder] Error in chained stop after starting failed:', err);
                handleStop();
            });
            return;
        }
        handleStop();
    }
}

