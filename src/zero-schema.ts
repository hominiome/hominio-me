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
    city: string(),
    userId: string(), // Reference to user - fetch profile via /alpha/api/user/[userId]
    videoUrl: string(), // YouTube URL for project pitch video (optional)
    videoThumbnail: string(), // Custom video thumbnail image URL (optional, falls back to Unsplash)
    sdgs: string(), // JSON string array of SDG goals (1-3): ["01_NoPoverty", "13_Climate", ...]
    createdAt: string(), // ISO timestamp
  })
  .primaryKey('id');

// Universal Wallet System
// Wallets can be attached to any entity (user, project, match, cup)
const wallet = table('wallet')
  .columns({
    id: string(),
    entityType: string(), // 'user' | 'project' | 'match' | 'cup'
    entityId: string(), // ID of the entity that owns this wallet
    balance: number(), // Current heart balance
    createdAt: string(),
    updatedAt: string(),
  })
  .primaryKey('id');

// Generic transaction ledger for all heart movements
const transaction = table('transaction')
  .columns({
    id: string(),
    fromWalletId: string(), // Source wallet (null for purchases)
    toWalletId: string(), // Destination wallet (null for burns)
    amount: number(), // Hearts transferred (always positive)
    type: string(), // 'purchase' | 'vote' | 'prize' | 'refund'
    metadata: string(), // JSON string for additional context
    createdAt: string(),
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
    walletId: string(), // Cup's prize pool wallet (for future use)
    status: string(), // 'draft' | 'active' | 'completed'
    currentRound: string(), // 'round_16' | 'quarter' | 'semi' | 'final'
    winnerId: string(), // Project ID of winner
    createdAt: string(),
    startedAt: string(),
    completedAt: string(),
    updatedAt: string(),
  })
  .primaryKey('id');

// Individual match in tournament bracket
const cupMatch = table('cupMatch')
  .columns({
    id: string(),
    cupId: string(),
    round: string(), // 'round_16' | 'quarter' | 'semi' | 'final'
    position: number(), // 0-14 (position in bracket)
    project1Id: string(), // First project
    project2Id: string(), // Second project
    project1WalletId: string(), // Wallet receiving votes for project 1
    project2WalletId: string(), // Wallet receiving votes for project 2
    winnerId: string(), // Project ID of winner
    status: string(), // 'pending' | 'voting' | 'completed'
    completedAt: string(),
  })
  .primaryKey('id');

export const schema = createSchema({
  tables: [project, wallet, transaction, cup, cupMatch],
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
    wallet: {
      row: {
        // SELECT: Everyone can read wallets (public transparency)
        select: ANYONE_CAN,
        // INSERT: Only system/app logic (controlled in code)
        insert: ANYONE_CAN, // Controlled by app logic
        // UPDATE: Only system/app logic (balance updates via transactions)
        update: ANYONE_CAN, // Controlled by app logic
        // DELETE: Nobody can delete wallets
        delete: [],
      },
    },
    transaction: {
      row: {
        // SELECT: Everyone can read transactions (public transparency)
        select: ANYONE_CAN,
        // INSERT: Anyone can create transactions (validation in app logic)
        insert: ANYONE_CAN,
        // UPDATE/DELETE: Immutable ledger
        update: [],
        delete: [],
      },
    },
    cup: {
      row: {
        // SELECT: Everyone can read cups
        select: ANYONE_CAN,
        // INSERT: Technically open, but admin-only enforcement is done via:
        //   1. Frontend UI restricts cup creation page to admin users
        //   2. API endpoints (start-cup, end-round, etc.) require admin role
        //   3. Draft cups without admin actions remain inactive
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
  })
);

export type Schema = typeof schema;

