import {
  createSchema,
  table,
  string,
  number,
  definePermissions,
  ANYONE_CAN,
} from '@rocicorp/zero';

// Define the project table
// Public read, owner-only write/delete
// Note: userName and userImage are fetched from user profile API, not stored here
const project = table('project')
  .columns({
    id: string(),
    title: string(),
    description: string(),
    country: string(),
    city: string(),
    userId: string(), // Reference to user - fetch profile via /alpha/api/user/[userId]
    videoUrl: string(), // YouTube URL for project pitch video (optional)
    videoThumbnail: string(), // Custom video thumbnail image URL (optional, falls back to Unsplash)
    sdgs: string(), // JSON string array of SDG goals (1-3): ["01_NoPoverty", "13_Climate", ...]
    createdAt: string(), // ISO timestamp
  })
  .primaryKey('id');

// Cup tournament container
const cup = table('cup')
  .columns({
    id: string(),
    name: string(),
    description: string(),
    creatorId: string(), // Reference to user - fetch profile via /alpha/api/user/[userId]
    logoImageUrl: string(), // Cup logo image URL (optional)
    size: number(), // Cup size: 4, 8, 16, 32, 64, or 128
    selectedProjectIds: string(), // JSON array of selected project IDs (empty string or JSON array)
    status: string(), // 'draft' | 'active' | 'completed'
    currentRound: string(), // 'round_4' | 'round_8' | 'round_16' | 'round_32' | 'round_64' | 'round_128' | 'quarter' | 'semi' | 'final'
    winnerId: string(), // Project ID of winner
    createdAt: string(),
    startedAt: string(),
    completedAt: string(),
    updatedAt: string(),
    endDate: string(), // ISO timestamp for cup end date/time
  })
  .primaryKey('id');

// Individual match in tournament bracket
// Vote totals are calculated from the vote table, no wallet needed
const cupMatch = table('cupMatch')
  .columns({
    id: string(),
    cupId: string(),
    round: string(), // 'round_4' | 'round_8' | 'round_16' | 'round_32' | 'round_64' | 'round_128' | 'quarter' | 'semi' | 'final'
    position: number(), // 0-14 (position in bracket)
    project1Id: string(), // First project
    project2Id: string(), // Second project
    winnerId: string(), // Project ID of winner
    status: string(), // 'pending' | 'voting' | 'completed'
    completedAt: string(),
    endDate: string(), // ISO timestamp for match end date/time (optional, falls back to round date)
  })
  .primaryKey('id');

// User identities - tracks which voting weight identity a user has selected per cup
// Note: cupId is optional in schema to allow migration, but should be set for new records
const userIdentities = table('userIdentities')
  .columns({
    id: string(),
    userId: string(), // User ID - indexed
    cupId: string(), // Cup ID - indexed (optional for migration, required for new records)
    identityType: string(), // 'hominio' | 'founder' | 'angel'
    votingWeight: number(), // 1 | 5 | 10
    selectedAt: string(), // ISO timestamp
    upgradedFrom: string(), // Previous identity type if upgraded (nullable)
  })
  .primaryKey('id');

// Identity purchases - tracks purchases of voting identities per cup
const identityPurchase = table('identityPurchase')
  .columns({
    id: string(),
    userId: string(), // User ID - indexed
    cupId: string(), // Cup ID - indexed
    identityType: string(), // 'hominio' | 'founder' | 'angel'
    price: number(), // Price in cents (100 = 1.00€, 1000 = 10.00€)
    purchasedAt: string(), // ISO timestamp
    userIdentityId: string(), // Reference to userIdentities.id
  })
  .primaryKey('id');

// Vote record - tracks individual votes on matches (one per user per match)
const vote = table('vote')
  .columns({
    id: string(),
    userId: string(), // User ID - indexed
    matchId: string(), // Match ID - indexed
    projectSide: string(), // 'project1' | 'project2'
    votingWeight: number(), // Weight used for this vote
    createdAt: string(), // ISO timestamp
  })
  .primaryKey('id');

