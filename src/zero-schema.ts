import {
  createSchema,
  createBuilder,
  table,
  string,
  number,
  definePermissions,
  ANYONE_CAN,
} from '@rocicorp/zero';

// Define the project table
const project = table('project')
  .columns({
    id: string(),
    title: string(),
    description: string(),
    country: string(),
    city: string(),
    userId: string(), // Reference to user
    videoUrl: string(), // YouTube URL for project pitch video (optional)
    bannerImage: string(), // Custom banner image URL (optional)
    profileImageUrl: string(), // Custom project profile image URL (optional)
    sdgs: string(), // JSON string array of SDG goals
    createdAt: string(), // ISO timestamp
  })
  .primaryKey('id');

// Cup tournament container
const cup = table('cup')
  .columns({
    id: string(),
    name: string(),
    description: string(),
    creatorId: string(), // Reference to user
    logoImageUrl: string(), // Cup logo image URL (optional)
    size: number(), // Cup size: 4, 8, 16, 32, 64, or 128
    selectedProjectIds: string(), // JSON array of selected project IDs
    status: string(), // 'draft' | 'active' | 'completed'
    currentRound: string(), // Current round identifier
    winnerId: string(), // Project ID of winner
    createdAt: string(),
    startedAt: string(),
    completedAt: string(),
    updatedAt: string(),
    endDate: string(), // ISO timestamp for cup end date/time
  })
  .primaryKey('id');

// Individual match in tournament bracket
const cupMatch = table('cupMatch')
  .columns({
    id: string(),
    cupId: string(),
    round: string(), // Round identifier
    position: number(), // Position in bracket
    project1Id: string(), // First project
    project2Id: string(), // Second project
    winnerId: string(), // Project ID of winner
    status: string(), // 'pending' | 'voting' | 'completed'
    completedAt: string(),
    endDate: string(), // ISO timestamp for match end date/time
  })
  .primaryKey('id');

// User identities - tracks which voting weight identity a user has selected
// cupId is nullable: null = universal identity (applies to all cups), otherwise cup-specific
const userIdentities = table('userIdentities')
  .columns({
    id: string(),
    userId: string(), // User ID
    cupId: string(), // Cup ID (null for universal "I am Hominio" identity)
    identityType: string(), // 'explorer' | 'hominio' | 'founder' | 'angel'
    votingWeight: number(), // 0 (explorer) | 1 | 5 | 10
    selectedAt: string(), // ISO timestamp
    upgradedFrom: string(), // Previous identity type if upgraded
  })
  .primaryKey('id');

// Identity purchases - tracks purchases of voting identities
// cupId is nullable: null = universal identity purchase, otherwise cup-specific
const identityPurchase = table('identityPurchase')
  .columns({
    id: string(),
    userId: string(), // User ID
    cupId: string(), // Cup ID (null for universal "I am Hominio" identity)
    identityType: string(), // 'hominio' | 'founder' | 'angel'
    price: number(), // Price in cents
    purchasedAt: string(), // ISO timestamp
    userIdentityId: string(), // Reference to userIdentities.id
  })
  .primaryKey('id');

// Vote record - tracks individual votes on matches
const vote = table('vote')
  .columns({
    id: string(),
    userId: string(), // User ID
    matchId: string(), // Match ID
    projectSide: string(), // 'project1' | 'project2'
    votingWeight: number(), // Weight used for this vote
    createdAt: string(), // ISO timestamp
  })
  .primaryKey('id');

// Notifications - generic notification system for users
const notification = table('notification')
  .columns({
    id: string(),
    userId: string(), // User ID (private to user)
    resourceType: string(), // Type of resource: 'identityPurchase', 'match', etc.
    resourceId: string(), // ID of the resource
    title: string(), // Notification title
    previewTitle: string(), // Optional preview title for curiosity loop
    message: string(), // Notification message
    read: string(), // 'true' | 'false' (as string for Zero compatibility)
    createdAt: string(), // ISO timestamp
    actions: string(), // JSON string array of action objects
    sound: string(), // Optional sound file path
    icon: string(), // Optional Iconify icon name
    displayComponent: string(), // Optional component name to display
    priority: string(), // 'true' | 'false' (as string) - force opens notification
  })
  .primaryKey('id');

export const schema = createSchema({
  tables: [project, cup, cupMatch, userIdentities, identityPurchase, vote, notification],
  // Disable legacy queries - we use synced queries instead
  enableLegacyQueries: false,
  // Disable legacy CRUD mutators - we use custom mutators instead
  enableLegacyMutators: false,
});

// Export builder for synced queries
export const builder = createBuilder(schema);

// ⚠️ DUMMY PERMISSIONS - NOT USED ⚠️
// These permissions exist ONLY to satisfy zero-cache-dev's automatic deployment script.
// They are NOT enforced because:
// 1. enableLegacyQueries: false - clients can't run arbitrary queries
// 2. enableLegacyMutators: false - clients can't use CRUD mutators
// 
// Real security is enforced in:
// - Custom mutators (src/lib/mutators.server.ts) for writes
// - Synced queries (src/routes/alpha/api/zero/get-queries/+server.ts) for reads
type DummyAuthData = { sub: string };

export const permissions = definePermissions<DummyAuthData, typeof schema>(
  schema,
  () => (
    {
      //   // Public read, no writes (custom mutators handle all writes)
      //   project: {
      //     row: {
      //       select: ANYONE_CAN,
      //       insert: [],
      //       update: { preMutation: [], postMutation: [] },
      //       delete: [],
      //     },
      //   },
      //   cup: {
      //     row: {
      //       select: ANYONE_CAN,
      //       insert: [],
      //       update: { preMutation: [], postMutation: [] },
      //       delete: [],
      //     },
      //   },
      //   cupMatch: {
      //     row: {
      //       select: ANYONE_CAN,
      //       insert: [],
      //       update: { preMutation: [], postMutation: [] },
      //       delete: [],
      //     },
      //   },
      //   vote: {
      //     row: {
      //       select: ANYONE_CAN,
      //       insert: [],
      //       update: { preMutation: [], postMutation: [] },
      //       delete: [],
      //     },
      //   }
    }
  )
);

export type Schema = typeof schema;
