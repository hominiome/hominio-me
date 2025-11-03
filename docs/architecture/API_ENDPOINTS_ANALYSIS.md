# API Endpoints Analysis & Migration Status

## Summary

This document analyzes all API endpoints in `/alpha/api` to determine:
1. ✅ **Still Used** - Actively used, should be kept
2. ❌ **Can Remove** - Not used, can be deleted
3. 🔄 **Migrate to Zero** - Should be migrated to custom mutators/synced queries
4. 🔒 **Keep as-is** - Complex flows, intentionally preserved

---

## ✅ Still Used - Simple CRUD (Can Migrate to Zero)

### 1. `/api/delete-project` ✅ USED → 🔄 MIGRATE TO ZERO
- **Status**: Used in `projects/+page.svelte`
- **Action**: Simple admin-only delete operation
- **Recommendation**: Migrate to `zero.mutate.project.delete()` custom mutator
- **Complexity**: Low - just a delete with admin check

### 2. `/api/create-cup` ✅ USED → 🔄 MIGRATE TO ZERO
- **Status**: Used in `CreateCupContent.svelte` and `cups/create/+page.svelte`
- **Action**: Simple cup creation
- **Recommendation**: Migrate to `zero.mutate.cup.create()` custom mutator
- **Complexity**: Low - just an insert with validation

### 3. `/api/update-cup` ✅ USED → 🔄 MIGRATE TO ZERO
- **Status**: Used in `EditCupContent.svelte` and `cups/[cupId]/edit/+page.svelte`
- **Action**: Simple cup update (name, description, logo)
- **Recommendation**: Migrate to `zero.mutate.cup.update()` custom mutator
- **Complexity**: Low - just an update with permission check

### 4. `/api/add-project-to-cup` ✅ USED → 🔄 MIGRATE TO ZERO
- **Status**: Used in `cups/[cupId]/admin/+page.svelte`
- **Action**: Admin-only operation to add project to cup's selectedProjectIds array
- **Recommendation**: Migrate to `zero.mutate.cup.addProject()` custom mutator
- **Complexity**: Low - array manipulation

### 5. `/api/remove-project-from-cup` ✅ USED → 🔄 MIGRATE TO ZERO
- **Status**: Used in `cups/[cupId]/admin/+page.svelte`
- **Action**: Admin-only operation to remove project from cup's selectedProjectIds array
- **Recommendation**: Migrate to `zero.mutate.cup.removeProject()` custom mutator
- **Complexity**: Low - array manipulation

---

## ✅ Still Used - Read-only Queries (Can Replace with Synced Queries)

### 6. `/api/cup/[cupId]` ✅ USED → 🔄 REPLACE WITH SYNCED QUERY
- **Status**: Used in `VictoryCelebration.svelte`
- **Action**: Returns cup by ID
- **Recommendation**: Replace with `cupById` synced query, then remove endpoint
- **Complexity**: Low - just need to update component

### 7. `/api/project/[projectId]` ✅ USED → 🔄 REPLACE WITH SYNCED QUERY
- **Status**: Used in `OpponentReveal.svelte`
- **Action**: Returns project by ID
- **Recommendation**: Replace with `projectById` synced query, then remove endpoint
- **Complexity**: Low - just need to update component

### 8. `/api/users` ✅ USED → 🔄 KEEP OR MIGRATE
- **Status**: Used in `UserAutocomplete.svelte`
- **Action**: Admin-only user search (searches auth DB, not Zero DB)
- **Recommendation**: Can keep as-is (searches BetterAuth DB) OR create synced query for user search
- **Complexity**: Low - but searches different DB (BetterAuth)

### 9. `/api/user/[userId]` ✅ USED → 🔄 KEEP OR MIGRATE
- **Status**: Used in `scan/+page.svelte` and `userProfileCache.ts`
- **Action**: Public user profile lookup (name, image only)
- **Recommendation**: Can keep as-is (searches BetterAuth DB) OR create synced query
- **Complexity**: Low - but searches different DB (BetterAuth)

