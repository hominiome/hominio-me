<script lang="ts">
  import { onDestroy } from "svelte";
  import { HumeClient } from "hume";
  import { browser } from "$app/environment";
  import { env } from "$env/dynamic/public";
  import { executeAction } from "$lib/voice/core-tools";
  import { addActivity } from "$lib/stores/activity-stream";
  import {
    updateVoiceCallState,
    resetVoiceCallState,
  } from "$lib/stores/voice-call";
  import ComponentRenderer from "$lib/components/dynamic/ComponentRenderer.svelte";
  import { AudioRecorder } from "$lib/audio/audio-recorder";
  import { AudioStreamer } from "$lib/audio/audio-streamer";
  import { audioContext } from "$lib/audio/utils";

  // Hume configuration from environment variable (runtime via $env/dynamic/public)
  const HUME_CONFIG_ID = env.PUBLIC_HUME_CONFIG_ID || "";

  // State - using $state for reactivity
  let isRecording = $state(false);
  let isConnected = $state(false);
  let isConnecting = $state(false); // Track connecting state (permission + socket)
  let isWaitingForPermission = $state(false); // Track permission request state
  let lastResponse = $state("");
  let actionMessage = $state<string | null>(null); // For action tool calls (create/edit/delete)
  let orderConfirmationUI = $state<any>(null); // For confirm_order UI display in mini-modal
  let cartUI = $state<any>(null); // For cart UI display in mini-modal (add_to_cart, get_cart)
  let timeSlotSelectionUI = $state<any>(null); // For time slot selection UI display in mini-modal
  let actionMessageTimeout: ReturnType<typeof setTimeout> | null = null; // Track timeout to cancel if new action comes

  // Sync state to store for reactive access from parent
  $effect(() => {
    updateVoiceCallState({
      isRecording,
      isConnected,
      isConnecting,
      isWaitingForPermission,
      lastResponse,
    });
  });

  // --- Persistent Audio Resources ---
  let globalMediaStream: MediaStream | null = null;
  let keepAliveContext: AudioContext | null = null;
  let keepAliveSource: MediaStreamAudioSourceNode | null = null;
  // ------------------------------------

  // Helper to determine if action is a view tool (shows UI) or action tool (shows compact message)
  function isViewTool(action: string): boolean {
    return (
      action === "list_menu" ||
      action === "list_wellness" ||
      action === "list_taxi" ||
      action === "list_room_service"
    );
  }

  function isCartTool(action: string): boolean {
    return action === "add_to_cart" || action === "get_cart";
  }

  function isTimeSlotTool(action: string): boolean {
    return action === "select_time_slot";
  }

  // Helper to format action message for mini-modal display
  function formatActionMessage(action: string, result: any): string {
    // No action messages needed for current actions (cart/order show UI)
    return null;
  }

  // iOS PWA audio playback queue handler (HTMLAudioElement fallback)
  // Based on Hume docs: Audio chunks should be queued and played sequentially
  // https://dev.hume.ai/docs/speech-to-speech-evi/guides/audio
  let currentIOSPWAAudio: HTMLAudioElement | null = null;
  
  async function playIOSPWAAudioQueue() {
    if (iosPWAAudioPlaying || iosPWAAudioQueue.length === 0) {
      return;
    }
    
    iosPWAAudioPlaying = true;
    
    while (iosPWAAudioQueue.length > 0) {
      // Check if we should stop (e.g., user interruption)
      if (!iosPWAAudioPlaying) {
        break;
      }
      
      const blob = iosPWAAudioQueue.shift();
      if (!blob) break;
      
      try {
        const audioUrl = URL.createObjectURL(blob);
        currentIOSPWAAudio = new Audio(audioUrl);
        
        // CRITICAL iOS PWA: Ensure audio is unlocked before playing
        // If not unlocked yet, try to unlock now (may fail, but worth trying)
        if (!iosPWAAudioUnlocked) {
          console.log("⚠️ iOS PWA: Audio not unlocked yet, attempting unlock...");
          try {
            const unlockAudio = new Audio();
            unlockAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
            unlockAudio.volume = 0;
            await unlockAudio.play();
            iosPWAAudioUnlocked = true;
            console.log("✅ iOS PWA: Audio unlocked on-demand");
          } catch (unlockErr: any) {
            console.warn("⚠️ iOS PWA: Failed to unlock audio on-demand:", unlockErr);
            // Continue anyway - might work if user interacts
          }
        }
        
        // Wait for this chunk to finish before playing next
        await new Promise<void>((resolve) => {
          const handleEnded = () => {
            URL.revokeObjectURL(audioUrl);
            currentIOSPWAAudio = null;
            resolve();
          };
          
          const handleError = (err: any) => {
            URL.revokeObjectURL(audioUrl);
            currentIOSPWAAudio = null;
            console.error("❌ Error playing iOS PWA audio chunk:", err);
            resolve(); // Continue with next chunk even on error
          };
          
          currentIOSPWAAudio.addEventListener('ended', handleEnded, { once: true });
          currentIOSPWAAudio.addEventListener('error', handleError, { once: true });
          
          // Try to play - if it fails due to not being in user gesture, log it
          currentIOSPWAAudio.play().catch((err: any) => {
            URL.revokeObjectURL(audioUrl);
            currentIOSPWAAudio = null;
            if (err.name === 'NotAllowedError') {
              console.error("❌ iOS PWA: Audio playback blocked - not in user gesture context. Audio unlock may have failed.");
            } else {
              console.error("❌ Error starting iOS PWA audio playback:", err);
            }
            resolve(); // Continue with next chunk even on error
          });
        });
      } catch (err: any) {
        console.error("❌ Error processing iOS PWA audio chunk:", err);
        currentIOSPWAAudio = null;
      }
    }
    
    iosPWAAudioPlaying = false;
    currentIOSPWAAudio = null;
    if (iosPWAAudioQueue.length === 0) {
      console.log("✅ iOS PWA audio queue finished");
    }
  }
  
  function stopIOSPWAAudio() {
    iosPWAAudioPlaying = false;
    iosPWAAudioQueue = [];
    if (currentIOSPWAAudio) {
      try {
        currentIOSPWAAudio.pause();
        currentIOSPWAAudio.currentTime = 0;
      } catch (err) {
        console.error("Error stopping iOS PWA audio:", err);
      }
      currentIOSPWAAudio = null;
    }
    // Reset unlock flag on stop (will re-unlock on next call start)
    iosPWAAudioUnlocked = false;
    console.log("🛑 iOS PWA audio stopped (user interruption)");
  }

  // Expose functions via component API
  export { startCall, stopCall };

  // Hume instances
  let socket: any = null;
  let audioRecorder: AudioRecorder | null = null;
  let audioStreamer: AudioStreamer | null = null;
  let audioChunkQueue: string[] = []; // Queue for base64 audio chunks until socket is ready
  let humeReady: boolean = false; // Track if Hume has sent a ready/setup_complete message
  
  // iOS PWA audio playback queue (HTMLAudioElement fallback)
  let iosPWAAudioQueue: Blob[] = [];
  let iosPWAAudioPlaying: boolean = false;
  let iosPWAAudioUnlocked: boolean = false; // Track if audio context is unlocked

  // Client-side tool call handler
  async function handleToolCall(message: any) {
    console.log("🔧 Tool call:", message.name, message.parameters);

    try {
      const params =
        typeof message.parameters === "string"
          ? JSON.parse(message.parameters)
          : message.parameters;

      // Handle getName tool - returns "Hominio"
      if (
        message.name === "getName" ||
        message.name.toLowerCase() === "getname"
      ) {
        sendToolResponse(message.toolCallId, "Hominio");
        console.log("✅ getName tool executed: Hominio");
        return;
      }
      // Handle execute_action - universal tool for executing any action
      else if (
        message.name === "execute_action" ||
        message.name === "executeAction"
      ) {
        // Hume's LLM extracts action and params from user request
        const { action, params: actionParams = {} } = params;

        if (!action) {
          sendToolError(
            message.toolCallId,
            "execute_action requires 'action' parameter"
          );
          return;
        }

        console.log(`🔄 Executing action: ${action}`, actionParams);

        try {
          // Execute the action - Hume's LLM has already extracted the parameters
          const result = await executeAction(action, actionParams);

          // Format response for Hume
          let responseText = "";
          if (result.result) {
            if (typeof result.result === "object") {
              if (
                result.result.menuItems &&
                Array.isArray(result.result.menuItems)
              ) {
                // Include menu context for AI - format as name -> id -> price mapping
                // Prices ARE included in context for UI display and AI knowledge, but NOT automatically mentioned in spoken response
                // Only mention prices in spoken response if user explicitly asks
                const menuContext = result.result.menuItems
                  .map(
                    (item: any) =>
                      `${item.name} -> ID: ${item.id}, Preis: ${
                        item.priceFormatted || `€${item.price.toFixed(2)}`
                      }${item.unitFormatted || ""}`
                  )
                  .join("; ");
                const category = result.result.category
                  ? ` in category ${result.result.category}`
                  : "";
                responseText = `Menu${category}: ${menuContext}. Remember these name-to-ID-to-price mappings for future orders and price questions. Do NOT mention prices automatically in your spoken responses, only if the user explicitly asks.`;
              } else if (
                result.result.services &&
                Array.isArray(result.result.services)
              ) {
                // Check if it's SPA/Beauty services (have availableSlots)
                if (
                  result.result.services.length > 0 &&
                  result.result.services[0].availableSlots
                ) {
                  // Include SPA/Beauty services context for AI - format as name -> id -> price -> available slots mapping
                  const servicesContext = result.result.services
                    .map((service: any) => {
                      const availableSlots = service.availableSlots
                        .filter((slot: any) => slot.available)
                        .map((slot: any) => slot.time)
                        .join(", ");
                      return `${service.name} -> ID: ${service.id}, Preis: ${
                        service.priceFormatted || `€${service.price.toFixed(2)}`
                      }${service.unitFormatted || ""}, Dauer: ${
                        service.duration
                      } Min, Verfügbare Slots: ${availableSlots}`;
                    })
                    .join("; ");
                  const category = result.result.category
                    ? ` in category ${result.result.category}`
                    : "";
                  responseText = `SPA & Beauty Services${category}: ${servicesContext}. Remember these name-to-ID-to-price-to-slots mappings for future bookings. Do NOT mention prices automatically in your spoken responses, only if the user explicitly asks. For SPA/Beauty services, guide the user to select an available time slot.`;
                } else if (
                  result.result.services.length > 0 &&
                  result.result.services[0].basePrice
                ) {
                  // Taxi services (have basePrice and pricePerKm)
                  const servicesContext = result.result.services
                    .map(
                      (service: any) =>
                        `${service.name} -> ID: ${service.id}, Grundpreis: ${service.basePriceFormatted}, Preis pro km: ${service.pricePerKmFormatted}`
                    )
                    .join("; ");
                  responseText = `Taxi Services: ${servicesContext}. Remember these name-to-ID-to-price mappings for future bookings. Do NOT mention prices automatically in your spoken responses, only if the user explicitly asks. For Taxi bookings, ask for pickup time (specific time, not slot), pickup address, and destination address.`;
                } else {
                  // Room Service (have price and availableUntil)
                  const servicesContext = result.result.services
                    .map(
                      (service: any) =>
                        `${service.name} -> ID: ${service.id}, Preis: ${
                          service.priceFormatted ||
                          `€${service.price.toFixed(2)}`
                        }${service.unitFormatted || ""}, Verfügbar bis: ${
                          service.availableUntil
                        }`
                    )
                    .join("; ");
                  const category = result.result.category
                    ? ` in category ${result.result.category}`
                    : "";
                  responseText = `Room Service${category}: ${servicesContext}. Remember these name-to-ID-to-price mappings for future orders. Do NOT mention prices automatically in your spoken responses, only if the user explicitly asks. For Room Service, check if it's still before 11:00 AM for same-day delivery, otherwise schedule for tomorrow. Ask for delivery time if not specified.`;
                }
              } else if (result.result.needsTimeSlot && result.result.service) {
                // Service needs time slot selection
                const availableSlots = result.result.service.availableSlots
                  .filter((slot: any) => slot.available)
                  .map((slot: any) => slot.time)
                  .join(", ");
                responseText = `Please select a time slot for ${result.result.service.name}. Available slots: ${availableSlots}.`;
              } else if (result.result.serviceId && result.result.timeSlot) {
                // Time slot selected - show updated cart
                responseText = `Time slot ${result.result.timeSlot} selected for ${result.result.serviceName}.`;
              } else if (result.result.order) {
                // Order confirmation - don't mention price unless user asks
                const orderItems = result.result.order.items
                  .map(
                    (item: any) =>
                      `${item.quantity}x ${item.name}${
                        item.timeSlot ? ` um ${item.timeSlot} Uhr` : ""
                      }`
                  )
                  .join(", ");
                responseText = `Order placed: ${orderItems}.`;
              } else {
                responseText = "Task completed successfully.";
              }
            } else {
              responseText = String(result.result);
            }
          } else {
            responseText = "Action completed.";
          }

          sendToolResponse(message.toolCallId, responseText);

          // Distinguish between action tools (create/edit/delete) and view tools (list)
          if (isViewTool(action)) {
            // View tools: Show UI in main area, don't show action message
            // Cancel any pending action message timeout
            if (actionMessageTimeout) {
              clearTimeout(actionMessageTimeout);
              actionMessageTimeout = null;
            }
            actionMessage = null;
            console.log("[VoiceCall] View tool - showing UI in main area");

            // Add to activity stream (only for view tools)
            console.log(
              "[VoiceCall] Adding view tool to activity stream:",
              result.ui ? "present" : "missing",
              result
            );
            // Determine vibeId based on action
            let vibeId = "menu";
            if (action === "list_wellness") vibeId = "spa-beauty";
            else if (action === "list_taxi") vibeId = "taxi";
            else if (action === "list_room_service") vibeId = "room-service";
            addActivity({
              vibeId: vibeId,
              toolName: action,
              result: result.result,
              ui: result.ui,
            });
          } else if (isCartTool(action)) {
            // Cart tools: Show cart UI or time slot selection UI in mini-modal
            // Cancel any existing timeout
            if (actionMessageTimeout) {
              clearTimeout(actionMessageTimeout);
              actionMessageTimeout = null;
            }

            // Check if time slot selection is needed
            if (result.result.needsTimeSlot && result.ui) {
              // Show time slot selection UI in mini-modal
              actionMessage = null;
              orderConfirmationUI = null;
              cartUI = null;
              timeSlotSelectionUI = result.ui;
              console.log(
                "[VoiceCall] Cart tool - showing time slot selection UI in mini-modal"
              );
            } else {
              // Show cart UI in mini-modal
              actionMessage = null;
              orderConfirmationUI = null;
              timeSlotSelectionUI = null;
              cartUI = result.ui;
              console.log(
                "[VoiceCall] Cart tool - showing cart UI in mini-modal"
              );
            }
          } else if (isTimeSlotTool(action)) {
            // Time slot tool: Show updated cart UI in mini-modal after slot selection
            // Cancel any existing timeout
            if (actionMessageTimeout) {
              clearTimeout(actionMessageTimeout);
              actionMessageTimeout = null;
            }

            // Show updated cart UI in mini-modal
            actionMessage = null;
            orderConfirmationUI = null;
            timeSlotSelectionUI = null;
            cartUI = result.ui; // Updated cart with time slot
            console.log(
              "[VoiceCall] Time slot tool - showing updated cart UI in mini-modal"
            );
          } else {
            // Action tools: Show compact message in mini-modal, DON'T add to activity stream
            // Special case: confirm_order shows UI in mini-modal instead of text message
            if (action === "confirm_order" && result.ui) {
              // Cancel any existing timeout
              if (actionMessageTimeout) {
                clearTimeout(actionMessageTimeout);
                actionMessageTimeout = null;
              }

              // Show order confirmation UI in mini-modal
              actionMessage = null; // Clear text message
              cartUI = null; // Clear cart UI
              orderConfirmationUI = result.ui; // Set UI for mini-modal

              // Auto-clear order UI after 5 seconds
              actionMessageTimeout = setTimeout(() => {
                orderConfirmationUI = null;
                actionMessageTimeout = null;
              }, 5000);
            } else {
              // Cancel any existing timeout (toast behavior: replace immediately)
              if (actionMessageTimeout) {
                clearTimeout(actionMessageTimeout);
                actionMessageTimeout = null;
              }

              // Set new action message (replaces previous one immediately)
              const message = formatActionMessage(action, result.result);
              if (message) {
                actionMessage = message;
                orderConfirmationUI = null; // Clear any order UI
                cartUI = null; // Clear cart UI
                timeSlotSelectionUI = null; // Clear time slot selection UI
                console.log(
                  "[VoiceCall] Action tool - showing compact message:",
                  actionMessage
                );

                // Auto-clear action message after 3 seconds (or until new action replaces it)
                actionMessageTimeout = setTimeout(() => {
                  actionMessage = null;
                  actionMessageTimeout = null;
                }, 3000);
              }
            }

            // No todo-related updates needed - todos functionality removed
          }

          console.log("✅ Action executed successfully:", action);
        } catch (actionError: any) {
          console.error("❌ Action execution failed:", actionError);
          sendToolError(
            message.toolCallId,
            `Action failed: ${actionError.message}`
          );
        }
      } else {
        // Unknown tool
        sendToolError(
          message.toolCallId,
          `Tool "${message.name}" not supported`
        );
      }
    } catch (err: any) {
      console.error("❌ Tool call failed:", err);
      sendToolError(message.toolCallId, err.message || "Tool execution error");
    }
  }

  // Helper to send tool success response
  function sendToolResponse(toolCallId: string, content: string) {
    // @ts-ignore - sendJson exists but not in types
    socket?.sendJson({
      type: "tool_response",
      toolCallId,
      content,
    });
  }

  // Helper to send tool error
  function sendToolError(toolCallId: string, errorMessage: string) {
    // @ts-ignore - sendJson exists but not in types
    socket?.sendJson({
      type: "tool_error",
      toolCallId,
      error: errorMessage,
      code: "tool_error",
      level: "warn",
      content: errorMessage,
    });
  }

  // // Helper to send text input directly to Hume (without speaking)
  // async function sendTextInput(text: string) {
  //   console.log(`📝 Text input sent: "${text}"`);
  // }

  async function startCall() {
    if (!browser) return;

    // Reset UI state for new call, but keep persistent audio resources running
    lastResponse = "";
    isConnecting = true;
    isWaitingForPermission = true;
    
    // Perform a "soft" cleanup: close any existing socket and stop the recorder
    // but LEAVE the globalMediaStream and its keep-alive graph running.
    const softCleanup = () => {
        if (socket) {
            socket.close();
            socket = null;
        }
        const mediaRecorder = (window as any).__mediaRecorder;
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        delete (window as any).__mediaRecorder;
        delete (window as any).__sendQueuedAudioChunks;
        audioChunkQueue = [];
    }
    softCleanup();

    try {
      console.log("🎙️ Starting Hume voice conversation...");

      if (!HUME_CONFIG_ID) {
        throw new Error("HUME_CONFIG_ID not configured.");
      }
      
      // This function contains the logic that runs AFTER the stream is stabilized.
      const proceedWithStream = async (stream: MediaStream) => {
        isWaitingForPermission = false; // Permission phase is over

        // Use MediaRecorder for ALL platforms
        const mimeTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ];

        let selectedMimeType = "audio/webm";
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            break;
          }
        }
        console.log("🎤 Using MediaRecorder, MIME type:", selectedMimeType);

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
        });

        let chunkCount = 0;
        let totalBytesSent = 0;

        mediaRecorder.ondataavailable = async (event: BlobEvent) => {
          if (event.data.size === 0) {
            console.warn("⚠️ Empty audio chunk received");
            return;
          }

          chunkCount++;
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(",")[1] || (reader.result as string);
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(event.data);
          });
          
          totalBytesSent += base64Data.length;

          const currentSocket = socket;
          if (currentSocket && (currentSocket as any).readyState === 1) {
            try {
              currentSocket.sendAudioInput({ data: base64Data });
            } catch (err: any) {
              console.error("❌ Error sending MediaRecorder audio:", err);
            }
          } else {
            audioChunkQueue.push(base64Data);
          }
        };

        mediaRecorder.onerror = (event: any) => console.error("❌ MediaRecorder error:", event);
        mediaRecorder.onstart = () => {
          console.log("✅ MediaRecorder started");
          isRecording = true;
        };
        mediaRecorder.onstop = () => {
          console.log("⏹️ MediaRecorder stopped");
          console.log(`📊 Total chunks: ${chunkCount}, Total bytes sent: ${totalBytesSent}`);
          isRecording = false;
        };

        // On iOS PWA, wait for the first data chunk to prove the stream is actively being consumed
        // before proceeding with socket connection. This should prevent iOS from killing the stream.
        let firstChunkReceived = false;
        if (isIOSPWA) {
          const originalHandler = mediaRecorder.ondataavailable;
          const firstChunkPromise = new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn("⚠️ iOS PWA: Timeout waiting for first audio chunk. Proceeding anyway.");
              resolve();
            }, 500);
            
            mediaRecorder.ondataavailable = async (event: BlobEvent) => {
              if (!firstChunkReceived && event.data.size > 0) {
                firstChunkReceived = true;
                clearTimeout(timeout);
                console.log("✅ iOS PWA: First audio chunk received. Stream is stable.");
                resolve();
              }
              // Always call the original handler
              if (originalHandler) {
                await originalHandler(event);
              }
            };
          });
          
          mediaRecorder.start(100);
          console.log("✅ MediaRecorder capturing started with 100ms timeslice");
          await firstChunkPromise;
        } else {
          mediaRecorder.start(100);
          console.log("✅ MediaRecorder capturing started with 100ms timeslice");
        }

        (window as any).__mediaRecorder = mediaRecorder;
        (window as any).__mediaStream = stream;

        (window as any).__sendQueuedAudioChunks = async () => {
          const currentSocket = socket;
          if (!currentSocket || (currentSocket as any).readyState !== 1 || audioChunkQueue.length === 0) {
            return;
          }
          console.log(`📤 Sending ${audioChunkQueue.length} queued MediaRecorder chunks`);
          while (audioChunkQueue.length > 0) {
            const chunk = audioChunkQueue.shift();
            if (chunk) {
              try {
                currentSocket.sendAudioInput({ data: chunk });
              } catch (err: any) {
                console.error("❌ Error sending queued audio:", err);
                break;
              }
            }
          }
        };
        
        const accessTokenResponse = await fetch("/alpha/api/hume/access-token");
        if (!accessTokenResponse.ok) {
          const errorData = await accessTokenResponse.json();
          throw new Error(errorData.error || "Failed to get access token");
        }
        const { accessToken } = await accessTokenResponse.json();
        console.log("✅ Access token received");
        
        const client = new HumeClient({ accessToken });
        socket = await client.empathicVoice.chat.connect({ configId: HUME_CONFIG_ID });
        console.log("✅ Socket created, waiting for open event...");
        
        setupSocketListeners();
        await waitForSocketOpen();
        
        isConnecting = false;
        console.log("🎙️ Hume voice call started - bidirectional communication should be active");
      }
      
      const setupSocketListeners = () => {
         socket.on("message", async (message: any) => {
          try {
            if (message.type && !["audio_output"].includes(message.type)) {
              console.log(`📨 Received message type: ${message.type}`, message);
            }
            if (message.type === "error" || message.error) {
              console.error("❌ Hume server error:", message.error || message);
            }
            if (message.type === "user_interruption") {
              console.log("🛑 User interruption detected, stopping audio playback");
              const isIOSPWA = (window.navigator as any).standalone === true;
              if (isIOSPWA) stopIOSPWAAudio();
              if (audioStreamer) audioStreamer.stop();
            }
            if (message.type === "audio_output") {
              const audioData = message.data || message.audio || message.payload;
              if (!audioData) return;
              
              const isIOSPWA = (window.navigator as any).standalone === true;
              let blob: Blob;
              if (audioData instanceof Blob) blob = audioData;
              else if (typeof audioData === "string") {
                const binaryString = atob(audioData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                blob = new Blob([bytes], { type: "audio/webm;codecs=opus" });
              } else if (audioData instanceof ArrayBuffer) {
                blob = new Blob([audioData], { type: "audio/webm;codecs=opus" });
              } else return;
              
              if (isIOSPWA) {
                iosPWAAudioQueue.push(blob);
                if (!iosPWAAudioPlaying) playIOSPWAAudioQueue();
              } else if (audioStreamer) {
                audioStreamer.addEncodedAudio(blob).catch(err => console.error("Error decoding audio", err));
              }
            }
            if (message.type === "assistant_message" && message.message?.content) {
              lastResponse = message.message.content;
            }
            if (message.type === "tool_call") {
              await handleToolCall(message);
            }
          } catch (err: any) {
            console.error("❌ Error handling message:", err);
          }
        });
        socket.on("error", async (error: Error) => {
          console.error("❌ Hume error:", error);
          await cleanupCall();
        });
        socket.on("close", async (event: any) => {
          console.log("🔌 Hume connection closed", event);
          if (!event.willReconnect) await cleanupCall();
        });
      }
      
      const waitForSocketOpen = () => {
        return new Promise<void>((resolve, reject) => {
          if (socket?.readyState === 1) return resolve();
          const timeout = setTimeout(() => reject(new Error("Socket connection timeout")), 10000);
          const onOpen = async () => {
            clearTimeout(timeout);
            socket.off("open", onOpen);
            socket.off("error", onError);
            console.log("✅ Hume connection opened");
            isConnected = true;
            if ((window as any).__sendQueuedAudioChunks) {
              await (window as any).__sendQueuedAudioChunks();
            }
            resolve();
          };
          const onError = (error: Error) => {
            clearTimeout(timeout);
            socket.off("open", onOpen);
            socket.off("error", onError);
            reject(error);
          };
          socket.on("open", onOpen);
          socket.on("error", onError);
        });
      }

      const isIOSPWA = (window.navigator as any).standalone === true;

      // --- Step 1: Get or Reuse a Persistent, Stabilized MediaStream ---
      if (!globalMediaStream || !globalMediaStream.active) {
        console.log("🎤 No active global stream. Requesting new one...");
        isWaitingForPermission = true;
        
        const mediaConstraints = {
          audio: isIOSPWA ? true : {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        };

        // Get the new stream
        globalMediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        console.log("✅ MediaStream obtained");
        
        // Add a listener to detect if the track ends unexpectedly
        globalMediaStream.getAudioTracks()[0].onended = () => {
            console.error("❌ CRITICAL: The global MediaStreamTrack has ended unexpectedly! The microphone may have been disconnected or permission revoked.");
            // We'll try to recover by nullifying the stream, so the next call will re-request it.
            globalMediaStream = null;
            cleanupCall(); // Trigger a full cleanup
        };

        // For iOS PWA, we are trying a "Record First" strategy without any additional keep-alives,
        // as they seem to be triggering the capture failure themselves. The MediaRecorder will be the
        // sole consumer responsible for keeping the stream alive.
      } else {
        console.log("🎤 Reusing existing global MediaStream.");
      }
      
      isWaitingForPermission = false;

      // --- Step 2: Proceed with the now-stable stream ---
      // This function contains the logic that runs AFTER the stream is stabilized.
      await proceedWithStream(globalMediaStream);

    } catch (err: any) {
      console.error("❌ Failed to start Hume voice:", err);
      lastResponse = `Error: ${err.message || "Failed to start voice call"}`;
      await cleanupCall(); // Full cleanup on any failure in the start process
    }
  }

  /**
   * Clean up resources and close modal
   * Called when connection closes or errors
   */
  async function cleanupCall() {
    if (!browser) return; // Prevent SSR errors
    console.log("🧹 Cleaning up call resources...");

    // Clean up window references for queued audio chunks (memory leak fix)
    if ((window as any).__sendQueuedAudioChunks) {
      delete (window as any).__sendQueuedAudioChunks;
    }

    audioChunkQueue = [];

    // Stop MediaRecorder
    const mediaRecorder = (window as any).__mediaRecorder;
    if (mediaRecorder) {
      try {
        if (mediaRecorder.state !== "inactive") {
              mediaRecorder.stop();
        }
      } catch (err) {
        console.error("Error stopping MediaRecorder:", err);
      }
      delete (window as any).__mediaRecorder;
    }
    
    // Note: We DO NOT stop the globalMediaStream tracks here.
    // That is only done in onDestroy for a full teardown.

    // Stop AudioRecorder (legacy, if present)
    if (audioRecorder) {
      try {
        audioRecorder.stop();
        console.log("✅ AudioRecorder (AudioWorklet) stopped");
      } catch (err) {
        console.error("Error stopping AudioRecorder:", err);
      }
      audioRecorder = null;
    }

    // Stop AudioStreamer for playback
    if (audioStreamer) {
      try {
        audioStreamer.stop();
      } catch (err) {
        console.error("Error stopping AudioStreamer:", err);
      }
      audioStreamer = null;
    }
    
    // Clear iOS PWA audio playback queue
    stopIOSPWAAudio();

    // Cancel any pending action message timeout
    if (actionMessageTimeout) {
      clearTimeout(actionMessageTimeout);
      actionMessageTimeout = null;
    }

    // Reset state
    isRecording = false;
    isConnected = false;
    isConnecting = false;
    isWaitingForPermission = false;
    lastResponse = "";
    actionMessage = null;
    humeReady = false; // Reset Hume ready state

    // Reset store state
    resetVoiceCallState();
  }

  async function stopCall() {
    try {
      // Close socket connection (will trigger 'close' event which calls cleanupCall)
      if (socket) {
        socket.close();
      } else {
        // No socket, clean up directly
        await cleanupCall();
      }
      console.log("⏹️ Hume voice call stopped by user");
    } catch (err) {
      console.error("Failed to stop Hume voice:", err);
      // Ensure cleanup even on error
      await cleanupCall();
    }
  }

  // Cleanup on component destroy
  onDestroy(async () => {
    if (!browser) return; // Prevent SSR errors
    console.log("💥 Component destroying, performing full cleanup...");
    await stopCall(); // Perform a normal "soft" cleanup first

    // Now, perform the "hard" cleanup of persistent resources
    if (keepAliveSource) {
      keepAliveSource.disconnect();
      keepAliveSource = null;
    }
    if (keepAliveContext) {
      try {
        await keepAliveContext.close();
        console.log("✅ Web Audio keep-alive context closed.");
      } catch (e) {
        console.error("Error closing Web Audio keep-alive context", e);
      }
      keepAliveContext = null;
    }
    if (globalMediaStream) {
      globalMediaStream.getTracks().forEach(track => {
        track.onended = null; // Remove listener
        track.stop();
      });
      globalMediaStream = null;
      console.log("🧹 Global MediaStream stopped on component destroy.");
    }
  });
