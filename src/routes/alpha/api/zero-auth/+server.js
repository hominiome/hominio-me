import { auth } from "$lib/auth.server.js";
import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

/**
 * Zero Authentication Endpoint
 * Returns a signed JWT token for Zero server validation
 */
export async function GET({ request }) {
  try {
    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create JWT payload for Zero
    // Zero expects 'sub' (subject) claim with the user ID
    const payload = {
      sub: session.user.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiry
    };

    // Sign JWT with Zero auth secret (read at runtime, not build time)
    const SECRET_ZERO_AUTH_SECRET = env.SECRET_ZERO_AUTH_SECRET;
    if (!SECRET_ZERO_AUTH_SECRET) {
      return json({ error: "Server configuration error" }, { status: 500 });
    }
    const jwt = await signJWT(payload, SECRET_ZERO_AUTH_SECRET);

    return json({
      token: jwt,
      userId: session.user.id,
    });
  } catch (error) {
    console.error("Zero auth error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Simple JWT signing function using Web Crypto API
 * In production, consider using a library like jose for more features
 */
async function signJWT(payload, secret) {
  // Encode header
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    encoder.encode(data)
  );

  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

/**
 * Base64 URL encode (JWT standard)
 */
function base64UrlEncode(data) {
  if (data instanceof ArrayBuffer) {
    data = String.fromCharCode(...new Uint8Array(data));
  }
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
