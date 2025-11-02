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
       * Enforces permissions: admin OR (founder AND owner)
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
            'Forbidden: Only admins and founders who own the project can update it'
          );
        }

        // If trying to change userId (project owner), only admins can do this
        if (newUserId !== undefined && newUserId !== null) {
          const userIsAdmin = isAdmin(authData.sub);
          if (!userIsAdmin) {
            throw new Error('Forbidden: Only admins can change project owner');
          }
        }

        // Delegate to client mutator (runs same logic but against server database)
        await clientMutators.project.update(tx, args);
      },

      /**
       * Delete a project (server-side)
       * Enforces permissions: admin OR (founder AND owner)
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

        // Check permissions (same as update - admin OR (founder AND owner))
        const canDelete = await canUpdateProject(tx, args.id, authData.sub);

        if (!canDelete) {
          throw new Error(
            'Forbidden: Only admins and founders who own the project can delete it'
          );
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
        // Check authentication
        if (!authData?.sub) {
          throw new Error('Unauthorized: Must be logged in to mark notifications as read');
        }

        // Verify the notification belongs to the user
        const notification = await tx.query.notification.where('id', args.id).one();

        if (!notification) {
          throw new Error('Notification not found');
        }

        // Check if user owns the notification or is admin
        const userIsAdmin = isAdmin(authData.sub);
        if (notification.userId !== authData.sub && !userIsAdmin) {
          throw new Error('Forbidden: You can only mark your own notifications as read');
        }

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

        // Check if user is marking their own notifications or is admin
        const userIsAdmin = isAdmin(authData.sub);
        if (args.userId !== authData.sub && !userIsAdmin) {
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
  } as const;
}

