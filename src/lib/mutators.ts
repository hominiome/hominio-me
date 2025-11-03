// Client-side mutator definitions
// These run optimistically on the client for instant UI updates
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '../zero-schema';

export type AuthData = {
  sub: string; // User ID
  isAdmin?: boolean; // Admin flag (optional, checked server-side)
};

/**
 * Create mutators for Zero client
 * @param authData - Authentication data (optional, for client-side checks)
 */
export function createMutators(authData: AuthData | undefined) {
  return {
    project: {
      /**
       * Create a new project
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (founder OR admin)
       */
      create: async (
        tx: Transaction<Schema>,
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
        // Client-side validation
        if (!args.title || args.title.trim().length === 0) {
          throw new Error('Title is required');
        }

        if (!args.description || args.description.trim().length === 0) {
          throw new Error('Description is required');
        }

        // Insert project
        await tx.mutate.project.insert({
          id: args.id,
          title: args.title.trim(),
          description: args.description.trim(),
          country: args.country.trim(),
          city: args.city.trim(),
          userId: args.userId,
          videoUrl: (args.videoUrl || '').trim(),
          bannerImage: (args.bannerImage || '').trim(),
          profileImageUrl: (args.profileImageUrl || '').trim(),
          sdgs: args.sdgs,
          createdAt: args.createdAt,
        });
      },

      /**
       * Update a project
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (admin OR founder OR owner)
       */
      update: async (
        tx: Transaction<Schema>,
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
        const { id, ...updates } = args;

        // Client-side validation (optimistic)
        if (updates.title && updates.title.trim().length === 0) {
          throw new Error('Title cannot be empty');
        }

        if (updates.description && updates.description.trim().length === 0) {
          throw new Error('Description cannot be empty');
        }

        // Read existing project
        const project = await tx.query.project.where('id', id).one();

        if (!project) {
          throw new Error('Project not found');
        }

        // Prepare update data (trim strings, preserve empty strings as empty)
        const updateData: Partial<typeof project> = {};

        if (updates.title !== undefined) {
          updateData.title = updates.title.trim();
        }
        if (updates.description !== undefined) {
          updateData.description = updates.description.trim();
        }
        if (updates.country !== undefined) {
          updateData.country = updates.country.trim();
        }
        if (updates.city !== undefined) {
          updateData.city = updates.city.trim();
        }
        if (updates.videoUrl !== undefined) {
          updateData.videoUrl = updates.videoUrl.trim();
        }
        if (updates.bannerImage !== undefined) {
          updateData.bannerImage = updates.bannerImage.trim();
        }
        if (updates.profileImageUrl !== undefined) {
          updateData.profileImageUrl = updates.profileImageUrl.trim();
        }
        if (updates.sdgs !== undefined) {
          updateData.sdgs = updates.sdgs;
        }
        // Only admins can change userId (enforced server-side)
        if (updates.userId !== undefined) {
          updateData.userId = updates.userId;
        }

        // Update project
        await tx.mutate.project.update({ id, ...updateData });
      },

      /**
       * Delete a project
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (admin OR (founder AND owner))
       */
      delete: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
        }
      ) => {
        const { id } = args;

        // Read existing project to check ownership
        const project = await tx.query.project.where('id', id).one();

        if (!project) {
          throw new Error('Project not found');
        }

        // Delete project
        await tx.mutate.project.delete({ id });
      },
    },

    // ========================================
    // NOTIFICATION MUTATORS
    // ========================================

    notification: {
      /**
       * Create a notification
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Only admins or system can create notifications
       */
      create: async (
        tx: Transaction<Schema>,
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
        // Client-side validation
        if (!args.userId || args.userId.trim().length === 0) {
          throw new Error('userId is required');
        }
        if (!args.title || args.title.trim().length === 0) {
          throw new Error('title is required');
        }
        if (!args.message || args.message.trim().length === 0) {
          throw new Error('message is required');
        }

        await tx.mutate.notification.insert({
          id: args.id,
          userId: args.userId,
          resourceType: args.resourceType,
          resourceId: args.resourceId,
          title: args.title.trim(),
          previewTitle: args.previewTitle,
          message: args.message.trim(),
          read: args.read || 'false',
          createdAt: args.createdAt,
          actions: args.actions || '[]',
          sound: args.sound || '',
          icon: args.icon || '',
          displayComponent: args.displayComponent || '',
          priority: args.priority || 'false',
        });
      },

      /**
       * Mark a single notification as read
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates user owns the notification
       */
      markRead: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
        }
      ) => {
        const { id } = args;

        // Read existing notification to check ownership
        const notification = await tx.query.notification.where('id', id).one();

        if (!notification) {
          throw new Error('Notification not found');
        }

        // Update notification to mark as read
        await tx.mutate.notification.update({ 
          id, 
          read: 'true' 
        });
      },

      /**
       * Mark all non-priority notifications as read for a user
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates user is marking their own notifications
       */
      markAllRead: async (
        tx: Transaction<Schema>,
        args: {
          userId: string;
        }
      ) => {
        const { userId } = args;

        // Fetch all unread non-priority notifications for this user
        const notifications = await tx.query.notification
          .where('userId', userId)
          .where('read', 'false')
          .where('priority', '!=', 'true')
          .run();

        // Mark each one as read
        for (const notification of notifications) {
          await tx.mutate.notification.update({ 
            id: notification.id, 
            read: 'true' 
          });
        }
      },

      /**
       * Delete a notification
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates user owns the notification or is admin
       */
      delete: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
        }
      ) => {
        const { id } = args;

        // Read existing notification to check ownership
        const notification = await tx.query.notification.where('id', id).one();

        if (!notification) {
          throw new Error('Notification not found');
        }

        // Delete notification
        await tx.mutate.notification.delete({ id });
      },
    },

    // ========================================
    // IDENTITY PURCHASE MUTATORS
    // ========================================
    // Note: Purchases are typically created via /api/purchase-package (payment flow)
    // These mutators are mainly for admin operations (testing, refunds, adjustments)

    identityPurchase: {
      /**
       * Delete an identity purchase (admin only)
       * Client-side: Runs optimistically
       * Server-side: Only admins can delete purchases
       */
      delete: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
        }
      ) => {
        const { id } = args;
        
        // Read existing purchase to check it exists
        const purchase = await tx.query.identityPurchase.where('id', id).one();
        
        if (!purchase) {
          throw new Error('Purchase not found');
        }
        
        // Delete purchase
        await tx.mutate.identityPurchase.delete({ id });
      },
    },

    // ========================================
    // CUP MUTATORS
    // ========================================

    cup: {
      /**
       * Create a new cup
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Only admins can create cups
       */
      create: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
          name: string;
          description: string;
          logoImageUrl: string;
          size: number;
          creatorId: string;
          selectedProjectIds: string; // JSON string array
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
        // Client-side validation
        if (!args.name || args.name.trim().length === 0) {
          throw new Error('Cup name is required');
        }

        if (!args.creatorId || args.creatorId.trim().length === 0) {
          throw new Error('Creator ID is required');
        }

        // Validate size
        const validSizes = [4, 8, 16, 32, 64, 128];
        if (!validSizes.includes(args.size)) {
          throw new Error(`Invalid cup size. Must be one of: ${validSizes.join(', ')}`);
        }

        await tx.mutate.cup.insert({
          id: args.id,
          name: args.name.trim(),
          description: (args.description || '').trim(),
          logoImageUrl: (args.logoImageUrl || '').trim(),
          size: args.size,
          selectedProjectIds: args.selectedProjectIds || '[]',
          creatorId: args.creatorId,
          status: args.status || 'draft',
          currentRound: args.currentRound || '',
          winnerId: args.winnerId || '',
          createdAt: args.createdAt,
          startedAt: args.startedAt || '',
          completedAt: args.completedAt || '',
          updatedAt: args.updatedAt,
          endDate: args.endDate || '',
        });
      },

      /**
       * Update a cup
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Only admins can update cups
       */
      update: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
          name?: string;
          description?: string;
          logoImageUrl?: string;
        }
      ) => {
        const { id, ...updates } = args;

        // Client-side validation
        if (updates.name && updates.name.trim().length === 0) {
          throw new Error('Cup name cannot be empty');
        }

        // Read existing cup
        const cup = await tx.query.cup.where('id', id).one();

        if (!cup) {
          throw new Error('Cup not found');
        }

        // Prepare update data
        const updateData: Partial<typeof cup> = {
          updatedAt: new Date().toISOString(),
        };

        if (updates.name !== undefined) {
          updateData.name = updates.name.trim();
        }
        if (updates.description !== undefined) {
          updateData.description = (updates.description || '').trim();
        }
        if (updates.logoImageUrl !== undefined) {
          updateData.logoImageUrl = (updates.logoImageUrl || '').trim();
        }

        await tx.mutate.cup.update({ id, ...updateData });
      },

      /**
       * Add a project to a cup's selectedProjectIds array
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Only admins can add projects to cups
       */
      addProject: async (
        tx: Transaction<Schema>,
        args: {
          cupId: string;
          projectId: string;
        }
      ) => {
        const { cupId, projectId } = args;

        // Read cup ONCE right before updating to get the absolute latest state
        // This ensures we don't overwrite concurrent changes during rebase
        // In Zero transactions, this read sees all committed changes up to this point
        // CRITICAL: Must call .run() to execute the query
        const cup = await tx.query.cup.where('id', cupId).one().run();

        if (!cup) {
          throw new Error('Cup not found');
        }

        // Handle missing size field - cup may not be fully synced on client side
        // Use default size of 16 if missing (server will have correct value)
        const cupSize = cup.size ?? 16;
        if (!cupSize || cupSize < 1) {
          console.warn('[addProject] Cup has invalid size, using default 16:', { cupId, cupSize: cup.size, cupKeys: Object.keys(cup) });
          // Don't throw - server will validate correctly
        }

        // Allow adding projects if status is 'draft', empty, null, or undefined
        // (treat empty/null/undefined as draft for new cups)
        // Normalize status: handle null, undefined, empty string, or whitespace-only strings
        const rawStatus = cup.status;
        const cupStatus = rawStatus ? String(rawStatus).trim().toLowerCase() : '';
        
        // Only block if status is explicitly set to something other than 'draft'
        if (cupStatus && cupStatus !== 'draft') {
          throw new Error(`Cannot modify projects in active or completed cups. Current status: "${rawStatus || '(empty)'}"`);
        }

        // Parse current selected project IDs from the latest cup state
        // CRITICAL: Always parse from the latest read to avoid race conditions
        // Ensure we always have an array, even if the field is null/undefined/empty
        let selectedProjectIds: string[] = [];
        try {
          const rawSelectedIds = cup.selectedProjectIds;
          if (rawSelectedIds && typeof rawSelectedIds === 'string' && rawSelectedIds.trim()) {
            selectedProjectIds = JSON.parse(rawSelectedIds);
            // Ensure it's an array
            if (!Array.isArray(selectedProjectIds)) {
              console.warn('[addProject] selectedProjectIds is not an array, resetting:', rawSelectedIds);
              selectedProjectIds = [];
            }
          } else {
            selectedProjectIds = [];
          }
        } catch (e) {
          // If parsing fails, start with empty array
          console.warn('[addProject] Failed to parse selectedProjectIds:', e, 'raw:', cup.selectedProjectIds);
          selectedProjectIds = [];
        }

        console.log('[addProject] Current state:', {
          cupId,
          projectId,
          currentSelectedIds: selectedProjectIds,
          currentLength: selectedProjectIds.length,
          cupSize: cupSize,
          rawSelectedIds: cup.selectedProjectIds
        });

        // Validate using the latest state
        if (selectedProjectIds.length >= cupSize) {
          throw new Error(`Cannot add more than ${cupSize} projects`);
        }

        if (selectedProjectIds.includes(projectId)) {
          throw new Error('Project is already in the cup');
        }

        // Add project to selected list (append, don't overwrite)
        selectedProjectIds.push(projectId);

        console.log('[addProject] After append:', {
          cupId,
          projectId,
          newSelectedIds: selectedProjectIds,
          newLength: selectedProjectIds.length,
          willUpdateWith: JSON.stringify(selectedProjectIds)
        });

        // Update cup with the new array - Zero transaction ensures atomicity
        // CRITICAL: Only update selectedProjectIds and updatedAt - Zero's update merges with existing fields
        await tx.mutate.cup.update({
          id: cupId,
          selectedProjectIds: JSON.stringify(selectedProjectIds),
          updatedAt: new Date().toISOString(),
        });
      },

      /**
       * Remove a project from a cup's selectedProjectIds array
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Only admins can remove projects from cups
       */
      removeProject: async (
        tx: Transaction<Schema>,
        args: {
          cupId: string;
          projectId: string;
        }
      ) => {
        const { cupId, projectId } = args;

            // Read cup ONCE right before updating to get the absolute latest state
            // This ensures we don't overwrite concurrent changes during rebase
            // In Zero transactions, this read sees all committed changes up to this point
            // CRITICAL: Must call .run() to execute the query
            const cup = await tx.query.cup.where('id', cupId).one().run();

            if (!cup) {
              throw new Error('Cup not found');
            }

        // Allow removing projects if status is 'draft', empty, null, or undefined
        // (treat empty/null/undefined as draft for new cups)
        // Normalize status: handle null, undefined, empty string, or whitespace-only strings
        const rawStatus = cup.status;
        const cupStatus = rawStatus ? String(rawStatus).trim().toLowerCase() : '';
        
        // Only block if status is explicitly set to something other than 'draft'
        if (cupStatus && cupStatus !== 'draft') {
          throw new Error(`Cannot modify projects in active or completed cups. Current status: "${rawStatus || '(empty)'}"`);
        }

        // Parse current selected project IDs from the latest cup state
        // CRITICAL: Always parse from the latest read to avoid race conditions
        let selectedProjectIds: string[] = [];
        try {
          selectedProjectIds = cup.selectedProjectIds
            ? JSON.parse(cup.selectedProjectIds)
            : [];
        } catch (e) {
          selectedProjectIds = [];
        }

        // Remove project from selected list (filter out, don't overwrite)
        selectedProjectIds = selectedProjectIds.filter((id) => id !== projectId);

        // Update cup with the new array - Zero transaction ensures atomicity
        await tx.mutate.cup.update({
          id: cupId,
          selectedProjectIds: JSON.stringify(selectedProjectIds),
          updatedAt: new Date().toISOString(),
        });
      },
    },
  } as const;
}