// Notifications - generic notification system for users
const notification = table('notification')
  .columns({
    id: string(),
    userId: string(), // User ID - indexed (private to user)
    resourceType: string(), // Type of resource: 'identityPurchase', 'match', etc.
    resourceId: string(), // ID of the resource
    title: string(), // Notification title
    message: string(), // Notification message
    read: string(), // 'true' | 'false' (as string for Zero compatibility)
    createdAt: string(), // ISO timestamp
    actions: string(), // JSON string array of action objects: [{label: string, url: string}]
    sound: string(), // Optional sound file path (e.g., "/purchase-effect.mp3")
    icon: string(), // Optional Iconify icon name (e.g., "mdi:bell", "material-symbols:notifications")
    displayComponent: string(), // Optional component name to display above header (e.g., "HelloEarth")
  })
  .primaryKey('id');

export const schema = createSchema({
  tables: [project, cup, cupMatch, userIdentities, identityPurchase, vote, notification],
});

// AuthData type - JWT claims from BetterAuth
// Zero validates the JWT and passes the claims to this function
type AuthData = {
  sub: string; // User ID from JWT 'sub' claim
  iat?: number; // Issued at
  exp?: number; // Expiry
};

// ⚠️ SERVER-SIDE SECURITY ENFORCEMENT ⚠️
// These permissions are enforced by zero-cache server, NOT the client.
export const permissions = definePermissions<AuthData, typeof schema>(
  schema,
  () => ({
    project: {
      row: {
        // SELECT: Everyone can read all projects (public)
        select: ANYONE_CAN,
        // INSERT: Users can only create projects for themselves
        insert: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
        // UPDATE: Users can only update their own projects
        update: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
        // DELETE: Users can only delete their own projects
        delete: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
      },
    },
    cup: {
      row: {
        // SELECT: Everyone can read cups
        select: ANYONE_CAN,
        // INSERT: Any authenticated user can create cups
        // Admin-only restrictions apply to:
        //   1. API endpoints (start-cup, end-round, etc.) require admin role
        //   2. Certain admin actions on cups
        // NOTE: Admin role is checked against ADMIN env var in application layer
        insert: ANYONE_CAN,
        // UPDATE: Controlled by application logic (admin checks in API endpoints)
        update: ANYONE_CAN,
        // DELETE: Controlled by application logic (admin checks in API endpoints)
        delete: ANYONE_CAN,
      },
    },
    cupMatch: {
      row: {
        // SELECT: Everyone can read matches
        select: ANYONE_CAN,
        // INSERT: System only (created with cup)
        insert: ANYONE_CAN, // Controlled by app logic
        // UPDATE: System only (controlled by cup creator via app logic)
        update: ANYONE_CAN, // Controlled by app logic
        // DELETE: Nobody
        delete: [],
      },
    },
    userIdentities: {
      row: {
        // SELECT: Everyone can read identities (public transparency)
        select: ANYONE_CAN,
        // INSERT: Users can create their own identity for a cup
        insert: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
        // UPDATE: Users can update their own identity (for upgrades)
        update: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
        // DELETE: Nobody can delete identities
        delete: [],
      },
    },
    identityPurchase: {
      row: {
        // SELECT: Everyone can read purchases (public transparency)
        select: ANYONE_CAN,
        // INSERT: Users can create their own purchase records
        insert: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
        // UPDATE/DELETE: Purchases are immutable
        update: [],
        delete: [],
      },
    },
    vote: {
      row: {
        // SELECT: Everyone can read votes (public transparency)
        select: ANYONE_CAN,
        // INSERT: Users can create their own votes
        insert: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
        // UPDATE/DELETE: Votes are immutable
        update: [],
        delete: [],
      },
    },
    notification: {
      row: {
        // SELECT: Users can only read their own notifications
        select: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
        // INSERT: System/admin can create notifications for users
        insert: ANYONE_CAN, // Controlled by app logic (admin endpoints)
        // UPDATE: Users can update their own notifications (mark as read)
        update: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
        // DELETE: Users can delete their own notifications
        delete: [
          (authData, { cmp }) => {
            return cmp('userId', '=', authData.sub);
          }
        ],
      },
    },
  })
);

export type Schema = typeof schema;

