<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    HumeClient,
    getBrowserSupportedMimeType,
    getAudioStream,
    ensureSingleValidAudioTrack,
    convertBlobToBase64,
    EVIWebAudioPlayer,
  } from "hume";
  import { browser } from "$app/environment";
  import { env } from "$env/dynamic/public";
  import { executeAction } from "$lib/voice/core-tools";
  import { addActivity } from "$lib/stores/activity-stream";
  import {
    updateVoiceCallState,
    resetVoiceCallState,
  } from "$lib/stores/voice-call";
  import ComponentRenderer from "$lib/components/dynamic/ComponentRenderer.svelte";

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

  // Helper to determine if action is a view tool (shows UI) or action tool (shows compact message)
  function isViewTool(action: string): boolean {
    return (
      action === "list_menu" ||
      action === "list_spa_beauty" ||
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

  // Expose functions via component API
  export { startCall, stopCall };

  // Hume instances
  let socket: any = null;
  let audioStream: MediaStream | null = null;
  let micMonitor: HTMLAudioElement | null = null;
  let micAudioContext: AudioContext | null = null;
  let micSourceNode: MediaStreamAudioSourceNode | null = null;
  let micGainNode: GainNode | null = null;
  const preferredAudioConstraints: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      sampleRate: 44100,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };

  async function acquireAudioStream() {
    if (!navigator.mediaDevices) {
      throw new Error("MediaDevices API not available");
    }

    try {
      return await navigator.mediaDevices.getUserMedia(preferredAudioConstraints);
    } catch (err) {
      console.warn(
        "⚠️ Preferred audio constraints failed, falling back to basic audio stream:",
        (err as Error).message
      );
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    }
  }
  let mediaRecorder: MediaRecorder | null = null;
  let audioPlayer: EVIWebAudioPlayer | null = null;
  let permissionStream: MediaStream | null = null; // Store stream from permission request if still active

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
            if (action === "list_spa_beauty") vibeId = "spa-beauty";
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
  //   // If not connected, start the call first
  //   if (!socket || !isConnected) {
  //     console.log("📞 Auto-starting call to send text input...");
  //     await startCall();

  //     // Wait for connection to be established (poll with timeout)
  //     let attempts = 0;
  //     while ((!socket || !isConnected) && attempts < 50) {
  //       await new Promise((resolve) => setTimeout(resolve, 100));
  //       attempts++;
  //     }

  //     if (!socket || !isConnected) {
  //       console.error("❌ Failed to establish connection for text input");
  //       return;
  //     }
  //   }

  //   // Send the text input
  //   // @ts-ignore - sendJson exists but not in types
  //   socket.sendJson({
  //     type: "user_input",
  //     text,
  //   });
  //   console.log(`📝 Text input sent: "${text}"`);
  // }

  async function startCall() {
    if (!browser) return;

    try {
      lastResponse = "";
      isConnecting = true;
      isWaitingForPermission = true;

      console.log("🎙️ Starting Hume voice conversation...");

      if (!HUME_CONFIG_ID) {
        console.error("❌ HUME_CONFIG_ID not configured");
        lastResponse =
          "Error: Voice configuration not set up. Please configure HUME_CONFIG_ID.";
        isConnecting = false;
        try {
          const AudioContextConstructor =
            (window as any).AudioContext || (window as any).webkitAudioContext;
          if (!micAudioContext && AudioContextConstructor) {
            micAudioContext = new AudioContextConstructor();
          }

          if (micAudioContext) {
            if (micAudioContext.state === "suspended") {
              await micAudioContext.resume();
            }

            // Disconnect previous nodes if they exist
            try {
              if (micSourceNode) {
                micSourceNode.disconnect();
              }
              if (micGainNode) {
                micGainNode.disconnect();
              }
            } catch (disconnectErr) {
              console.warn(
                "⚠️ Failed to disconnect previous mic nodes:",
                (disconnectErr as Error).message
              );
            }

            micSourceNode = micAudioContext.createMediaStreamSource(audioStream);
            micGainNode = micAudioContext.createGain();
            micGainNode.gain.value = 0.0001; // effectively silent but keeps stream active

            micSourceNode.connect(micGainNode);
            micGainNode.connect(micAudioContext.destination);
          }
        } catch (audioCtxErr: any) {
          console.warn("⚠️ Failed to initialize mic AudioContext:", audioCtxErr?.message);
        }

        isWaitingForPermission = false;
        return;
      }

      // Request microphone permission FIRST (before anything else)
      // This is critical for iOS PWAs - permission must be requested early
      // AND we must start using it immediately or iOS will close it!
      console.log("🎤 Requesting microphone permission...");
      
      // Get a fresh stream every time - don't try to reuse old streams
      // iOS PWA requires active usage to keep permission alive
      try {
        audioStream = await acquireAudioStream();
        console.log("✅ Microphone permission granted - stream active");

        // CRITICAL for iOS PWA: Start MediaRecorder IMMEDIATELY to keep stream alive!
        // iOS closes streams that aren't actively being recorded
        // We'll queue chunks and send them once WebSocket is ready
        try {
          const mimeTypeResult = getBrowserSupportedMimeType();
          const mimeType = mimeTypeResult.success ? mimeTypeResult.mimeType : "audio/webm";
          
          mediaRecorder = new MediaRecorder(audioStream, { mimeType });
          
          // Queue for chunks until socket is ready
          const audioChunkQueue: Blob[] = [];
          
          mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size < 1) return;
            
            // Check socket reference (will be set later)
            const currentSocket = socket;
            if (currentSocket && (currentSocket as any).readyState === 1) {
              try {
                const encodedAudioData = await convertBlobToBase64(event.data);
                currentSocket.sendAudioInput({ data: encodedAudioData });
              } catch (err: any) {
                console.error("❌ Error sending audio:", err);
              }
      } else {
              // Queue chunk until socket is ready
              audioChunkQueue.push(event.data);
      }
          };
          
          // Start recording IMMEDIATELY - this keeps the stream alive!
          mediaRecorder.start(50);
          isRecording = true;
          console.log("🎤 MediaRecorder started immediately to keep stream alive");
      
          // Once socket is ready, send queued chunks
          const sendQueuedChunks = async () => {
            const currentSocket = socket;
            if (!currentSocket || (currentSocket as any).readyState !== 1) {
              return;
            }
            
            while (audioChunkQueue.length > 0) {
              const chunk = audioChunkQueue.shift();
              if (chunk && currentSocket && (currentSocket as any).readyState === 1) {
                try {
                  const encodedAudioData = await convertBlobToBase64(chunk);
                  currentSocket.sendAudioInput({ data: encodedAudioData });
                } catch (err: any) {
                  console.error("❌ Error sending queued audio:", err);
                  break; // Stop if there's an error
                }
          } else {
                break; // Socket closed, stop sending
              }
            }
          };
          
          // Store function and queue reference to call when socket opens
          (window as any).__sendQueuedAudioChunks = sendQueuedChunks;
          (window as any).__audioChunkQueue = audioChunkQueue;
        } catch (recorderErr: any) {
          console.error("❌ Failed to start MediaRecorder immediately:", recorderErr);
          // Continue anyway - we'll try again in startAudioCapture
        }

        isWaitingForPermission = false;
      } catch (permissionErr: any) {
        console.error("❌ Microphone permission denied:", permissionErr);
        isWaitingForPermission = false;
        lastResponse =
          "Microphone permission is required to start a voice call.";
        isConnecting = false;
        return;
      }

      // For iOS: Don't initialize AudioPlayer yet - it conflicts with microphone!
      // iOS can't have both mic input and audio output initialized simultaneously
      // We'll lazy-initialize AudioPlayer when we receive audio from AI
      const isIOS = browser && /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isIOS) {
        console.log("📱 iOS PWA: Skipping AudioPlayer init to keep microphone alive");
        console.log("🔊 AudioPlayer will be initialized when AI audio arrives");
        audioPlayer = null; // Will be lazy-initialized
      } else {
        // Non-iOS: Initialize audio player normally
        console.log("🔄 Initializing audio player...");
        try {
        audioPlayer = new EVIWebAudioPlayer();
        await audioPlayer.init();
        console.log("✅ Audio player initialized");
      } catch (audioPlayerErr: any) {
        console.error("❌ Failed to initialize audio player:", audioPlayerErr);
        console.warn("⚠️ Continuing without audio player - will retry when audio arrives");
          audioPlayer = null;
        }
      }

      // Get access token from server (still connecting)
      const accessTokenResponse = await fetch("/alpha/api/hume/access-token");
      if (!accessTokenResponse.ok) {
        const errorData = await accessTokenResponse.json();
        throw new Error(errorData.error || "Failed to get access token");
      }

      const { accessToken } = await accessTokenResponse.json();
      console.log("✅ Access token received");

      // Initialize Hume client
      console.log("🔄 Initializing Hume client...");
      const client = new HumeClient({ accessToken });
      console.log("✅ Hume client initialized");

      // Connect to EVI WebSocket
      console.log("🔄 Connecting to Hume EVI WebSocket...");
      console.log("📊 Config ID:", HUME_CONFIG_ID ? "Set" : "Missing");

      try {
        socket = await client.empathicVoice.chat.connect({
          configId: HUME_CONFIG_ID,
        });
        console.log("✅ Socket created, waiting for open event...");
      } catch (socketConnectErr: any) {
        console.error("❌ Failed to create socket:", socketConnectErr);
        console.error(
          "Socket connect error details:",
          socketConnectErr.message,
          socketConnectErr.stack
        );
        throw socketConnectErr; // Re-throw to be caught by outer try-catch
      }

      // Check initial socket state
      // @ts-ignore - readyState exists on the socket
      console.log(
        "📊 Socket initial readyState:",
        socket.readyState,
        "(0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED)"
      );

      // Set up event listeners BEFORE waiting for open
      // Use a promise-based approach with timeout to detect if socket hangs
      let socketOpened = false;
      let socketOpenTimeout: ReturnType<typeof setTimeout> | null = null;
      let preOpenErrorHandler: ((error: Error) => void) | null = null;

      // Helper function to safely remove event listeners
      const removeErrorHandler = (handler: ((error: Error) => void) | null) => {
        if (!handler) return;
        // Try different methods to remove the listener
        if (typeof socket.off === "function") {
          socket.off("error", handler);
        } else if (typeof socket.removeListener === "function") {
          socket.removeListener("error", handler);
        } else if (typeof socket.removeEventListener === "function") {
          socket.removeEventListener("error", handler);
        }
        // If none of the methods exist, we can't remove it, but that's okay
        // The handler will just not be called if the socket is already closed/errored
      };

      const socketOpenPromise = new Promise<void>((resolve, reject) => {
        socketOpenTimeout = setTimeout(() => {
          if (!socketOpened) {
            console.error("❌ Socket open timeout after 10 seconds");
            // Remove the pre-open error handler since we're timing out
            removeErrorHandler(preOpenErrorHandler);
            preOpenErrorHandler = null;
            reject(new Error("Socket connection timeout"));
          }
        }, 10000); // 10 second timeout

        socket.on("open", async () => {
          socketOpened = true;
          if (socketOpenTimeout) {
            clearTimeout(socketOpenTimeout);
            socketOpenTimeout = null;
          }
          // Remove the pre-open error handler since socket is now open
          removeErrorHandler(preOpenErrorHandler);
          preOpenErrorHandler = null;
          console.log("✅ Hume connection opened");
          isConnected = true;

          // Verify socket is really open
          // @ts-ignore - readyState exists on the socket
          console.log(
            "📊 Socket readyState after open event:",
            socket.readyState
          );
          
          // If MediaRecorder was started early, update handler and send queued chunks
          if ((window as any).__sendQueuedAudioChunks && mediaRecorder) {
            console.log("🔄 Socket ready - updating MediaRecorder handler and sending queued chunks");
            
            // Update the ondataavailable handler to send directly now
            mediaRecorder.ondataavailable = async (event) => {
              if (event.data.size < 1) return;
              
              // Send directly now that socket is ready
              if (socket && (socket as any).readyState === 1) {
                try {
                  const encodedAudioData = await convertBlobToBase64(event.data);
                  socket.sendAudioInput({ data: encodedAudioData });
                } catch (err: any) {
                  console.error("❌ Error sending audio:", err);
                }
              }
            };
            
            // Send any queued chunks
            (window as any).__sendQueuedAudioChunks();
            
            // Clean up
            delete (window as any).__sendQueuedAudioChunks;
            delete (window as any).__audioChunkQueue;
          }
          
          resolve();
        });

        // Store reference to pre-open error handler so we can remove it later
        preOpenErrorHandler = (error: Error) => {
          // Don't set socketOpened = true for errors - only for successful open
          if (socketOpenTimeout) {
            clearTimeout(socketOpenTimeout);
            socketOpenTimeout = null;
          }
          console.error("❌ Socket error before open:", error);
          // Remove this handler since we're rejecting
          removeErrorHandler(preOpenErrorHandler);
          preOpenErrorHandler = null;
          reject(error);
        };

        socket.on("error", preOpenErrorHandler);
      });

      socket.on("message", async (message: any) => {
        try {
          // Handle user interruptions - stop audio playback immediately for low latency
          // According to Hume docs: EVI "stops rapidly whenever users interject"
          // https://dev.hume.ai/docs/speech-to-speech-evi/overview
          if (message.type === "user_interruption" && audioPlayer) {
            console.log(
              "🛑 User interruption detected, stopping audio playback immediately"
            );
            // Stop audio playback immediately for responsive interruption handling
            audioPlayer.stop();
            // Clear any queued audio to prevent delayed playback after interruption
            // This ensures EVI can respond immediately to the user's interjection
          }

          // Handle audio output - use EVIWebAudioPlayer for smooth playback
          // Enqueue immediately without await for lower latency
          if (message.type === "audio_output") {
            // Lazy initialize audio player if it wasn't initialized earlier (fallback)
            if (!audioPlayer) {
              console.log("🔄 Lazy initializing audio player (fallback)...");
              try {
                audioPlayer = new EVIWebAudioPlayer();
                await audioPlayer.init();
                console.log("✅ Audio player initialized lazily");
                
                // Try to resume AudioContext if suspended (iOS PWA)
                try {
                  // @ts-ignore - accessing internal audioContext if available
                  const audioContext =
                    audioPlayer.audioContext || (audioPlayer as any).context;
                  if (
                    audioContext &&
                    typeof audioContext.resume === "function"
                  ) {
                    if (audioContext.state === "suspended") {
                      console.log("🔄 Resuming suspended AudioContext...");
                      await audioContext.resume();
                      console.log(
                        "✅ AudioContext resumed, state:",
                        audioContext.state
                      );
                    }
                  }
                } catch (resumeErr: any) {
                  console.log(
                    "ℹ️ Could not access/resume AudioContext:",
                    resumeErr.message
                  );
                }
              } catch (lazyInitErr: any) {
                console.error(
                  "❌ Failed to lazy initialize audio player:",
                  lazyInitErr
                );
                // Continue without audio player - user won't hear audio but call can continue
                return;
              }
            }
            
            console.log("🔊 Received audio output from AI");
            audioPlayer.enqueue(message).catch((err: any) => {
              console.error("❌ Error enqueueing audio:", err);
            });
          }

          // Handle assistant messages
          if (
            message.type === "assistant_message" &&
            message.message?.content
          ) {
            lastResponse = message.message.content;
            console.log("🤖 Assistant:", message.message.content);
          }

          // Handle user messages
          if (message.type === "user_message" && message.message?.content) {
            console.log("🎤 User:", message.message.content);
          }

          // Handle tool calls
          if (message.type === "tool_call") {
            console.log("🔧 Tool call received:", message.name);
            await handleToolCall(message);
          }
        } catch (err: any) {
          console.error("❌ Error handling message:", err);
          // Don't let message handler errors close the socket
        }
      });

      // Error handler for errors AFTER socket is open
      // The preOpenErrorHandler in socketOpenPromise handles errors BEFORE open
      // This handler will only be active after socketOpenPromise resolves (socket is open)
      socket.on("error", (error: Error) => {
        // This handler only runs for errors AFTER socket is open
        // The preOpenErrorHandler is removed once socket opens or promise rejects
        console.error("❌ Hume error (after open):", error);
        console.error("Error details:", error.message, error.stack);
        cleanupCall();
      });

      socket.on("close", (event: any) => {
        console.log("🔌 Hume connection closed");
        console.log("Close event details:", event);
        console.log("Close code:", event.code, "Reason:", event.reason);
        // Only cleanup if it's not a reconnection attempt
        if (!event.willReconnect) {
          cleanupCall();
        } else {
          console.log("🔄 Socket will reconnect, not cleaning up");
        }
      });

      // Wait for connection to open
      // Use our own promise with timeout instead of tillSocketOpen() which might hang
      console.log("⏳ Waiting for socket to open...");
      try {
        await socketOpenPromise;
        console.log("✅ Socket connection ready (via open event)");
      } catch (err: any) {
        // Fallback: try tillSocketOpen() if our promise fails
        console.log("⚠️ Open event promise failed, trying tillSocketOpen()...");
        try {
          await socket.tillSocketOpen();
          console.log("✅ Socket connection ready (via tillSocketOpen)");
        } catch (tillErr: any) {
          console.error("❌ Both socket open methods failed:", tillErr);
          throw new Error(
            `Socket failed to open: ${err.message || tillErr.message}`
          );
        }
      }

      // Verify socket is actually open before starting audio capture
      // @ts-ignore - readyState exists on the socket
      const socketState = socket.readyState;
      console.log("📊 Socket readyState:", socketState, "(1 = OPEN)");

      if (socketState !== 1) {
        console.error("❌ Socket not open! State:", socketState);
        throw new Error(`Socket not open (state: ${socketState})`);
      }

      // Small delay to ensure socket is fully ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // If MediaRecorder was already started (iOS PWA), just verify it's running
      // Otherwise, start it now
      if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log("✅ MediaRecorder already running (started early for iOS PWA)");
      } else {
        // Start audio capture (non-iOS or fallback)
      await startAudioCapture();
      }

      // Connection is complete
      isConnecting = false;

      console.log(
        "🎙️ Hume voice call started - bidirectional communication should be active"
      );
    } catch (err: any) {
      console.error("Failed to start Hume voice:", err);
      lastResponse = `Error: ${err.message || "Failed to start voice call"}`;
      isConnected = false;
      isRecording = false;
      isConnecting = false;
      isWaitingForPermission = false;
      
      // Clean up window references if socket connection failed (memory leak fix)
      if ((window as any).__sendQueuedAudioChunks) {
        delete (window as any).__sendQueuedAudioChunks;
      }
      if ((window as any).__audioChunkQueue) {
        const queue = (window as any).__audioChunkQueue;
        if (Array.isArray(queue)) {
          queue.length = 0;
        }
        delete (window as any).__audioChunkQueue;
      }
      
      // Clean up resources
      cleanupCall();
    }
  }

  /**
   * Check if microphone permission is already granted
   * Returns true if granted, false if not granted or unknown
   * Uses multiple strategies for maximum compatibility (especially iOS)
   */
  async function checkMicrophonePermission(): Promise<boolean> {
    if (!browser || !navigator.mediaDevices) {
      return false;
    }

    // Strategy 1: Use Permissions API if available (Chrome, Firefox, etc.)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        const isGranted = permissionStatus.state === "granted";
        console.log(
          "🎤 Microphone permission status (Permissions API):",
          permissionStatus.state
        );
        if (isGranted) {
          return true; // Definitely granted
        }
        if (permissionStatus.state === "denied") {
          return false; // Definitely denied - don't ask again
        }
        // If "prompt", continue to Strategy 2
      } catch (permErr) {
        // Permissions API not supported (e.g., Safari/iOS) - continue to Strategy 2
        console.log("ℹ️ Permissions API not available, using fallback check");
      }
    }

    // Strategy 2: Try to get a stream without user interaction (silent check)
    // This works on iOS/Safari where Permissions API isn't available
    // If permission is already granted, getUserMedia succeeds immediately without prompt
    try {
      // Use a very short-lived stream just to check permission
      const testStream = await acquireAudioStream();

      // If we got here without a prompt, permission was already granted
      // Clean up immediately
      testStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      });

      console.log(
        "✅ Microphone permission already granted (silent check succeeded)"
      );
      return true;
    } catch (err: any) {
      // If getUserMedia fails, permission is either denied or not yet granted
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        console.log("❌ Microphone permission denied");
        return false; // Permission denied - don't ask again
      }
      // Other errors (NotFoundError, etc.) - assume not granted yet
      console.log("ℹ️ Microphone permission status unclear:", err.name);
      return false;
    }
  }

  /**
   * Request microphone permission explicitly (required for iOS PWAs)
   * Returns the stream if it's still active, or null if we need to get a new one
   * Uses event-based validation instead of timeouts for robustness
   */
  async function requestMicrophonePermission(): Promise<MediaStream | null> {
    if (!browser || !navigator.mediaDevices) {
      console.error("❌ MediaDevices API not available");
      return null;
    }

    try {
      // First, check if permission is already granted
      const alreadyGranted = await checkMicrophonePermission();
      if (alreadyGranted) {
        console.log(
          "✅ Microphone permission already granted - will get fresh stream when needed"
        );
        return null; // Return null to indicate we should get a fresh stream (no prompt needed)
      }

      // Permission not granted yet - we need to request it
      // This will show the permission prompt to the user
      console.log("🔄 Requesting microphone permission (showing prompt)...");

      try {
        // Request permission - this will show the prompt on iOS/other browsers
      const stream = await acquireAudioStream();

        // Verify the stream is actually active
        const tracks = stream.getAudioTracks();
        const hasActiveTrack =
          tracks.length > 0 &&
          tracks.some((t) => t.readyState === "live" && !t.muted);

        if (!hasActiveTrack) {
          console.log(
            "⚠️ Stream obtained but no active tracks - iOS may have ended it"
          );
          // Clean up the stream
          tracks.forEach((track) => {
            try {
              if (track.readyState === "live") track.stop();
            } catch (e) {
              // Ignore - track may already be ended
            }
          });
          return null; // Need to get a fresh stream
        }

        // Verify permission is actually granted
        const permissionGranted = await checkMicrophonePermission();
        if (!permissionGranted) {
          console.log(
            "⚠️ getUserMedia succeeded but permission not granted yet"
          );
          // Wait a bit for permission to propagate (iOS can be slow)
          await new Promise((resolve) => setTimeout(resolve, 200));
          const recheckGranted = await checkMicrophonePermission();
          if (!recheckGranted) {
            // Still not granted - clean up and return null
            tracks.forEach((track) => {
              try {
                if (track.readyState === "live") track.stop();
              } catch (e) {
                // Ignore
              }
            });
            return null;
          }
        }

        // Stream is active and permission is granted - we can use this stream!
        console.log(
          "✅ Microphone permission granted - stream is active and ready"
        );
        return stream; // Return the active stream for reuse
      } catch (getUserMediaErr: any) {
        // getUserMedia failed - permission denied or other error
        console.error("❌ getUserMedia failed:", getUserMediaErr);

        if (
          getUserMediaErr.name === "NotAllowedError" ||
          getUserMediaErr.name === "PermissionDeniedError"
        ) {
          lastResponse =
            "Microphone permission denied. Please enable microphone access in your browser settings.";
          return null;
        } else if (
          getUserMediaErr.name === "NotFoundError" ||
          getUserMediaErr.name === "DevicesNotFoundError"
        ) {
          lastResponse =
            "No microphone found. Please connect a microphone and try again.";
          return null;
        } else {
          lastResponse = `Failed to access microphone: ${
            getUserMediaErr.message || "Unknown error"
          }`;
          return null;
        }
      }
    } catch (err: any) {
      console.error("❌ Failed to request microphone permission:", err);
      lastResponse = `Failed to access microphone: ${
        err.message || "Unknown error"
      }`;
      return null;
    }
  }

  async function startAudioCapture() {
    if (!browser) {
      console.error("❌ startAudioCapture: Not in browser");
      return;
    }

    try {
      console.log("🎤 Starting audio capture...");

      // Permission should already be granted (requested earlier in startCall)
      if (!navigator.mediaDevices) {
        throw new Error("MediaDevices API not available");
      }

      // CRITICAL for iOS: NEVER get a new stream - always reuse the existing one!
      // Getting a new stream causes iOS to close the original mic permission
      if (audioStream && audioStream.active) {
        const tracks = audioStream.getAudioTracks();
        const hasActiveTrack = tracks.some(
          (t) => t.readyState === "live" && !t.muted
        );

        if (hasActiveTrack) {
          console.log("✅ Using existing active audio stream (keeping mic alive)");
          // Stream is already set - just continue to use it
        } else {
          console.log("⚠️ Stream tracks ended - iOS closed the mic");
          console.log("🔄 Attempting to get fresh stream (may require re-permission)...");
          audioStream = await getAudioStream();
        }
      } else {
        console.log("⚠️ No active stream - this shouldn't happen!");
        console.log("🔄 Getting audio stream as fallback...");
        audioStream = await getAudioStream();
      }

      console.log("✅ Audio stream ready for capture");

      // Validate the stream has a valid audio track
      ensureSingleValidAudioTrack(audioStream);
      console.log("✅ Audio track validated");

      // Determine supported MIME type
      const mimeTypeResult = getBrowserSupportedMimeType();
      const mimeType = mimeTypeResult.success
        ? mimeTypeResult.mimeType
        : "audio/webm";

      if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log("🎤 MediaRecorder already running (startAudioCapture bypass)");
        return;
      }

      console.log("🎤 Using MIME type:", mimeType);

      // Create media recorder
      mediaRecorder = new MediaRecorder(audioStream, { mimeType });

      // Track audio chunks sent for debugging
      let audioChunksSent = 0;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size < 1) {
          console.log("ℹ️ Empty audio chunk received, skipping");
          return;
        }

        // Check socket is actually open (as per Hume docs)
        // @ts-ignore - readyState exists on the socket
        if (!socket) {
          console.warn("⚠️ Socket not initialized, skipping audio chunk");
          return;
        }

        // @ts-ignore - readyState exists on the socket
        const socketReady = socket.readyState === 1; // WebSocket.OPEN = 1
        if (!socketReady) {
          console.warn(
            "⚠️ Socket not open (state:",
            socket.readyState,
            "), skipping audio chunk"
          );
          return;
        }

        try {
          const encodedAudioData = await convertBlobToBase64(event.data);
          socket.sendAudioInput({ data: encodedAudioData });
          audioChunksSent++;
          // Removed excessive logging - audio chunks are being sent successfully
        } catch (err: any) {
          console.error("❌ Error sending audio:", err);
          // If socket error, stop trying to send
          if (
            err.message?.includes("not open") ||
            err.message?.includes("Socket")
          ) {
            console.warn("⚠️ Socket closed, stopping audio capture");
            isConnected = false;
            if (mediaRecorder && mediaRecorder.state === "recording") {
              mediaRecorder.stop();
            }
          }
        }
      };

      // Send audio chunks every 50ms for lower latency (was 100ms)
      // Smaller intervals reduce delay between speech and response
      console.log("🔄 Starting MediaRecorder...");
      console.log("📊 Pre-start state:", {
        socketExists: !!socket,
        socketReady: socket ? (socket as any).readyState : "N/A",
        streamActive: audioStream.active,
        tracksCount: audioStream.getTracks().length,
      });

      mediaRecorder.start(50);

      // Set recording state BEFORE logging to ensure UI updates
      isRecording = true;
      // isExpanded is now derived from isRecording || isConnected, so no need to set it here

      console.log(
        "✅ Recording started - isRecording:",
        isRecording,
        "isConnected:",
        isConnected
      );
      console.log("📊 Post-start state:", {
        mediaRecorderState: mediaRecorder.state,
        socketReady: socket ? (socket as any).readyState : "N/A",
        streamActive: audioStream.active,
      });

      // Verify recording state and audio track status
      if (mediaRecorder.state === "recording") {
        console.log("✅ MediaRecorder confirmed in 'recording' state");
      } else {
        console.warn(
          "⚠️ MediaRecorder state:",
          mediaRecorder.state,
          "(expected 'recording')"
        );
      }

      // Verify audio track is active and sending data
      const audioTracks = audioStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        console.log("🎤 Audio track status:", {
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          label: track.label,
        });

        // Monitor track state changes
        track.onended = () => {
          console.warn("⚠️ Audio track ended unexpectedly");
          if (isRecording) {
            console.log("🔄 Attempting to restart audio capture...");
            // Try to restart if we're still supposed to be recording
            setTimeout(() => {
              if (isRecording && isConnected) {
                startAudioCapture().catch((err) => {
                  console.error("❌ Failed to restart audio capture:", err);
                });
              }
            }, 1000);
          }
        };

        track.onmute = () => {
          console.warn("⚠️ Audio track muted");
        };

        track.onunmute = () => {
          console.log("✅ Audio track unmuted");
        };
      } else {
        console.error("❌ No audio tracks found in stream!");
      }

      // Verify audio player is ready for output
      if (audioPlayer) {
        console.log(
          "🔊 Audio player ready for output (bidirectional communication enabled)"
        );
      } else {
        console.warn(
          "⚠️ Audio player not initialized - audio output may not work"
        );
      }

      console.log(
        "🎙️ Bidirectional voice call active - ready to speak and listen"
      );
    } catch (err: any) {
      console.error("❌ Failed to start audio capture:", err);
      console.error("Error details:", err.name, err.message, err.stack);
      isRecording = false;
      isConnected = false;
      lastResponse = `Failed to start audio: ${err.message || "Unknown error"}`;

      // Clean up on error
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
        audioStream = null;
      }
    }
  }

  /**
   * Clean up resources and close modal
   * Called when connection closes or errors
   */
  function cleanupCall() {
    // Clean up window references for queued audio chunks (memory leak fix)
    if ((window as any).__sendQueuedAudioChunks) {
      delete (window as any).__sendQueuedAudioChunks;
    }
    if ((window as any).__audioChunkQueue) {
      // Clear the queue array to free memory
      const queue = (window as any).__audioChunkQueue;
      if (Array.isArray(queue)) {
        queue.length = 0;
      }
      delete (window as any).__audioChunkQueue;
    }

    // Stop media recorder
    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch (err) {
        console.error("Error stopping media recorder:", err);
      }
    }

    // Stop audio stream tracks
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      audioStream = null;
    }

    if (micMonitor) {
      try {
        micMonitor.srcObject = null;
        if (micMonitor.parentElement) {
          micMonitor.parentElement.removeChild(micMonitor);
        }
      } catch (err) {
        console.warn("⚠️ Failed to clean up mic monitor element:", (err as Error).message);
      }
      micMonitor = null;
    }

    if (micSourceNode) {
      try {
        micSourceNode.disconnect();
      } catch (err) {
        console.warn(
          "⚠️ Failed to disconnect mic source node:",
          (err as Error).message
        );
      }
      micSourceNode = null;
    }

    if (micGainNode) {
      try {
        micGainNode.disconnect();
      } catch (err) {
        console.warn(
          "⚠️ Failed to disconnect mic gain node:",
          (err as Error).message
        );
      }
      micGainNode = null;
    }

    if (micAudioContext) {
      try {
        micAudioContext.close();
      } catch (err) {
        console.warn(
          "⚠️ Failed to close mic audio context:",
          (err as Error).message
        );
      }
      micAudioContext = null;
    }

    // Clean up permission stream if it exists
    if (permissionStream) {
      permissionStream.getTracks().forEach((track) => track.stop());
      permissionStream = null;
    }

    // Stop audio player
    if (audioPlayer) {
      try {
        audioPlayer.stop();
      } catch (err) {
        console.error("Error stopping audio player:", err);
      }
      audioPlayer = null;
    }

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

    // Reset store state
    resetVoiceCallState();

    console.log("🧹 Call cleaned up");
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
      console.log("⏹️ Hume voice call stopped by user");
    } catch (err) {
      console.error("Failed to stop Hume voice:", err);
      // Ensure cleanup even on error
      cleanupCall();
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    if (socket || isRecording || isConnected) {
      stopCall();
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
