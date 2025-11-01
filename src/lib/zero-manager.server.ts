import { spawn, type ChildProcess } from 'child_process';
import { env } from '$env/dynamic/private';

let zeroProcess: ChildProcess | null = null;
let isStarting = false;
let shouldAutoRestart = true;
let restartAttempts = 0;
let restartTimeout: NodeJS.Timeout | null = null;
let lastError: string | null = null;
const MAX_RESTART_ATTEMPTS = 10; // Increased for production resilience
const INITIAL_RESTART_DELAY = 2000; // 2 seconds
const MAX_RESTART_DELAY = 30000; // Max 30 seconds delay

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

    // Enhance database URL with connection pooling and timeout settings
    // This helps with high latency connections
    const enhancedDbUrl = enhanceDatabaseUrl(DATABASE_URL);

    console.log("🚀 [Zero] Starting zero-cache server...");
    if (restartAttempts > 0) {
        console.log(`[Zero] Restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`);
        if (lastError) {
            console.log(`[Zero] Previous error: ${lastError}`);
        }
    }

    // Spawn zero-cache-dev process
    zeroProcess = spawn(
        'zero-cache-dev',
        ['--schema-path=./src/zero-schema.ts'],
        {
            env: {
                ...process.env, // Include all env vars for the child process
                ZERO_UPSTREAM_DB: enhancedDbUrl,
                ZERO_REPLICA_FILE: './zero-replica.db',
                ZERO_AUTH_SECRET: ZERO_AUTH_SECRET,
                // Also set these for compatibility
                SECRET_ZERO_DEV_PG: enhancedDbUrl,
                SECRET_ZERO_AUTH_SECRET: ZERO_AUTH_SECRET,
                // Add connection timeout and retry settings
                ZERO_DB_CONNECT_TIMEOUT: '10', // 10 seconds
                NODE_ENV: process.env.NODE_ENV || 'development',
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
            // Store last error for debugging
            if (line.trim()) {
                lastError = line.trim();
            }
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
                // Exponential backoff with max delay cap
                const exponentialDelay = INITIAL_RESTART_DELAY * Math.pow(2, restartAttempts - 1);
                const delay = Math.min(exponentialDelay, MAX_RESTART_DELAY);

                console.error(`[Zero] Process crashed with code ${code}. Will attempt to restart in ${delay}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
                if (lastError) {
                    console.error(`[Zero] Last error before crash: ${lastError}`);
                }

                restartTimeout = setTimeout(() => {
                    console.log(`[Zero] Attempting to restart zero-cache...`);
                    startZero();
                }, delay);
            } else {
                console.error(`[Zero] Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Stopping auto-restart.`);
                console.error(`[Zero] Last error: ${lastError || 'Unknown error'}`);
                shouldAutoRestart = false;
            }
        } else if (code === 0) {
            // Successful exit, reset restart attempts
            restartAttempts = 0;
            lastError = null;
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
            lastError = null;
        }
    }, 2000); // Increased delay to ensure process is stable
}

/**
 * Enhance database URL with connection pooling and timeout parameters
 * Helps with high-latency connections
 */
function enhanceDatabaseUrl(url: string): string {
    try {
        const urlObj = new URL(url);

        // Add connection timeout parameter (Postgres standard)
        // This helps with high-latency connections
        if (!urlObj.searchParams.has('connect_timeout')) {
            urlObj.searchParams.set('connect_timeout', '10'); // 10 second connection timeout
        }

        // For Neon pooler connections, ensure we're using the pooler mode
        if (url.includes('neon.tech') && url.includes('pooler')) {
            // Ensure we don't override existing parameters
            if (!urlObj.searchParams.has('sslmode')) {
                urlObj.searchParams.set('sslmode', 'require');
            }
        }

        return urlObj.toString();
    } catch (error) {
        // If URL parsing fails, return original
        console.warn(`[Zero] Failed to enhance database URL: ${error}`);
        return url;
    }
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

/**
 * Get Zero process status for debugging
 */
export function getZeroStatus(): {
    running: boolean;
    restartAttempts: number;
    lastError: string | null;
} {
    return {
        running: isZeroRunning(),
        restartAttempts,
        lastError,
    };
}

