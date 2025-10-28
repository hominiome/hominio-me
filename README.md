# Hominio.me

Landing page for Hominio Summit No1 - Europe's first startup tournament for purpose-driven founders.

## Tech Stack

- **Framework:** SvelteKit
- **Runtime:** Bun
- **Hosting:** Fly.io
- **Adapter:** @sveltejs/adapter-node

## Developing

Install dependencies and start the development server:

```sh
bun install
bun run dev

# or start the server and open the app in a new browser tab
bun run dev -- --open
```

## Building

To create a production version of your app:

```sh
bun run build
```

You can preview the production build with `bun run preview`.

## Deploying to Fly.io

This project is configured to deploy to Fly.io using Bun runtime.

### Prerequisites

1. Install [Fly CLI](https://fly.io/docs/flyctl/install/)
2. Login to Fly.io: `flyctl auth login`

### Initial Setup (already done)

```sh
# Create the app
flyctl apps create hominio-me

# Allocate IP addresses
flyctl ips allocate-v4 --shared
flyctl ips allocate-v6

# Set up custom domain SSL certificates
flyctl certs create hominio.me
flyctl certs create www.hominio.me
```

### Deploy

```sh
# Deploy the app
flyctl deploy --remote-only

# Check deployment status
flyctl status

# View logs
flyctl logs

# Open the app in browser
flyctl open
```

### DNS Configuration

Update your DNS records at your domain registrar:

**For hominio.me:**
```
Type: A
Name: @
Value: 66.241.124.145

Type: AAAA  
Name: @
Value: 2a09:8280:1::aa:d39:0
```

**For www.hominio.me:**
```
Type: CNAME
Name: www
Value: 8neymxe.hominio-me.fly.dev
```

### Check SSL Certificate Status

```sh
flyctl certs check hominio.me
flyctl certs check www.hominio.me
```

## Project Structure

- `/src/routes/` - Pages and routes
  - `+page.svelte` - Landing page
  - `legal-notice/` - Site notice page
  - `privacy-policy/` - Privacy policy page
  - `social-media-privacy-policy/` - Social media privacy policy
- `/src/lib/components/` - Reusable components
  - `TextWrap.svelte` - Layout wrapper for legal pages
- `/static/` - Static assets (logo, images)
- `Dockerfile` - Bun-based Docker configuration for Fly.io
- `fly.toml` - Fly.io deployment configuration

## Live URLs

- Production: https://hominio.me
- Fly.io URL: https://hominio-me.fly.dev
