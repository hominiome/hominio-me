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

// Removed: identityByUserAndCup and identitiesByCup - all identities are now universal

/**
 * ========================================
 * VOTE QUERIES
 * ========================================
 */

/**
 * Get all votes
 */
export const allVotes = syncedQuery(
  'allVotes',
  z.tuple([]), // No arguments
  () => {
    return builder.vote.orderBy('createdAt', 'desc');
  }
);

/**
 * Get all votes by a specific user
 */
export const votesByUser = syncedQuery(
  'votesByUser',
  z.tuple([z.string()]), // userId
  (userId: string) => {
    return builder.vote
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc');
  }
);

/**
 * Get all votes for a specific match
 */
export const votesByMatch = syncedQuery(
  'votesByMatch',
  z.tuple([z.string()]), // matchId
  (matchId: string) => {
    return builder.vote.where('matchId', '=', matchId);
  }
);

/**
 * ========================================
 * CUP MATCH QUERIES
 * ========================================
 */

/**
 * Get all cup matches
 */
export const allMatches = syncedQuery(
  'allMatches',
  z.tuple([]), // No arguments
  () => {
    return builder.cupMatch.orderBy('position', 'asc');
  }
);

/**
 * Get all matches for a specific cup
 */
export const matchesByCup = syncedQuery(
  'matchesByCup',
  z.tuple([z.string()]), // cupId
  (cupId: string) => {
    return builder.cupMatch
      .where('cupId', '=', cupId)
      .orderBy('position', 'asc');
  }
);

/**
 * ========================================
 * CUP QUERIES
 * ========================================
 */

/**
 * Get all cups
 */
export const allCups = syncedQuery(
  'allCups',
  z.tuple([]), // No arguments
  () => {
    return builder.cup;
  }
);

/**
 * Get a single cup by ID
 */
export const cupById = syncedQuery(
  'cupById',
  z.tuple([z.string()]), // cupId
  (cupId: string) => {
    return builder.cup.where('id', '=', cupId);
  }
);

