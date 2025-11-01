import { spawn, type ChildProcess } from 'child_process';
import { env } from '$env/dynamic/private';

let zeroProcess: ChildProcess | null = null;
let isStarting = false;
let shouldAutoRestart = true;
let restartAttempts = 0;
let restartTimeout: NodeJS.Timeout | null = null;
const MAX_RESTART_ATTEMPTS = 5;
const INITIAL_RESTART_DELAY = 2000; // 2 seconds

/**
 * Start the zero-cache process
 * Only starts once, safe to call multiple times
 */
export function startZero(): void {
    // Already running or starting
    if (zeroProcess || isStarting) {
        return;
    }

    isStarting = true;

    // Get environment variables from SvelteKit (read at runtime, not build time)
    const DATABASE_URL = env.SECRET_ZERO_DEV_PG;
    const ZERO_AUTH_SECRET = env.SECRET_ZERO_AUTH_SECRET;

    if (!DATABASE_URL) {
        console.error("❌ [Zero] SECRET_ZERO_DEV_PG environment variable is required");
        isStarting = false;
        return;
    }

    if (!ZERO_AUTH_SECRET) {
        console.error("❌ [Zero] SECRET_ZERO_AUTH_SECRET environment variable is required");
        isStarting = false;
        return;
    }

    console.log("🚀 [Zero] Starting zero-cache server...");

    // Spawn zero-cache-dev process
    zeroProcess = spawn(
        'zero-cache-dev',
        ['--schema-path=./src/zero-schema.ts'],
        {
            env: {
                ...process.env, // Include all env vars for the child process
                ZERO_UPSTREAM_DB: DATABASE_URL,
                ZERO_REPLICA_FILE: './zero-replica.db',
                ZERO_AUTH_SECRET: ZERO_AUTH_SECRET,
                // Also set these for compatibility
                SECRET_ZERO_DEV_PG: DATABASE_URL,
                SECRET_ZERO_AUTH_SECRET: ZERO_AUTH_SECRET,
            },
            stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
        }
    );

    // Handle stdout (prefix with [Zero])
    zeroProcess.stdout?.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
            console.log(`[Zero] ${line}`);
        });
    });

    // Handle stderr (prefix with [Zero ERROR])
    zeroProcess.stderr?.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
            console.error(`[Zero ERROR] ${line}`);
        });
    });

    // Handle process exit
    zeroProcess.on('exit', (code, signal) => {
        if (code !== null) {
            console.log(`[Zero] Process exited with code ${code}`);
        } else if (signal !== null) {
            console.log(`[Zero] Process killed by signal ${signal}`);
        }
        
        const currentProcess = zeroProcess;
        zeroProcess = null;
        isStarting = false;
        
        // Auto-restart on unexpected exit (only if shouldAutoRestart is true)
        if (shouldAutoRestart && currentProcess && code !== 0 && code !== null) {
            if (restartAttempts < MAX_RESTART_ATTEMPTS) {
                restartAttempts++;
                const delay = INITIAL_RESTART_DELAY * Math.pow(2, restartAttempts - 1); // Exponential backoff
                console.log(`[Zero] Will attempt to restart in ${delay}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
                
                restartTimeout = setTimeout(() => {
                    console.log(`[Zero] Attempting to restart zero-cache...`);
                    startZero();
                }, delay);
            } else {
                console.error(`[Zero] Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Stopping auto-restart.`);
                shouldAutoRestart = false;
            }
        } else if (code === 0) {
            // Successful exit, reset restart attempts
            restartAttempts = 0;
        }
    });

    // Handle process errors
    zeroProcess.on('error', (error) => {
        console.error(`[Zero] Failed to start:`, error);
        zeroProcess = null;
        isStarting = false;
    });

    // Mark as started after a short delay
    setTimeout(() => {
        if (zeroProcess) {
            console.log("✅ [Zero] Server started successfully on port 4848");
            isStarting = false;
            // Reset restart attempts on successful start
            restartAttempts = 0;
        }
    }, 1000);
}

/**
 * Stop the zero-cache process
 */
export function stopZero(): void {
    if (!zeroProcess) {
        return;
    }

    console.log("🛑 [Zero] Stopping zero-cache server...");
    
    // Disable auto-restart when explicitly stopping
    shouldAutoRestart = false;
    
    // Clear any pending restart timeout
    if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
    }

    try {
        zeroProcess.kill('SIGTERM');

        // Force kill after 5 seconds if not stopped
        setTimeout(() => {
            if (zeroProcess) {
                console.log("⚠️ [Zero] Force killing process...");
                zeroProcess.kill('SIGKILL');
            }
        }, 5000);
    } catch (error) {
        console.error("[Zero] Error stopping process:", error);
    }

    zeroProcess = null;
    restartAttempts = 0;
}

/**
 * Check if Zero is running
 */
export function isZeroRunning(): boolean {
    return zeroProcess !== null && !isStarting;
}

