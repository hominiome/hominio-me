import { writable } from 'svelte/store';

export interface VoiceCallState {
  isRecording: boolean;
  isConnected: boolean;
  isExpanded: boolean;
  lastResponse: string;
}

const initialState: VoiceCallState = {
  isRecording: false,
  isConnected: false,
  isExpanded: false,
  lastResponse: '',
};

export const voiceCallState = writable<VoiceCallState>(initialState);

export function updateVoiceCallState(updates: Partial<VoiceCallState>) {
  voiceCallState.update((state) => ({ ...state, ...updates }));
}

export function resetVoiceCallState() {
  voiceCallState.set(initialState);
}

