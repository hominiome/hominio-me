// Role checking utilities
// These functions determine user roles and permissions
// All role checks that need database queries use Zero transactions

import { isAdmin as isAdminCheck } from '../admin.server';
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '../../zero-schema';

// Use any for ServerTransaction to avoid type complexity
// ServerTransaction is only used server-side in mutators
type AnyTransaction = Transaction<Schema> | any;

/**
 * Check if a user is an admin
 * This is a simple env var check - no database query needed
 * Admins are defined by the ADMIN environment variable
 * 
 * @param userId - The user ID to check
 * @returns true if user is admin, false otherwise
 */
export function isAdmin(userId: string): boolean {
    return isAdminCheck(userId);
}

/**
 * Check if a user has founder identity
 * A founder can create and manage projects
 * This requires a database query to check the userIdentities table
 * 
 * @param tx - Zero transaction (required for database query)
 * @param userId - The user ID to check
 * @returns Promise<boolean> - true if user has founder identity
 */
export async function isFounder(
    tx: AnyTransaction,
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
 * Check if a user has a specific role
 * 
 * Role definitions:
 * - 'admin': User ID matches ADMIN env var (no DB query)
 * - 'founder': User has founder identity in database (requires DB query)
 * - 'default': Everyone has this role
 * 
 * @param userId - The user ID to check
 * @param role - The role to check for
 * @param tx - Transaction (required for 'founder' role check)
 * @returns Promise<boolean> - true if user has the role
 */
export async function hasRole(
    userId: string,
    role: 'default' | 'founder' | 'admin',
    tx?: AnyTransaction
): Promise<boolean> {
    if (role === 'admin') {
        return isAdmin(userId);
    }

    if (role === 'founder') {
        if (!tx) {
            throw new Error('Transaction required to check founder role (database query needed)');
        }
        return await isFounder(tx, userId);
    }

    // Everyone has the default role
    return role === 'default';
}

