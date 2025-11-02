// Client-side synced query definitions
// This file must only be imported on the client side (browser)
// Synced queries require Zero client which is not available during SSR
import { syncedQuery } from '@rocicorp/zero';
import z from 'zod';
import { builder } from '../zero-schema';

/**
 * ========================================
 * NOTIFICATION QUERIES
 * ========================================
 */

/**
 * Get all notifications for a user, ordered by creation date (newest first)
 */
export const myNotifications = syncedQuery(
  'myNotifications',
  z.tuple([z.string()]), // userId
  (userId: string) => {
    return builder.notification
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc');
  }
);

/**
 * Get count of unread notifications for a user
 */
export const unreadNotificationCount = syncedQuery(
  'unreadNotificationCount',
  z.tuple([z.string()]), // userId
  (userId: string) => {
    return builder.notification
      .where('userId', '=', userId)
      .where('read', '=', 'false');
  }
);

/**
 * ========================================
 * PROJECT QUERIES
 * ========================================
 */

/**
 * Get all projects, ordered by creation date (newest first)
 */
export const allProjects = syncedQuery(
  'allProjects',
  z.tuple([]), // No arguments needed
  () => {
    return builder.project.orderBy('createdAt', 'desc');
  }
);

/**
 * Get a single project by ID
 */
export const projectById = syncedQuery(
  'projectById',
  z.tuple([z.string()]), // projectId
  (projectId: string) => {
    return builder.project.where('id', '=', projectId);
  }
);

/**
 * Get all projects by a specific user, ordered by creation date (newest first)
 */
export const projectsByUser = syncedQuery(
  'projectsByUser',
  z.tuple([z.string()]), // userId
  (userId: string) => {
    return builder.project
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc');
  }
);

