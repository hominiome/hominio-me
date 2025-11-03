// Server-side auth utilities for mutators
// These check permissions using Zero's ZQL against the database
import type { Transaction, ServerTransaction } from '@rocicorp/zero';
import type { Schema } from '../zero-schema';
import { isAdmin } from './admin.server';

/**
 * Check if user has founder identity
 * Uses Zero's ZQL to query userIdentities table
 */
export async function hasFounderIdentity(
  tx: Transaction<Schema> | ServerTransaction<Schema>,
  userId: string
): Promise<boolean> {
  try {
    const identities = await tx.query.userIdentities
      .where('userId', '=', userId)
      .where('identityType', '=', 'founder')
      .run();

    return identities.length > 0;
  } catch (error) {
    console.error('Error checking founder identity:', error);
    return false;
  }
}

/**
 * Check if user can update a project
 * Returns true if:
 * - User is admin, OR
 * - User has founder identity AND owns the project, OR
 * - User owns the project
 */
export async function canUpdateProject(
  tx: Transaction<Schema> | ServerTransaction<Schema>,
  projectId: string,
  userId: string
): Promise<boolean> {
  // Check if user is admin
  if (isAdmin(userId)) {
    return true;
  }

  // Get project to check ownership
  const project = await tx.query.project.where('id', projectId).one();

  if (!project) {
    return false;
  }

  // Check if user owns the project
  if (project.userId === userId) {
    // If user owns project, check if they have founder identity
    const hasFounder = await hasFounderIdentity(tx, userId);
    // Owner can update if they have founder identity
    return hasFounder;
  }

  return false;
}


