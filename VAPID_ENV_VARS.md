# VAPID Environment Variables for Production (Fly.io)

## Required Environment Variables

For Web Push Notifications to work in production, you need to set these 3 environment variables in Fly.io:

### 1. `SECRET_VAPID_PRIVATE_KEY` (Private)
- **Type**: Secret/Private (server-side only)
- **Description**: The private VAPID key used to sign push notifications
- **Example**: `Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=`
- **Set in Fly.io**: 
  ```bash
  fly secrets set SECRET_VAPID_PRIVATE_KEY="your-private-key-here"
  ```

### 2. `PUBLIC_VAPID_PUBLIC_KEY` (Public)
- **Type**: Public (available on client and server)
- **Description**: The public VAPID key used by browsers to subscribe to push notifications
- **Example**: `Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Set in Fly.io**:
  ```bash
  fly secrets set PUBLIC_VAPID_PUBLIC_KEY="your-public-key-here"
  ```

### 3. `PUBLIC_VAPID_SUBJECT` (Public)
- **Type**: Public (available on client and server)
- **Description**: A contact email or mailto: URL identifying the application
- **Format**: Must be a valid `mailto:` URL (e.g., `mailto:admin@hominio.me`)
- **Note**: If you provide just an email address (e.g., `admin@hominio.me`), it will automatically be prefixed with `mailto:`
- **Set in Fly.io**:
  ```bash
  fly secrets set PUBLIC_VAPID_SUBJECT="mailto:admin@hominio.me"
  # OR just the email (will be auto-prefixed):
  fly secrets set PUBLIC_VAPID_SUBJECT="admin@hominio.me"
  ```

## Generating VAPID Keys

If you haven't generated VAPID keys yet, run:

```bash
npx web-push generate-vapid-keys
```

This will output something like:
```
=======================================

Public Key:
Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Private Key:
Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=

=======================================
```

## Setting All Variables at Once

You can set all three variables in one command:

```bash
fly secrets set \
  SECRET_VAPID_PRIVATE_KEY="your-private-key" \
  PUBLIC_VAPID_PUBLIC_KEY="your-public-key" \
  PUBLIC_VAPID_SUBJECT="mailto:admin@hominio.me"
```

## Verification

After setting the variables, restart your Fly.io app:

```bash
fly apps restart <your-app-name>
```

The app will automatically validate the VAPID keys on startup. If there are any issues, check the Fly.io logs:

```bash
fly logs
```

## Important Notes

1. **Same Keys for All Environments**: Use the same VAPID keys for both development and production. VAPID keys are domain-agnostic.

2. **Keep Private Key Secret**: Never expose `SECRET_VAPID_PRIVATE_KEY` in client-side code or commit it to version control.

3. **Subject Email**: The `PUBLIC_VAPID_SUBJECT` should be a valid email address where users can contact you about push notifications.

4. **HTTPS Required**: Web Push Notifications require HTTPS in production (Fly.io provides this automatically).

