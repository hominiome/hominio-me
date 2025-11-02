# Tigris Local Development Setup

Tigris secrets are automatically set on Fly.io machines. For local development, you need to configure Tigris credentials in your `.env` file.

## Local Tigris Setup (Direct Connection)

### Method A: Get from Tigris Dashboard (Easiest)

1. **Visit the [Tigris Dashboard](https://fly.storage.tigris.dev)** and sign in
2. **Navigate to Access Keys** section
3. **Find your access key** (e.g., `hominio-profile-images_access_key`)
4. **Copy the Access Key ID** (starts with `tid_...`)
5. **Get the Secret Access Key** - This is only shown once when the key is created. If you don't have it:
   - You can create a new access key in the dashboard
   - Or retrieve it from Fly.io (see Method B below)

6. **Create or edit `.env` file** in your project root:

```env
# Tigris Storage Configuration
# Get Access Key ID from: https://fly.storage.tigris.dev (Access Keys section)
AWS_ACCESS_KEY_ID=tid_CtZAupTDXxoJJJINZ_RfqEExoqewpGlxcTZwZaEvgaMukXzdbR
AWS_SECRET_ACCESS_KEY=tsec_your_secret_key_here
AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev
AWS_REGION=auto
BUCKET_NAME=hominio-profile-images
```

**Note:** The endpoint `https://t3.storage.dev` shown in the dashboard is the global endpoint. For Fly.io integration, use `https://fly.storage.tigris.dev`.

### Method B: Get from Fly.io Machine (via SSH)

If you need to retrieve the secret access key:

```bash
fly ssh console -a hominio-me
```

Then inside the SSH session, run:
```bash
env | grep -E '(AWS_|BUCKET_)'
```

Copy all 5 values and add them to your `.env` file.

### Restart Dev Server

After setting up `.env`:

```bash
bun run dev
```

## Verification

Visit `/alpha/tigris-test` in your local app. If configured correctly, you should be able to upload and list images directly from Tigris storage.

## Notes

- `.env` is already in `.gitignore`, so secrets won't be committed
- Secrets are only needed for local development **if you want to test image uploads**
- Production on Fly.io has secrets set automatically via `fly storage create`
- **Security:** Fly.io doesn't allow extracting secret values via CLI for security reasons - manual copy via SSH is required
- If secrets are missing, you'll get a helpful error message

## Required Environment Variables

When setting up local Tigris connection, you need these 5 environment variables in your `.env` file:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | Access Key ID from Tigris dashboard | `tid_CtZAupTDXxoJJJINZ_RfqEExoqewpGlxcTZwZaEvgaMukXzdbR` |
| `AWS_SECRET_ACCESS_KEY` | Secret key (only shown once when created) | `tsec_...` |
| `AWS_ENDPOINT_URL_S3` | Tigris endpoint URL | `https://fly.storage.tigris.dev` |
| `AWS_REGION` | Region (always `auto` for Tigris) | `auto` |
| `BUCKET_NAME` | Your bucket name | `hominio-profile-images` |

**Where to find them:**
- **Access Key ID**: Visible in [Tigris Dashboard](https://fly.storage.tigris.dev) → Access Keys
- **Secret Access Key**: Only shown once when key is created (use Fly.io SSH if lost)
- **Endpoint**: Use `https://fly.storage.tigris.dev` for Fly.io integration
- **Region**: Always `auto` for Tigris
- **Bucket Name**: From your Fly.io app or Tigris dashboard

## Troubleshooting

**Error: "Tigris storage is not configured"**
- Make sure `.env` file exists in project root
- Verify all 5 environment variables are set correctly
- Check for typos or extra spaces
- Restart dev server after adding secrets (`bun run dev`)

**Error: "Failed to upload image"**
- Verify Access Key ID starts with `tid_` and Secret starts with `tsec_`
- Check that bucket name matches exactly: `hominio-profile-images`
- Ensure endpoint is `https://fly.storage.tigris.dev` (not `https://t3.storage.dev`)
- Verify credentials are active in Tigris dashboard

**Error: "Access Denied" or Authentication Failed**
- Secret Access Key might be incorrect (only shown once when created)
- Create a new access key in Tigris dashboard if needed
- Make sure you're using the correct Access Key ID/Secret pair

