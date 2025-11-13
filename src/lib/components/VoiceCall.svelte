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
  let audioRecorder: AudioRecorder | null = null;
  let audioStreamer: AudioStreamer | null = null;
  let audioChunkQueue: string[] = []; // Queue for base64 audio chunks until socket is ready
  let humeReady: boolean = false; // Track if Hume has sent a ready/setup_complete message

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
        isWaitingForPermission = false;
        return;
      }

      // Request microphone permission FIRST (before anything else)
      // This is critical for iOS PWAs - permission must be requested early
      // AND we must start using it immediately or iOS will close it!
      console.log("🎤 Requesting microphone permission...");

      // OPTIMIZED: Use MediaRecorder for WebM/Opus format + AudioWorklet to keep stream alive in iOS PWA
      // MediaRecorder gives us the exact same format as before (WebM/Opus)
      // AudioWorklet runs in parallel to keep the stream alive in iOS PWA standalone mode
      let mediaRecorder: MediaRecorder | null = null;
      let mediaStream: MediaStream | null = null;

      try {
        // Get microphone stream
        // CRITICAL iOS PWA FIX: Request AUDIO ONLY with minimal constraints
        // The video workaround doesn't work in iOS PWA standalone mode (WKWebView)
        // Based on Chad Phillips' Safari WebRTC guide: use simple constraints
        const isIOSPWA = (window.navigator as any).standalone === true;
        console.log(`📱 iOS PWA mode: ${isIOSPWA}`);
        
        const mediaConstraints = isIOSPWA
          ? {
              // iOS PWA: Minimal audio-only constraints (WKWebView requirement)
              audio: true,
            }
          : {
              // Full audio constraints for other browsers
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            };
        
        mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        console.log("✅ MediaStream obtained, track state:", mediaStream.getAudioTracks()[0]?.readyState);

        // Use MediaRecorder for ALL platforms (iOS PWA workaround makes it work)
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

        console.log("🎤 Using MediaRecorder (WebM/Opus), MIME type:", selectedMimeType);

        // Create MediaRecorder on the mic stream (WebM/Opus format)
        mediaRecorder = new MediaRecorder(mediaStream, {
          mimeType: selectedMimeType,
        });

        // Track chunk statistics
        let chunkCount = 0;
        let totalBytesSent = 0;
        let firstChunkTime = 0;

        // Handle MediaRecorder data (WebM/Opus format)
        mediaRecorder.ondataavailable = async (event: BlobEvent) => {
          if (event.data.size === 0) {
            console.warn("⚠️ Empty audio chunk received");
            return;
          }

          chunkCount++;
          const chunkTime = Date.now();

          // Convert Blob to base64 (exactly like MediaRecorder implementation)
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 =
                (reader.result as string).split(",")[1] ||
                (reader.result as string);
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(event.data);
          });

          // Detailed logging for first few chunks (like MediaRecorder)
          if (chunkCount <= 5) {
            const blobSize = event.data.size;
            const base64Length = base64Data.length;
            const audioTrack = mediaStream?.getAudioTracks()[0];
            const settings = audioTrack?.getSettings();

            console.log(`📊 MediaRecorder Chunk #${chunkCount}:`, {
              blobSize,
              base64Length,
              mimeType: event.data.type,
              sampleRate: settings?.sampleRate,
              channelCount: settings?.channelCount,
              duration: chunkTime - (firstChunkTime || chunkTime),
              firstChunk: chunkCount === 1,
            });

            // Log first chunk in detail
            if (chunkCount === 1) {
              firstChunkTime = chunkTime;
              // Try to decode and analyze the blob
              const arrayBuffer = await event.data.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              console.log("📊 First chunk binary analysis:", {
                arrayBufferSize: arrayBuffer.byteLength,
                uint8ArrayLength: uint8Array.length,
                firstBytes: Array.from(uint8Array.slice(0, 20)),
                lastBytes: Array.from(uint8Array.slice(-20)),
                // Check if it's WebM (starts with 0x1A 0x45 0xDF 0xA3)
                isWebM:
                  uint8Array[0] === 0x1a &&
                  uint8Array[1] === 0x45 &&
                  uint8Array[2] === 0xdf &&
                  uint8Array[3] === 0xa3,
                // Check if it's OGG (starts with "OggS")
                isOGG:
                  uint8Array[0] === 0x4f &&
                  uint8Array[1] === 0x67 &&
                  uint8Array[2] === 0x67 &&
                  uint8Array[3] === 0x53,
              });
            }
          }

          totalBytesSent += base64Data.length;

          // Send to socket if ready (no rate limiting - MediaRecorder handles timing)
          const currentSocket = socket;
          const socketReady =
            currentSocket && (currentSocket as any).readyState === 1;

          if (socketReady) {
            try {
              // Log every 20th chunk to verify streaming
              if (chunkCount % 20 === 0) {
                console.log(
                  `📤 Sending MediaRecorder chunk #${chunkCount} (${base64Data.length} bytes base64)`
                );
              }
              currentSocket.sendAudioInput({
                data: base64Data,
              });
            } catch (err: any) {
              console.error("❌ Error sending MediaRecorder audio:", err);
            }
          } else {
            // Queue for later
            audioChunkQueue.push(base64Data);
            if (audioChunkQueue.length === 1) {
              console.log("📥 MediaRecorder chunk queued (socket not ready)");
            }
          }
        };

        mediaRecorder.onerror = (event: any) => {
          console.error("❌ MediaRecorder error:", event);
        };

        mediaRecorder.onstart = () => {
          console.log("✅ MediaRecorder started");
          isRecording = true;
        };

        mediaRecorder.onstop = () => {
          console.log("⏹️ MediaRecorder stopped");
          console.log(
            `📊 Total chunks: ${chunkCount}, Total bytes sent: ${totalBytesSent}`
          );
          isRecording = false;
        };

        // Start MediaRecorder immediately
        mediaRecorder.start(100);
        console.log("✅ MediaRecorder started with 100ms timeslice");

        // CRITICAL iOS PWA FIX: Initialize AudioContext NOW (same user gesture as getUserMedia)
        // iOS PWA won't allow AudioContext creation later if microphone is already active
        // Safari allows lazy init, but iOS PWA requires both in same user gesture
        if (!audioStreamer) {
          console.log("🔊 Pre-initializing AudioStreamer (iOS PWA requires same user gesture as mic)");
          try {
            const ctx = await audioContext({
              id: "voice-call-playback",
            });
            audioStreamer = new AudioStreamer(ctx);
            console.log(`✅ AudioStreamer pre-initialized with sample rate: ${ctx.sampleRate}Hz`);
          } catch (streamerErr: any) {
            console.error("❌ Failed to pre-initialize AudioStreamer:", streamerErr);
            // Continue - will try again later if needed
          }
        }

        // Store references for cleanup
        (window as any).__mediaRecorder = mediaRecorder;
        (window as any).__mediaStream = mediaStream;

        // Store function to send queued chunks when socket opens
        (window as any).__sendQueuedAudioChunks = async () => {
          const currentSocket = socket;
          if (!currentSocket || (currentSocket as any).readyState !== 1) {
            return;
          }

          console.log(
            `📤 Sending ${audioChunkQueue.length} queued MediaRecorder chunks`
          );
          let sentCount = 0;
          while (audioChunkQueue.length > 0) {
            const chunk = audioChunkQueue.shift();
            if (
              chunk &&
              currentSocket &&
              (currentSocket as any).readyState === 1
            ) {
              try {
                currentSocket.sendAudioInput({
                  data: chunk,
                });
                sentCount++;
              } catch (err: any) {
                console.error("❌ Error sending queued audio:", err);
                break;
              }
            } else {
              break;
            }
          }
          console.log(`✅ Sent ${sentCount} queued MediaRecorder chunks`);
        };

        isWaitingForPermission = false;
      } catch (permissionErr: any) {
        console.error("❌ Microphone permission denied:", permissionErr);
        isWaitingForPermission = false;
        lastResponse =
          "Microphone permission is required to start a voice call.";
        isConnecting = false;
        return;
      }

      // Initialize AudioStreamer for playback (lazy initialization when audio arrives)
      // AudioStreamer uses the same AudioContext pattern as AudioRecorder, compatible with iOS PWA
      audioStreamer = null; // Will be initialized when first audio arrives

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

          // Mark as ready immediately when socket opens
          // Hume EVI expects audio to be sent immediately after connection
          // The I0100 error might be caused by not sending audio quickly enough
          console.log(
            "✅ Marking Hume as ready immediately on socket open - sending audio right away"
          );
          humeReady = true;

          // Note: Session settings might not be required for EVI v3
          // The SDK handles audio format automatically based on sendAudioInput format
          // If needed, session settings would be sent via sendSessionSettings with different syntax
          // But for now, we'll skip it since the error suggests it's not the right format

          // If MediaRecorder was started early, send queued chunks immediately
          const currentMediaRecorder = (window as any).__mediaRecorder;
          if (currentMediaRecorder) {
            console.log(
              "🔄 Socket ready - MediaRecorder is running, sending queued chunks"
            );

            // Send any queued chunks
            if (audioChunkQueue.length > 0) {
              if ((window as any).__sendQueuedAudioChunks) {
                await (window as any).__sendQueuedAudioChunks();
              }
            }

            // MediaRecorder will continue sending chunks via ondataavailable handler
            // WebM/Opus format - exact same as MediaRecorder!
            console.log(
              "✅ MediaRecorder is streaming - chunks will be sent automatically (WebM/Opus format)"
            );
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
          // Log all message types for debugging (except audio_output to avoid spam)
          if (message.type && !["audio_output"].includes(message.type)) {
            console.log(`📨 Received message type: ${message.type}`, message);
          }

          // Handle error messages from Hume
          if (message.type === "error" || message.error) {
            console.error("❌ Hume server error:", message.error || message);
            console.error(
              "Error message details:",
              JSON.stringify(message, null, 2)
            );
            // Don't cleanup immediately - let the close handler do it
            // This allows us to see if there are multiple errors
          }

          // Handle setup_complete or ready messages - Hume is ready to receive audio
          if (
            message.type === "setup_complete" ||
            message.type === "ready" ||
            message.type === "session_started"
          ) {
            console.log("✅ Hume session ready - audio input can now be sent");
            humeReady = true;

            // Now that Hume is ready, send any queued audio chunks
            if (
              audioChunkQueue.length > 0 &&
              socket &&
              (socket as any).readyState === 1
            ) {
              console.log(
                `📤 Sending ${audioChunkQueue.length} queued audio chunks now that Hume is ready`
              );
              while (audioChunkQueue.length > 0) {
                const chunk = audioChunkQueue.shift();
                if (chunk) {
                  try {
                    socket.sendAudioInput({ data: chunk });
                  } catch (err: any) {
                    console.error("❌ Error sending queued audio:", err);
                    break;
                  }
                }
              }
            }

            // Now that Hume is ready, start sending audio if AudioRecorder is running
            if (audioRecorder && audioRecorder.recording) {
              console.log(
                "🎤 AudioRecorder is running - audio will now be sent to Hume"
              );
            }
          }

          // Handle user interruptions - stop audio playback immediately for low latency
          // According to Hume docs: EVI "stops rapidly whenever users interject"
          // https://dev.hume.ai/docs/speech-to-speech-evi/overview
          if (message.type === "user_interruption" && audioStreamer) {
            console.log(
              "🛑 User interruption detected, stopping audio playback immediately"
            );
            // Stop audio playback immediately for responsive interruption handling
            audioStreamer.stop();
            // Clear any queued audio to prevent delayed playback after interruption
            // This ensures EVI can respond immediately to the user's interjection
          }

          // Handle audio output - use AudioStreamer for smooth playback
          // AudioStreamer uses AudioWorklet and is compatible with iOS PWA
          if (message.type === "audio_output") {
            // Lazy initialize AudioStreamer if it wasn't initialized earlier
            if (!audioStreamer) {
              console.error("❌ AudioStreamer not initialized - audio playback unavailable");
              console.log("💡 Tip: AudioStreamer must be pre-initialized in same user gesture as mic (iOS PWA requirement)");
              // Continue without audio streamer - user won't hear audio but call can continue
              return;
            }

            console.log("🔊 Received audio output from AI");

            try {
              // Hume's audio_output message likely contains encoded audio (Opus/WebM)
              // EVIWebAudioPlayer was decoding it - we need to decode it ourselves
              // The message structure from Hume SDK: { type: "audio_output", ... }
              // The actual audio data might be in message.data as a Blob or ArrayBuffer

              const audioData =
                message.data || message.audio || message.payload;

              if (!audioData) {
                console.warn(
                  "⚠️ No audio data found in message:",
                  Object.keys(message)
                );
                return;
              }

              // If it's already a Blob, decode it directly
              if (audioData instanceof Blob) {
                console.log("📊 Audio is Blob, decoding...");
                audioStreamer.addEncodedAudio(audioData).catch((err: any) => {
                  console.error("❌ Error decoding blob audio:", err);
                });
              }
              // If it's a base64 string, convert to Blob first
              else if (typeof audioData === "string") {
                console.log("📊 Audio is base64 string, converting to Blob...");
                try {
                  const binaryString = atob(audioData);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  // Assume it's WebM/Opus format (Hume's default)
                  const blob = new Blob([bytes], {
                    type: "audio/webm;codecs=opus",
                  });
                  audioStreamer.addEncodedAudio(blob).catch((err: any) => {
                    console.error("❌ Error decoding base64 audio:", err);
                    // Fallback: try as PCM16 if WebM decode fails
                    console.log("🔄 Fallback: trying as PCM16...");
                    audioStreamer.addPCM16(audioData);
                  });
                } catch (decodeErr: any) {
                  console.error(
                    "❌ Error converting base64 to Blob:",
                    decodeErr
                  );
                }
              }
              // If it's an ArrayBuffer, convert to Blob
              else if (audioData instanceof ArrayBuffer) {
                console.log("📊 Audio is ArrayBuffer, converting to Blob...");
                const blob = new Blob([audioData], {
                  type: "audio/webm;codecs=opus",
                });
                audioStreamer.addEncodedAudio(blob).catch((err: any) => {
                  console.error("❌ Error decoding ArrayBuffer audio:", err);
                });
              } else {
                console.warn("⚠️ Unknown audio format:", {
                  type: typeof audioData,
                  constructor: audioData?.constructor?.name,
                });
              }
            } catch (err: any) {
              console.error("❌ Error processing audio output:", err);
              console.error("Error details:", err.message, err.stack);
            }
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
        console.log("📊 Current state when closing:", {
          isRecording,
          isConnected,
          audioRecorderActive: audioRecorder?.recording,
          audioChunksQueued: audioChunkQueue.length,
        });
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

      // MediaRecorder should already be running (started early)
      const currentMediaRecorder = (window as any).__mediaRecorder;
      if (currentMediaRecorder && currentMediaRecorder.state === "recording") {
        console.log("✅ MediaRecorder already running (started early)");
      } else {
        console.warn("⚠️ MediaRecorder not running - this shouldn't happen");
      }

      // AudioRecorder (AudioWorklet) should also be running to keep stream alive in iOS PWA
      if (audioRecorder && audioRecorder.recording) {
        console.log(
          "✅ AudioRecorder (AudioWorklet) running to keep stream alive in iOS PWA"
        );
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
      const testStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

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

  /**
   * Clean up resources and close modal
   * Called when connection closes or errors
   */
  function cleanupCall() {
    // Clean up window references for queued audio chunks (memory leak fix)
    if ((window as any).__sendQueuedAudioChunks) {
      delete (window as any).__sendQueuedAudioChunks;
    }

    audioChunkQueue = [];

    // Stop MediaRecorder (WebM/Opus recording)
    const mediaRecorder = (window as any).__mediaRecorder;
    const mediaStream = (window as any).__mediaStream;
    if (mediaRecorder) {
      try {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
          console.log("✅ MediaRecorder stopped");
        }
      } catch (err) {
        console.error("Error stopping MediaRecorder:", err);
      }
      delete (window as any).__mediaRecorder;
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((track: MediaStreamTrack) => {
          track.stop();
        });
        console.log("✅ MediaStream tracks stopped");
      } catch (err) {
        console.error("Error stopping MediaStream tracks:", err);
      }
      delete (window as any).__mediaStream;
    }

    // Stop AudioRecorder (AudioWorklet - keeps stream alive in iOS PWA)
    if (audioRecorder) {
      try {
        audioRecorder.stop();
        console.log("✅ AudioRecorder (AudioWorklet) stopped");
      } catch (err) {
        console.error("Error stopping AudioRecorder:", err);
      }
      audioRecorder = null;
    }

    // Stop AudioStreamer
    if (audioStreamer) {
      try {
        audioStreamer.stop();
      } catch (err) {
        console.error("Error stopping AudioStreamer:", err);
      }
      audioStreamer = null;
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
    humeReady = false; // Reset Hume ready state

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
