<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    HumeClient,
    getBrowserSupportedMimeType,
    getAudioStream,
    ensureSingleValidAudioTrack,
    convertBlobToBase64,
    EVIWebAudioPlayer
  } from 'hume';
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';

  // Hume configuration from environment variable
  const HUME_CONFIG_ID = env.PUBLIC_HUME_CONFIG_ID || '';

  // State
  let isRecording = $state(false);
  let isConnected = $state(false);
  let isExpanded = $state(false);
  let lastResponse = $state('');

  // Hume instances
  let socket: any = null;
  let audioStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioPlayer: EVIWebAudioPlayer | null = null;

  // Client-side tool call handler
  async function handleToolCall(message: any) {
    console.log('🔧 Tool call:', message.name, message.parameters);

    try {
      const params =
        typeof message.parameters === 'string'
          ? JSON.parse(message.parameters)
          : message.parameters;

      // Handle getName tool - returns "Hominio"
      if (message.name === 'getName' || message.name.toLowerCase() === 'getname') {
        sendToolResponse(message.toolCallId, 'Hominio');
        console.log('✅ getName tool executed: Hominio');
      } else {
        // Unknown tool
        sendToolError(message.toolCallId, `Tool "${message.name}" not supported`);
      }
    } catch (err: any) {
      console.error('❌ Tool call failed:', err);
      sendToolError(message.toolCallId, err.message || 'Tool execution error');
    }
  }

  // Helper to send tool success response
  function sendToolResponse(toolCallId: string, content: string) {
    // @ts-ignore - sendJson exists but not in types
    socket?.sendJson({
      type: 'tool_response',
      toolCallId,
      content
    });
  }

  // Helper to send tool error
  function sendToolError(toolCallId: string, errorMessage: string) {
    // @ts-ignore - sendJson exists but not in types
    socket?.sendJson({
      type: 'tool_error',
      toolCallId,
      error: errorMessage,
      code: 'tool_error',
      level: 'warn',
      content: errorMessage
    });
  }

  async function startCall() {
    if (!browser) return;
    
    try {
      isExpanded = true;
      lastResponse = '';

      console.log('🎙️ Starting Hume voice conversation...');

      if (!HUME_CONFIG_ID) {
        console.error('❌ HUME_CONFIG_ID not configured');
        lastResponse = 'Error: Voice configuration not set up. Please configure HUME_CONFIG_ID.';
        return;
      }

      // Get access token from server
      const accessTokenResponse = await fetch('/alpha/api/hume/access-token');
      if (!accessTokenResponse.ok) {
        const errorData = await accessTokenResponse.json();
        throw new Error(errorData.error || 'Failed to get access token');
      }
      
      const { accessToken } = await accessTokenResponse.json();
      console.log('✅ Access token received');

      // Initialize Hume client
      console.log('🔄 Initializing Hume client...');
      const client = new HumeClient({ accessToken });
      console.log('✅ Hume client initialized');

      // Connect to EVI WebSocket
      console.log('🔄 Connecting to Hume EVI WebSocket...');
      socket = await client.empathicVoice.chat.connect({
        configId: HUME_CONFIG_ID
      });
      console.log('✅ Socket created, waiting for open event...');

      // Set up event listeners
      socket.on('open', async () => {
        console.log('✅ Hume connection opened');
        isConnected = true;

        // Initialize audio player for smooth playback
        audioPlayer = new EVIWebAudioPlayer();
        await audioPlayer.init();
        console.log('🔊 Audio player initialized');
      });

      socket.on('message', async (message: any) => {
        // Handle audio output - use EVIWebAudioPlayer for smooth playback
        if (message.type === 'audio_output' && audioPlayer) {
          await audioPlayer.enqueue(message);
        }

        // Handle assistant messages
        if (message.type === 'assistant_message' && message.message?.content) {
          lastResponse = message.message.content;
          console.log('🤖 Assistant:', message.message.content);
        }

        // Handle user messages
        if (message.type === 'user_message' && message.message?.content) {
          console.log('🎤 User:', message.message.content);
        }

        // Handle tool calls
        if (message.type === 'tool_call') {
          console.log('🔧 Tool call received:', message.name);
          await handleToolCall(message);
        }
      });

      socket.on('error', (error: Error) => {
        console.error('❌ Hume error:', error);
        cleanupCall();
      });

      socket.on('close', () => {
        console.log('🔌 Hume connection closed');
        cleanupCall();
      });

      // Wait for connection to open
      await socket.tillSocketOpen();

      // Start audio capture
      await startAudioCapture();

      console.log('🎙️ Hume voice call started');
    } catch (err: any) {
      console.error('Failed to start Hume voice:', err);
      lastResponse = `Error: ${err.message || 'Failed to start voice call'}`;
      isExpanded = false;
      isConnected = false;
    }
  }

  async function startAudioCapture() {
    if (!browser) return;
    
    try {
      // Get audio stream
      audioStream = await getAudioStream();
      ensureSingleValidAudioTrack(audioStream);

      // Determine supported MIME type
      const mimeTypeResult = getBrowserSupportedMimeType();
      const mimeType = mimeTypeResult.success ? mimeTypeResult.mimeType : 'audio/webm';

      console.log('🎤 Using MIME type:', mimeType);

      // Create media recorder
      mediaRecorder = new MediaRecorder(audioStream, { mimeType });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socket && isConnected) {
          try {
            const encodedAudioData = await convertBlobToBase64(event.data);
            socket.sendAudioInput({ data: encodedAudioData });
          } catch (err) {
            console.error('Error sending audio:', err);
          }
        }
      };

      // Send audio chunks every 100ms
      mediaRecorder.start(100);
      isRecording = true;
      console.log('🎤 Recording started');
    } catch (err) {
      console.error('Failed to start audio capture:', err);
      isRecording = false;
    }
  }

  /**
   * Clean up resources and close modal
   * Called when connection closes or errors
   */
  function cleanupCall() {
    // Stop media recorder
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try {
        mediaRecorder.stop();
      } catch (err) {
        console.error('Error stopping media recorder:', err);
      }
    }

    // Stop audio stream tracks
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
    }

    // Stop audio player
    if (audioPlayer) {
      try {
        audioPlayer.stop();
      } catch (err) {
        console.error('Error stopping audio player:', err);
      }
      audioPlayer = null;
    }

    // Reset state
    isRecording = false;
    isConnected = false;
    isExpanded = false;
    lastResponse = '';

    console.log('🧹 Call cleaned up');
  }

  async function stopCall() {
    try {
      // Close socket connection (will trigger 'close' event which calls cleanupCall)
      if (socket) {
        socket.close();
      } else {
        // No socket, clean up directly
        cleanupCall();
      }
      console.log('⏹️ Hume voice call stopped by user');
    } catch (err) {
      console.error('Failed to stop Hume voice:', err);
      // Ensure cleanup even on error
      cleanupCall();
    }
  }

  function toggleExpand() {
    if (isRecording) {
      isExpanded = !isExpanded;
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    if (socket || isRecording || isConnected) {
      stopCall();
    }
  });
