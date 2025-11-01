#!/usr/bin/env bun
/**
 * Convert Neon pooler connection string to direct connection
 * Zero requires a direct connection (not pooler) for replication slots
 */

const connectionString = process.argv[2] || process.env.SECRET_ZERO_DEV_PG;

if (!connectionString) {
  console.error("❌ Usage: bun scripts/convert-to-direct-connection.js <connection_string>");
  console.error("   Or set SECRET_ZERO_DEV_PG environment variable");
  process.exit(1);
}

try {
  const url = new URL(connectionString);
  
  // Check if it's a pooler connection
  if (url.hostname.includes('pooler')) {
    console.log("⚠️  Detected pooler connection - converting to direct connection...");
    
    // Convert pooler hostname to direct hostname
    // Example: ep-xxx-pooler.c-2.eu-central-1.aws.neon.tech -> ep-xxx.c-2.eu-central-1.aws.neon.tech
    url.hostname = url.hostname.replace('-pooler', '');
    
    // Remove pooler-specific query parameters
    url.searchParams.delete('pgbouncer');
    url.searchParams.delete('pool_timeout');
    
    // Ensure we have sslmode set
    if (!url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }
    
    console.log("\n✅ Direct connection string:");
    console.log(url.toString());
    console.log("\n💡 Use this for ZERO_UPSTREAM_DB in Fly.io secrets");
    console.log("   Command: fly secrets set ZERO_UPSTREAM_DB=\"" + url.toString() + "\" -a hominio-me-sync");
  } else {
    console.log("✅ Already a direct connection:");
    console.log(connectionString);
  }
} catch (error) {
  console.error("❌ Invalid connection string:", error.message);
  process.exit(1);
}