</script>

<!-- Action Mini-Modal - Only shown when call is actually active (recording or connected) -->
{#if isRecording || isConnected}
  <div class="voice-transcript-modal">
    <div class="transcript-area">
      {#if orderConfirmationUI}
        <div class="order-confirmation-wrapper">
          <ComponentRenderer component={orderConfirmationUI} />
        </div>
      {:else if timeSlotSelectionUI}
        <div class="time-slot-selection-wrapper">
          <ComponentRenderer component={timeSlotSelectionUI} />
        </div>
      {:else if cartUI}
        <div class="cart-wrapper">
          <ComponentRenderer component={cartUI} />
        </div>
      {:else if actionMessage}
        <p class="action-message">{actionMessage}</p>
      {:else if lastResponse}
        <p class="assistant-response">{lastResponse}</p>
      {:else if isRecording || isConnected}
        <p class="placeholder">Speak now...</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Transcript Mini-Modal - Inverted dark style positioned directly above navbar */
  .voice-transcript-modal {
    position: fixed;
    /* Position directly above navbar: navbar height (56px) + margin-bottom (0.375rem) + gap (0.5rem) */
    bottom: calc(56px + 0.375rem + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001; /* Above navbar (z-index: 10000) */
    /* Inverted style with dark bg-500 */
    background: var(--color-brand-navy-500);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(8, 27, 71, 0.3), 0 1px 4px rgba(8, 27, 71, 0.2);
    max-width: 500px;
    width: calc(100vw - 2rem);
    animation: slideUp 0.3s ease-out;
    overflow: hidden;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .transcript-area {
    padding: 1rem 1.5rem;
    overflow-y: auto;
    /* Auto-grow based on content, max-height for very long content */
    max-height: 400px;
    min-height: auto;
  }

  .transcript-area p {
    margin: 0;
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.85); /* Light text on dark bg */
  }

  @media (min-width: 640px) {
    .transcript-area p {
      font-size: 1.0625rem;
    }
  }

  .transcript-area p.placeholder {
    color: rgba(255, 255, 255, 0.5); /* Light gray text on dark bg */
    font-style: italic;
    text-align: center;
  }

  .transcript-area p.action-message {
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--color-accent-900); /* Dark yellow text */
    /* Inverted badge style with yellow accent */
    background: var(--color-accent-500); /* Yellow accent background */
    text-align: center;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    letter-spacing: 0.05em;
    line-height: 1.4;
    border: 1px solid var(--color-accent-600);
    box-shadow: 0 2px 8px rgba(244, 208, 63, 0.3);
    text-transform: uppercase;
  }

  .transcript-area p.assistant-response {
    color: rgba(255, 255, 255, 0.95); /* Bright white text on dark bg */
  }

  .order-confirmation-wrapper,
  .cart-wrapper,
  .time-slot-selection-wrapper {
    width: 100%;
    padding: 0.5rem 0;
  }

  @media (max-width: 640px) {
    .voice-transcript-modal {
      width: calc(100vw - 1rem);
      max-width: none;
    }
  }
</style>
