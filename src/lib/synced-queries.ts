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

/**
 * ========================================
 * IDENTITY PURCHASE QUERIES
 * ========================================
 */

/**
 * Get all identity purchases, ordered by purchase date (newest first)
 */
export const allPurchases = syncedQuery(
  'allPurchases',
  z.tuple([]), // No arguments needed
  () => {
    return builder.identityPurchase.orderBy('purchasedAt', 'desc');
  }
);

/**
 * Get all purchases for a specific user, ordered by purchase date (newest first)
 */
export const purchasesByUser = syncedQuery(
  'purchasesByUser',
  z.tuple([z.string()]), // userId
  (userId: string) => {
    return builder.identityPurchase
      .where('userId', '=', userId)
      .orderBy('purchasedAt', 'desc');
  }
);

/**
 * Get all purchases for a specific cup, ordered by purchase date (newest first)
 */
export const purchasesByCup = syncedQuery(
  'purchasesByCup',
  z.tuple([z.string()]), // cupId
  (cupId: string) => {
    return builder.identityPurchase
      .where('cupId', '=', cupId)
      .orderBy('purchasedAt', 'desc');
  }
);

/**
 * Get a single purchase by ID
 */
export const purchaseById = syncedQuery(
  'purchaseById',
  z.tuple([z.string()]), // purchaseId
  (purchaseId: string) => {
    return builder.identityPurchase.where('id', '=', purchaseId);
  }
);

/**
 * ========================================
 * USER IDENTITIES QUERIES
 * ========================================
 */

/**
 * Get all user identities for a specific user
 */
export const identitiesByUser = syncedQuery(
  'identitiesByUser',
  z.tuple([z.string()]), // userId
  (userId: string) => {
    return builder.userIdentities.where('userId', '=', userId);
  }
);

/**
 * Get user's identity for a specific cup
 */
export const identityByUserAndCup = syncedQuery(
  'identityByUserAndCup',
  z.tuple([z.string(), z.string()]), // userId, cupId
  (userId: string, cupId: string) => {
    return builder.userIdentities
      .where('userId', '=', userId)
      .where('cupId', '=', cupId);
  }
);

/**
 * Get all identities for a specific cup
 */
export const identitiesByCup = syncedQuery(
  'identitiesByCup',
  z.tuple([z.string()]), // cupId
  (cupId: string) => {
    return builder.userIdentities.where('cupId', '=', cupId);
  }
);