### 10. `/api/purchase-data/[purchaseId]` ✅ USED → 🔄 KEEP OR MIGRATE
- **Status**: Used in `PrizePoolDisplay.svelte`
- **Action**: Calculates prize pool data for a purchase
- **Recommendation**: Can migrate to synced query or keep as helper endpoint
- **Complexity**: Medium - involves calculation logic

---

## ✅ Still Used - Utility/Helper Endpoints

### 11. `/api/is-admin` ✅ USED → 🔄 REPLACE WITH CLIENT-SIDE CHECK
- **Status**: Used in many files (projects, cups, scan, navbar, etc.)
- **Action**: Checks if current user is admin
- **Recommendation**: Replace with client-side check using `extractAuthData` or BetterAuth session
- **Complexity**: None - just a boolean check

### 12. `/api/check-expiry` ✅ USED → 🔄 KEEP AS-IS
- **Status**: Used in `+page.svelte` and `cups/[cupId]/+page.svelte`
- **Action**: Checks if cup/identity has expired (business logic)
- **Recommendation**: Keep as-is (utility function)
- **Complexity**: Low - date comparison logic

### 13. `/api/upload-image` ✅ USED → 🔄 KEEP AS-IS
- **Status**: Used in `TigrisImageUpload.svelte`
- **Action**: Uploads images to Tigris storage
- **Recommendation**: Keep as-is (external service integration)
- **Complexity**: Medium - file upload to external service

### 14. `/api/list-images` ✅ USED → 🔄 KEEP AS-IS
- **Status**: Used in image upload components
- **Action**: Lists images from Tigris storage
- **Recommendation**: Keep as-is (external service integration)
- **Complexity**: Medium - external service query

---

## 🔒 Still Used - Complex Tournament Flows (Keep As-Is)

### 15. `/api/vote-match` 🔒 KEEP AS-IS
- **Status**: Used in `+page.svelte` and `cups/[cupId]/+page.svelte`
- **Action**: Complex voting logic with tournament mechanics, notifications, prize pool updates
- **Recommendation**: ✅ **Intentionally Preserved** - Complex business logic
- **Complexity**: High - voting algorithm, notifications, state updates

### 16. `/api/purchase-package` 🔒 KEEP AS-IS
- **Status**: Used in `purchase/+page.svelte`
- **Action**: Complex Stripe payment integration, identity creation, notifications
- **Recommendation**: ✅ **Intentionally Preserved** - Payment flow
- **Complexity**: High - Stripe integration, payment processing

### 17. `/api/purchase-package-for-user` 🔒 KEEP AS-IS
- **Status**: Used in `scan/+page.svelte`
- **Action**: Admin-only purchase for another user (Stripe integration)
- **Recommendation**: ✅ **Intentionally Preserved** - Payment flow
- **Complexity**: High - Stripe integration, admin purchase flow

### 18. `/api/start-cup` 🔒 KEEP AS-IS
- **Status**: Used in `cups/[cupId]/admin/+page.svelte`
- **Action**: Complex tournament initialization logic
- **Recommendation**: ✅ **Intentionally Preserved** - Tournament flow
- **Complexity**: High - tournament setup, match creation

### 19. `/api/start-next-round` 🔒 KEEP AS-IS
- **Status**: Used in `cups/[cupId]/admin/+page.svelte`
- **Action**: Complex round progression logic, match creation, notifications
- **Recommendation**: ✅ **Intentionally Preserved** - Tournament flow
- **Complexity**: High - tournament progression, state management

### 20. `/api/end-round` 🔒 KEEP AS-IS
- **Status**: Used in `cups/[cupId]/admin/+page.svelte`
- **Action**: Complex round completion logic, winner determination, notifications
- **Recommendation**: ✅ **Intentionally Preserved** - Tournament flow
- **Complexity**: High - tournament logic, notifications