</script>

<div class="voice-pill-container">
  {#if isExpanded}
    <!-- Expanded Voice Interface -->
    <div class="voice-compact">
      <div class="transcript-area">
        {#if lastResponse}
          <p>{lastResponse}</p>
        {:else}
          <p class="placeholder">Speak now...</p>
        {/if}
      </div>

      {#if isRecording}
        <button class="close-btn" onclick={stopCall} aria-label="End call">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
            />
          </svg>
        </button>
      {/if}
    </div>
  {:else if !isRecording}
    <!-- Collapsed - Start Button -->
    <button class="voice-pill start" onclick={startCall}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"
        />
      </svg>
      <span>Start Voice Call</span>
    </button>
  {:else}
    <!-- Collapsed - Active Indicator -->
    <button class="voice-pill active" onclick={toggleExpand}>
      <div class="pulse-indicator"></div>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"
        />
      </svg>
      <span>Listening...</span>
    </button>
  {/if}
</div>

<style>
  .voice-pill-container {
    position: fixed;
    bottom: 5.5rem; /* Above navbar (which is ~4rem) + some spacing */
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .voice-pill {
    background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-secondary-500) 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 50px;
    cursor: pointer;
    font-size: 1.125rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    white-space: nowrap;
  }


  .voice-pill.active {
    background: linear-gradient(135deg, var(--color-secondary-500) 0%, var(--color-accent-500) 100%);
    animation: glow 2s ease-in-out infinite;
  }

  @keyframes glow {
    0%,
    100% {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }
    50% {
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    }
  }

  .pulse-indicator {
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }

  .voice-compact {
    position: relative;
    background: var(--color-primary-500);
    color: white;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
    overflow: hidden;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .transcript-area {
    flex: 1;
    padding: 1.5rem 1.5rem 4rem 1.5rem;
    overflow-y: auto;
    max-height: 300px;
  }

  .transcript-area p {
    margin: 0;
    line-height: 1.5;
    font-size: 1rem;
    color: white;
  }

  .transcript-area p.placeholder {
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
  }

  .close-btn {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-accent-500);
    border: none;
    color: white;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .close-btn:hover {
    transform: translateX(-50%) scale(1.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .close-btn:active {
    transform: translateX(-50%) scale(0.95);
  }

  @media (max-width: 640px) {
    .voice-pill-container {
      bottom: 5rem;
    }

    .voice-compact {
      max-width: calc(100vw - 4rem);
    }

    .voice-pill {
      font-size: 1rem;
      padding: 0.875rem 1.5rem;
    }
  }
</style>

