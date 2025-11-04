#!/usr/bin/env node

/**
 * Development script that orchestrates:
 * 1. Zero migration
 * 2. Vite dev server
 * 3. Localtunnel (after vite is ready, before zero starts)
 * 4. Zero starts automatically via hooks.server.js
 */

import { spawn } from "child_process";
import { setTimeout as sleep } from "timers/promises";

const PORT = process.env.PORT || 5173;
const SUBDOMAIN = "hominio-me";
const VITE_READY_TIMEOUT = 30000; // 30 seconds max wait for vite

let viteProcess = null;
let tunnelProcess = null;

// Helper to check if a port is responding
async function waitForServer(port, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok || response.status === 404) {
        return true;
      }
    } catch (error) {
      // Server not ready yet, wait a bit
      await sleep(500);
    }
  }
  return false;
}

// Start vite dev server
function startVite() {
  console.log("[Dev] Starting Vite dev server...");
  // Use bunx to run vite dev directly
  viteProcess = spawn("bunx", ["vite", "dev"], {
    stdio: "inherit",
    shell: false,
    env: { ...process.env },
  });

  viteProcess.on("error", (error) => {
    console.error("[Dev] Failed to start Vite:", error);
    process.exit(1);
  });

  viteProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[Dev] Vite exited with code ${code}`);
      if (tunnelProcess) {
        tunnelProcess.kill();
      }
      process.exit(code);
    }
  });

  return viteProcess;
}

// Start localtunnel after vite is ready
async function startTunnel() {
  console.log(`[Dev] Waiting for Vite to be ready on port ${PORT}...`);
  const serverReady = await waitForServer(PORT, VITE_READY_TIMEOUT);

  if (!serverReady) {
    console.error(`[Dev] Vite did not become ready within ${VITE_READY_TIMEOUT}ms`);
    if (viteProcess) {
      viteProcess.kill();
    }
    process.exit(1);
  }

  console.log(`[Dev] Vite is ready! Starting localtunnel...`);
  
  // Always try with deterministic subdomain - retry multiple times if needed
  await tryStartTunnelWithRetries();
}

async function tryStartTunnelWithRetries(maxRetries = 5, retryDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      console.log(`[Localtunnel] Retry attempt ${attempt}/${maxRetries} for subdomain: ${SUBDOMAIN}`);
      await sleep(retryDelay);
    }
    
    const success = await tryStartTunnel(true);
    if (success) {
      return; // Success! Exit early
    }
    
    // If tunnel process exists, kill it before retrying
    if (tunnelProcess) {
      tunnelProcess.kill();
      tunnelProcess = null;
    }
  }
  
  console.error(`[Localtunnel] ❌ Failed to establish tunnel with subdomain ${SUBDOMAIN} after ${maxRetries} attempts`);
  console.warn("[Localtunnel] ⚠️  Tunnel failed, but dev server will continue.");
  console.warn("[Localtunnel] 💡 You can manually start a tunnel:");
  console.warn(`[Localtunnel]    lt --port ${PORT} --subdomain ${SUBDOMAIN}`);
}

async function tryStartTunnel(useSubdomain) {
  return new Promise((resolve) => {
    const args = ["--port", PORT.toString()];
    if (useSubdomain) {
      args.push("--subdomain", SUBDOMAIN);
      console.log(`[Localtunnel] Attempting with subdomain: ${SUBDOMAIN}`);
      console.log(`[Localtunnel] URL will be: https://${SUBDOMAIN}.loca.lt`);
    } else {
      console.log(`[Localtunnel] Attempting without subdomain (random URL)`);
    }

    tunnelProcess = spawn("lt", args, {
      stdio: "pipe",
      shell: true,
    });

    // Capture stdout/stderr to detect connection issues and extract URL
    let tunnelOutput = "";
    let tunnelUrl = null;
    let resolved = false;

    tunnelProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      tunnelOutput += output;
      
      // Try to extract URL from output
      const urlMatch = output.match(/https?:\/\/[^\s]+/);
      if (urlMatch && !tunnelUrl) {
        tunnelUrl = urlMatch[0];
        
        // Check if we got the desired subdomain
        if (useSubdomain && tunnelUrl.includes(SUBDOMAIN)) {
          console.log(`\n[Localtunnel] ✅ Tunnel established with subdomain!`);
          console.log(`[Localtunnel] 🌐 Your URL: ${tunnelUrl}`);
          console.log(`[Localtunnel] 📍 Webhook URL: ${tunnelUrl}/api/auth/polar/webhooks\n`);
          if (!resolved) {
            resolved = true;
            resolve(true); // Success!
          }
        } else if (useSubdomain) {
          // Got a URL but not the right subdomain - this is a failure
          console.warn(`\n[Localtunnel] ⚠️  Got URL but wrong subdomain: ${tunnelUrl}`);
          console.warn(`[Localtunnel] Expected: https://${SUBDOMAIN}.loca.lt`);
          if (!resolved) {
            resolved = true;
            resolve(false); // Failed - wrong subdomain
          }
        } else {
          // Random URL is fine
          console.log(`\n[Localtunnel] ✅ Tunnel established!`);
          console.log(`[Localtunnel] 🌐 Your URL: ${tunnelUrl}`);
          console.log(`[Localtunnel] 📍 Webhook URL: ${tunnelUrl}/api/auth/polar/webhooks\n`);
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        }
      }
      
      process.stdout.write(data);
    });

    tunnelProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      tunnelOutput += output;
      process.stderr.write(data);
    });

    tunnelProcess.on("error", (error) => {
      console.error("\n[Localtunnel] Failed to start:", error.message);
      if (!resolved) {
        resolved = true;
        resolve(false); // Failed
      }
      tunnelProcess = null;
    });

    // Check for connection errors after a delay
    const errorCheckTimeout = global.setTimeout(() => {
      if (tunnelProcess && !resolved) {
        if (tunnelOutput.includes("connection refused")) {
          console.error("\n[Localtunnel] ❌ Connection refused - firewall/network issue");
          if (!resolved) {
            resolved = true;
            resolve(false); // Failed
          }
        } else if (tunnelOutput.includes("already allocated")) {
          console.warn("\n[Localtunnel] ⚠️  Subdomain already in use");
          if (!resolved) {
            resolved = true;
            resolve(false); // Failed - will retry
          }
        } else if (tunnelOutput.includes("bad gateway") || tunnelOutput.includes("tunnel failed")) {
          console.error("\n[Localtunnel] ❌ Tunnel failed to establish");
          if (!resolved) {
            resolved = true;
            resolve(false); // Failed
          }
        }
      }
    }, 8000); // Wait 8 seconds to see if tunnel establishes

    tunnelProcess.on("exit", (code) => {
      clearTimeout(errorCheckTimeout);
      if (!resolved) {
        resolved = true;
        // If we got a URL before exit, it was successful
        if (tunnelUrl && (!useSubdomain || tunnelUrl.includes(SUBDOMAIN))) {
          resolve(true);
        } else {
          resolve(false); // Failed
        }
      }
    });
  });
}

// Handle termination signals
function setupSignalHandlers() {
  const shutdown = () => {
    console.log("\n[Dev] Shutting down...");
    if (tunnelProcess) {
      tunnelProcess.kill();
    }
    if (viteProcess) {
      viteProcess.kill();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Main execution
async function main() {
  setupSignalHandlers();

  // Step 1: Run zero migration
  console.log("[Dev] Running Zero migration...");
  const migrateProcess = spawn("bun", ["run", "zero:migrate"], {
    stdio: "inherit",
    shell: true, // Required for bun run commands
    env: { ...process.env },
  });

  await new Promise((resolve, reject) => {
    migrateProcess.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Migration failed with code ${code}`));
      }
    });
    migrateProcess.on("error", (error) => {
      reject(error);
    });
  });

  // Step 2: Start Vite
  startVite();

  // Step 3: Start tunnel after vite is ready (before zero starts in hooks.server.js)
  // Give vite a moment to start, then start tunnel
  sleep(2000).then(() => {
    startTunnel().catch((error) => {
      console.error("[Dev] Failed to start tunnel:", error);
      // Don't exit - vite can run without tunnel
    });
  });
}

main().catch((error) => {
  console.error("[Dev] Fatal error:", error);
  process.exit(1);
});

