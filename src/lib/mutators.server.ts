// Server-side mutator definitions
// These add permission checks and server-only logic
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '../zero-schema';
import { createMutators } from './mutators';
import { canUpdateProject } from './auth-mutators.server';
import { isAdmin } from './admin.server';

// Type alias to avoid TypeScript complexity with ServerTransaction
// ServerTransaction requires 2 type arguments, but for our purposes we can simplify
type AnyTransaction = Transaction<Schema> | any;

export type AuthData = {
  sub: string; // User ID
  isAdmin?: boolean; // Admin flag (optional)
};

/**
 * Create server-side mutators with permission checks
 * @param authData - Authentication data from cookie session
 * @param clientMutators - Client mutators to reuse
 */
export function createServerMutators(
  authData: AuthData | undefined,
  clientMutators: any // Typed as any to avoid complex CustomMutatorDefs inference
) {
  return {
    project: {
      /**
       * Create a project (server-side)
       * Enforces permissions: founder OR admin
       */
      create: async (
        tx: AnyTransaction,
        args: {
          id: string;
          title: string;
          description: string;
          country: string;
          city: string;
          userId: string;
          videoUrl?: string;
          bannerImage?: string;
          profileImageUrl?: string;
          sdgs: string;
          createdAt: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to create projects');
        }

        // Check if user can create projects (must be founder OR admin)
        const userIsAdmin = isAdmin(authData.sub);
        const userIsFounder = await canUpdateProject(tx, '', authData.sub); // Will check founder identity

        // Only founder users or admins can create projects
        if (!userIsAdmin) {
          // Check founder identity
          const hasFounder = await tx.query.userIdentities
            .where('userId', '=', authData.sub)
            .where('identityType', '=', 'founder')
            .run();

          if (hasFounder.length === 0) {
            throw new Error(
              'Forbidden: Only founders and admins can create projects. Purchase a founder identity first.'
            );
          }
        }

        // If not admin, ensure user is creating project for themselves
        if (!userIsAdmin && args.userId !== authData.sub) {
          throw new Error('Forbidden: You can only create projects for yourself');
        }

        // Delegate to client mutator
        await clientMutators.project.create(tx, args);
      },

      /**
       * Update a project (server-side)
       * Enforces permissions: admin OR owner
       */
      update: async (
        tx: AnyTransaction,
        args: {
          id: string;
          title?: string;
          description?: string;
          country?: string;
          city?: string;
          videoUrl?: string;
          bannerImage?: string;
          profileImageUrl?: string;
          sdgs?: string;
          userId?: string; // Only admins can change owner
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to update projects');
        }

        const { id, userId: newUserId } = args;

        // Check permissions
        const canUpdate = await canUpdateProject(tx, id, authData.sub);

        if (!canUpdate) {
          throw new Error(
            'Forbidden: Only admins and project owners can update projects'
          );
        }

        // If trying to change userId (project owner), only admins can do this
        // But allow if the userId is the same (not actually changing owner)
        if (newUserId !== undefined && newUserId !== null) {
          // Get current project to check current owner
          const projects = await tx.query.project.where('id', '=', id).run();
          const currentProject = projects.length > 0 ? projects[0] : null;
          
          if (currentProject && newUserId !== currentProject.userId) {
            // userId is being changed to a different user - only admins allowed
            const userIsAdmin = isAdmin(authData.sub);
            if (!userIsAdmin) {
              throw new Error('Forbidden: Only admins can change project owner');
            }
          }
          // If userId is the same or not provided, allow the update (already checked permissions above)
        }

        // Delegate to client mutator (runs same logic but against server database)
        await clientMutators.project.update(tx, args);
      },

      /**
       * Delete a project (server-side)
       * Admin-only operation
       */
      delete: async (
        tx: AnyTransaction,
        args: {
          id: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to delete projects');
        }

        // Only admins can delete projects
        const userIsAdmin = isAdmin(authData.sub);
        if (!userIsAdmin) {
          throw new Error('Forbidden: Only admins can delete projects');
        }

        // Verify project exists
        const project = await tx.query.project.where('id', args.id).one();
        if (!project) {
          throw new Error('Project not found');
        }

        // Delegate to client mutator
        await clientMutators.project.delete(tx, args);
      },
    },

    // ========================================
    // NOTIFICATION MUTATORS
    // ========================================

    notification: {
      /**
       * Create a notification (server-side)
       * Only admins or system can create notifications
       */
      create: async (
        tx: AnyTransaction,
        args: {
          id: string;
          userId: string;
          resourceType: string;
          resourceId: string;
          title: string;
          previewTitle: string;
          message: string;
          read: string;
          createdAt: string;
          actions: string;
          sound: string;
          icon: string;
          displayComponent: string;
          priority: string;
          imageUrl?: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to create notifications');
        }

        // Only admins can create notifications manually
        // In production, notifications are typically created by system triggers
        const userIsAdmin = isAdmin(authData.sub);
        if (!userIsAdmin) {
          throw new Error('Forbidden: Only admins can create notifications manually');
        }

        // Delegate to client mutator
        await clientMutators.notification.create(tx, args);
      },

      /**
       * Mark a notification as read (server-side)
       * User can only mark their own notifications as read
       */
      markRead: async (
        tx: AnyTransaction,
        args: {
          id: string;
        }
      ) => {
        // Verify the notification exists
        const notification = await tx.query.notification.where('id', args.id).one();

        if (!notification) {
          throw new Error('Notification not found');
        }

        // Check admin status first - admins can mark any notification as read
        if (authData?.sub) {
          const userIsAdmin = isAdmin(authData.sub);

          // Admins can mark any notification as read
          if (userIsAdmin) {
            // Admin override - allow
          } else if (notification.userId && notification.userId !== 'undefined' && notification.userId !== 'null') {
            // Normalize user IDs for comparison (handle string/number mismatches)
            const authUserId = String(authData.sub).trim();
            const notifUserId = String(notification.userId).trim();

            // Check if user owns the notification
            if (notifUserId !== authUserId) {
              console.error('[markRead] Permission denied:', {
                authUserId: authUserId,
                notificationUserId: notifUserId,
                isAdmin: userIsAdmin,
                notificationId: args.id,
                userIdsMatch: notifUserId === authUserId,
                comparison: `"${notifUserId}" !== "${authUserId}"`
              });
              throw new Error('Forbidden: You can only mark your own notifications as read');
            }
          }
          // If notification.userId is missing/undefined/null, trust the synced query filter
          // The synced query (myNotifications) filters by userId, so if they can see it, it's theirs
          // This is safe because Zero's synced queries ensure users can only query their own notifications
        }
        // If no authData, trust the synced query filter (users can only see their own notifications)

        // Delegate to client mutator
        await clientMutators.notification.markRead(tx, args);
      },

      /**
       * Mark all non-priority notifications as read (server-side)
       * User can only mark their own notifications as read
       */
      markAllRead: async (
        tx: AnyTransaction,
        args: {
          userId: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to mark notifications as read');
        }

        // Normalize user IDs for comparison (handle string/number mismatches)
        const authUserId = String(authData.sub).trim();
        const requestUserId = String(args.userId).trim();

        // Check if user is marking their own notifications or is admin
        const userIsAdmin = isAdmin(authData.sub);
        if (requestUserId !== authUserId && !userIsAdmin) {
          console.error('[markAllRead] Permission denied:', {
            authUserId: authUserId,
            requestUserId: requestUserId,
            isAdmin: userIsAdmin
          });
          throw new Error('Forbidden: You can only mark your own notifications as read');
        }

        // Delegate to client mutator
        await clientMutators.notification.markAllRead(tx, args);
      },

      /**
       * Delete a notification (server-side)
       * User can only delete their own notifications
       */
      delete: async (
        tx: AnyTransaction,
        args: {
          id: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to delete notifications');
        }

        // Verify the notification belongs to the user
        const notification = await tx.query.notification.where('id', args.id).one();

        if (!notification) {
          throw new Error('Notification not found');
        }

        // Check if user owns the notification or is admin
        const userIsAdmin = isAdmin(authData.sub);
        if (notification.userId !== authData.sub && !userIsAdmin) {
          throw new Error('Forbidden: You can only delete your own notifications');
        }

        // Delegate to client mutator
        await clientMutators.notification.delete(tx, args);
      },
    },

    // ========================================
    // IDENTITY PURCHASE MUTATORS
    // ========================================
    // Note: Purchases are created via /api/purchase-package (payment flow)
    // These mutators are for admin operations only

    identityPurchase: {
      /**
       * Delete an identity purchase (server-side)
       * Only admins can delete purchases (for refunds, corrections, etc.)
       */
      delete: async (
        tx: AnyTransaction,
        args: {
          id: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to delete purchases');
        }

        // Only admins can delete purchases
        const userIsAdmin = isAdmin(authData.sub);
        if (!userIsAdmin) {
          throw new Error('Forbidden: Only admins can delete purchases');
        }

        // Verify the purchase exists
        const purchase = await tx.query.identityPurchase.where('id', args.id).one();

        if (!purchase) {
          throw new Error('Purchase not found');
        }

        // Delegate to client mutator
        await clientMutators.identityPurchase.delete(tx, args);
      },
    },

    // ========================================
    // CUP MUTATORS
    // ========================================

    cup: {
      /**
       * Create a cup (server-side)
       * Admin-only operation
       */
      create: async (
        tx: AnyTransaction,
        args: {
          id: string;
          name: string;
          description: string;
          logoImageUrl: string;
          size: number;
          creatorId: string;
          selectedProjectIds: string;
          status: string;
          currentRound: string;
          winnerId: string;
          createdAt: string;
          startedAt: string;
          completedAt: string;
          updatedAt: string;
          endDate: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to create cups');
        }

        // Only admins can create cups
        const userIsAdmin = isAdmin(authData.sub);
        if (!userIsAdmin) {
          throw new Error('Forbidden: Only admins can create cups');
        }

        // Delegate to client mutator
        await clientMutators.cup.create(tx, args);
      },

      /**
       * Update a cup (server-side)
       * Admin-only operation
       */
      update: async (
        tx: AnyTransaction,
        args: {
          id: string;
          name?: string;
          description?: string;
          logoImageUrl?: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to update cups');
        }

        // Only admins can update cups
        const userIsAdmin = isAdmin(authData.sub);
        if (!userIsAdmin) {
          throw new Error('Forbidden: Only admins can update cups');
        }

        // Verify cup exists
        const cup = await tx.query.cup.where('id', args.id).one();
        if (!cup) {
          throw new Error('Cup not found');
        }

        // Delegate to client mutator
        await clientMutators.cup.update(tx, args);
      },

      /**
       * Add a project to a cup (server-side)
       * Admin-only operation
       */
      addProject: async (
        tx: AnyTransaction,
        args: {
          cupId: string;
          projectId: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to add projects to cups');
        }

        // Only admins can add projects to cups
        const userIsAdmin = isAdmin(authData.sub);
        if (!userIsAdmin) {
          throw new Error('Forbidden: Only admins can add projects to cups');
        }

        console.log('[SERVER addProject] Processing mutation:', {
          cupId: args.cupId,
          projectId: args.projectId,
          userId: authData.sub,
          isAdmin: userIsAdmin
        });

        // Delegate to client mutator (which will read latest state and append)
        await clientMutators.cup.addProject(tx, args);

        console.log('[SERVER addProject] Mutation completed:', {
          cupId: args.cupId,
          projectId: args.projectId
        });
      },

      /**
       * Remove a project from a cup (server-side)
       * Admin-only operation
       */
      removeProject: async (
        tx: AnyTransaction,
        args: {
          cupId: string;
          projectId: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to remove projects from cups');
        }

        // Only admins can remove projects from cups
        const userIsAdmin = isAdmin(authData.sub);
        if (!userIsAdmin) {
          throw new Error('Forbidden: Only admins can remove projects from cups');
        }

        // Delegate to client mutator
        await clientMutators.cup.removeProject(tx, args);
      },
    },

    // ========================================
    // USER PREFERENCES MUTATORS
    // ========================================

    userPreferences: {
      /**
       * Create user preferences (server-side)
       * User can only create their own preferences
       */
      create: async (
        tx: AnyTransaction,
        args: {
          id: string;
          userId: string;
          newsletterSubscribed: string;
          updatedAt: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to create preferences');
        }

        // Check if user is creating their own preferences or is admin
        const userIsAdmin = isAdmin(authData.sub);
        if (args.userId !== authData.sub && !userIsAdmin) {
          throw new Error('Forbidden: You can only create your own preferences');
        }

        // Delegate to client mutator
        await clientMutators.userPreferences.create(tx, args);
      },

      /**
       * Update user preferences (server-side)
       * User can only update their own preferences
       */
      update: async (
        tx: AnyTransaction,
        args: {
          id: string;
          newsletterSubscribed?: string;
          updatedAt: string;
        }
      ) => {
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to update preferences');
        }

        // Verify preferences exist
        const preferences = await tx.query.userPreferences.where('id', args.id).one();
        if (!preferences) {
          throw new Error('User preferences not found');
        }

        // Check if user is updating their own preferences or is admin
        const userIsAdmin = isAdmin(authData.sub);
        if (preferences.userId !== authData.sub && !userIsAdmin) {
          throw new Error('Forbidden: You can only update your own preferences');
        }

        // Delegate to client mutator
        await clientMutators.userPreferences.update(tx, args);
      },
    },
  } as const;
}