### 21. `/api/determine-match-winner` 🔒 KEEP AS-IS
- **Status**: Used in `cups/[cupId]/admin/+page.svelte`
- **Action**: Complex match winner determination logic
- **Recommendation**: ✅ **Intentionally Preserved** - Tournament flow
- **Complexity**: High - voting calculation, winner logic

### 22. `/api/match-details/[matchId]` 🔒 KEEP AS-IS
- **Status**: Used in `VotingProgressDisplay.svelte`
- **Action**: Calculates match statistics and details
- **Recommendation**: Can migrate to synced query OR keep as calculation endpoint
- **Complexity**: Medium - match statistics calculation

### 23. `/api/match-vote-data/[matchId]` 🔒 KEEP AS-IS
- **Status**: Used in `VotingProgressDisplay.svelte`
- **Action**: Calculates vote data and statistics for a match
- **Recommendation**: Can migrate to synced query OR keep as calculation endpoint
- **Complexity**: Medium - vote statistics calculation

---

## ❌ Not Found / Unknown

### 24. `/api/tigris-proxy` ❌ NOT USED → CAN REMOVE
- **Status**: No references found in codebase
- **Action**: Unknown
- **Recommendation**: ✅ **Can Remove** - No usage found

---

## Migration Priority


### Medium Priority (Replace with Synced Queries)
6. ✅ `/api/cup/[cupId]` → Already have `cupById` synced query
7. ✅ `/api/project/[projectId]` → Already have `projectById` synced query
8. 🔄 `/api/is-admin` → Client-side check (BetterAuth session)

### Low Priority (Keep or Optional Migration)
9. 🔄 `/api/users` → Keep or create synced query (searches BetterAuth DB)
10. 🔄 `/api/user/[userId]` → Keep or create synced query (searches BetterAuth DB)
11. 🔄 `/api/purchase-data/[purchaseId]` → Keep or migrate (calculation logic)
12. 🔄 `/api/match-details/[matchId]` → Keep or migrate (calculation logic)
13. 🔄 `/api/match-vote-data/[matchId]` → Keep or migrate (calculation logic)

### No Migration (Intentionally Preserved)
14. 🔒 `/api/vote-match` - Complex tournament mechanics
15. 🔒 `/api/purchase-package` - Stripe payment integration
16. 🔒 `/api/purchase-package-for-user` - Stripe payment integration
17. 🔒 `/api/start-cup` - Tournament initialization
18. 🔒 `/api/start-next-round` - Tournament progression
19. 🔒 `/api/end-round` - Tournament completion
20. 🔒 `/api/determine-match-winner` - Match winner logic
21. 🔒 `/api/upload-image` - External service (Tigris)
22. 🔒 `/api/list-images` - External service (Tigris)
23. 🔒 `/api/check-expiry` - Business logic utility

---

## Action Items

### Immediate Cleanup
- [ ] Update `VictoryCelebration.svelte` to use `cupById` synced query, then remove `/api/cup/[cupId]`
- [ ] Update `OpponentReveal.svelte` to use `projectById` synced query, then remove `/api/project/[projectId]`
- [ ] Remove `/api/tigris-proxy` - no usage found

### Migration Tasks
- [ ] Migrate `/api/delete-project` to `zero.mutate.project.delete()`
- [ ] Migrate `/api/create-cup` to `zero.mutate.cup.create()`
- [ ] Migrate `/api/update-cup` to `zero.mutate.cup.update()`
- [ ] Migrate `/api/add-project-to-cup` to `zero.mutate.cup.addProject()`
- [ ] Migrate `/api/remove-project-from-cup` to `zero.mutate.cup.removeProject()`
- [ ] Replace `/api/is-admin` with client-side check

### Keep As-Is (Documented)
- ✅ All complex tournament flows
- ✅ Payment integrations
- ✅ External service integrations
- ✅ Calculation/utility endpoints

