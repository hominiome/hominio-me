# Polar Direct Subscription Renewal (Without Checkout)

## Overview
Polar.sh provides API endpoints to renew/reactivate subscriptions directly without requiring a checkout round trip. This is useful for users who have canceled subscriptions but want to reactivate them before expiration.

## API Endpoints

### 1. Update Subscription (Uncancel)
**Endpoint:** `PATCH /v1/subscriptions/{subscription_id}`

**Requires:** `subscriptions:write` scope

**Use Case:** Reactivate a canceled subscription that hasn't expired yet (still has access until `current_period_end`).

**Example:**
```bash
curl -X PATCH "https://api.polar.sh/v1/subscriptions/{subscription_id}" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancel_at_period_end": false
  }'
```

**What happens:**
- Sets `cancel_at_period_end: false` to reactivate the subscription
- Triggers `subscription.uncanceled` webhook event
- Existing webhook handler will update the user's identity (clear `expiresAt`)

### 2. Customer Portal Subscription Update
**Endpoint:** `PATCH /v1/customer-portal/subscriptions/{id}`

**Requires:** `customer_portal:write` scope + customer session

**Use Case:** Customer-facing renewal (better for security - uses customer session instead of admin token).

**Example:**
```typescript
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
});

// Requires customer session from better-auth Polar plugin
const result = await polar.customerPortal.subscriptions.update({
  customerSession: customerSessionToken, // From auth client
}, {
  id: subscriptionId,
  customerSubscriptionUpdate: {
    cancel_at_period_end: false
  }
});
```

## Implementation Steps

### Current State
- We store subscription IDs in webhook payloads (`polar_webhook_events` table)
- We don't currently store `subscriptionId` in `identityPurchase` table
- When subscription is canceled, we set `expiresAt` on the identity

### Required Changes

1. **Store Subscription ID:**
   - Add `subscriptionId` field to `identityPurchase` table (nullable)
   - Update webhook handlers to store subscription ID when creating purchase records

2. **Create Renewal API Endpoint:**
   - Create `/alpha/api/renew-subscription/+server.js`
   - Find user's canceled subscription (via `identityPurchase.subscriptionId` or query Polar API)
   - Call Polar API to uncancel subscription
   - Return success/error

3. **Update Purchase Page:**
   - When `isRenew` is true, show "Renew" button that calls renewal API instead of checkout
   - Handle loading states and success/error messages

### Limitations

- **Expired Subscriptions:** If `current_period_end` has passed, you cannot uncancel. You must create a new subscription via checkout.
- **No Payment Method:** If the customer doesn't have a saved payment method, renewal will fail. They'll need to go through checkout.
- **Subscription Not Found:** If subscription ID is missing or invalid, you'll need to fall back to checkout.

## Alternative: Polar Customer Portal

Polar provides a hosted customer portal where users can manage their subscriptions:
- Reactivate canceled subscriptions
- Update payment methods
- View invoices

**Implementation:**
```typescript
// Generate customer portal session URL
const portalUrl = await authClient.customerPortal({
  returnUrl: "/alpha"
});
```

This redirects users to Polar's hosted portal where they can renew without you implementing the API calls directly.

## Recommended Approach

1. **Short-term:** Use Polar Customer Portal for renewals (simplest, most secure)
2. **Long-term:** Implement direct API renewal for better UX control

## References
- [Polar API Reference - Subscriptions](https://docs.polar.sh/api-reference/subscriptions/update)
- [Polar.js SDK - Customer Portal](https://github.com/polarsource/polar-js)
- [Polar Webhooks - subscription.uncanceled](https://docs.polar.sh/api-reference/webhooks/subscription.uncanceled)

