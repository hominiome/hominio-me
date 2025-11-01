import { nanoid } from "nanoid";
import type { Zero } from "@rocicorp/zero";

export type EntityType = 'user' | 'project' | 'match' | 'cup';

export interface Wallet {
    id: string;
    entityType: EntityType;
    entityId: string;
    balance: number;
    createdAt: string;
    updatedAt: string;
}

export interface Transaction {
    id: string;
    fromWalletId: string | null;
    toWalletId: string | null;
    amount: number;
    type: 'purchase' | 'vote' | 'prize' | 'refund';
    metadata: string;
    createdAt: string;
}

/**
 * Get or create a wallet for an entity
 * @param zero - Zero instance
 * @param entityType - Type of entity (user, project, match, cup)
 * @param entityId - ID of the entity
 * @returns Wallet object
 */
export async function getOrCreateWallet(
  zero: any,
  entityType: EntityType,
  entityId: string
): Promise<Wallet> {
  // Query for existing wallet
  const query = zero.query.wallet
    .where('entityType', '=', entityType)
    .where('entityId', '=', entityId);
  
  const view = query.materialize();
  
  // Wait for data to be populated
  let results = await new Promise<any[]>((resolve) => {
    view.addListener((data: any) => {
      resolve(Array.from(data));
    });
  });
  
  view.destroy();

  if (results.length > 0) {
    return results[0] as Wallet;
  }

  // Create new wallet with unique composite key check
  const now = new Date().toISOString();
  const walletId = nanoid();
  const wallet: Wallet = {
    id: walletId,
    entityType,
    entityId,
    balance: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await zero.mutate.wallet.insert(wallet);
  } catch (error) {
    // If insert fails (race condition), query again
    const retryQuery = zero.query.wallet
      .where('entityType', '=', entityType)
      .where('entityId', '=', entityId);
    const retryView = retryQuery.materialize();
    
    results = await new Promise<any[]>((resolve) => {
      retryView.addListener((data: any) => {
        resolve(Array.from(data));
      });
    });
    
    retryView.destroy();
    
    if (results.length > 0) {
      return results[0] as Wallet;
    }
    
    throw error; // Re-throw if still failing
  }
  
  return wallet;
}

/**
 * Get wallet by ID
 * @param zero - Zero instance
 * @param walletId - Wallet ID
 * @returns Wallet object or null
 */
export async function getWallet(
    zero: any,
    walletId: string
): Promise<Wallet | null> {
    const query = zero.query.wallet.where('id', '=', walletId);
    const view = query.materialize();

    // Wait for data to be populated
    const results = await new Promise<any[]>((resolve) => {
        view.addListener((data: any) => {
            resolve(Array.from(data));
        });
    });

    view.destroy();

    return results.length > 0 ? (results[0] as Wallet) : null;
}

/**
 * Transfer hearts between wallets
 * @param zero - Zero instance
 * @param fromWalletId - Source wallet ID
 * @param toWalletId - Destination wallet ID
 * @param amount - Number of hearts to transfer
 * @param type - Transaction type
 * @param metadata - Additional context (optional)
 * @throws Error if wallet not found or insufficient balance
 */
export async function transferHearts(
    zero: any,
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    type: 'vote' | 'prize' | 'refund',
    metadata?: Record<string, any>
): Promise<void> {
    // Get wallets
    const fromWallet = await getWallet(zero, fromWalletId);
    const toWallet = await getWallet(zero, toWalletId);

    if (!fromWallet) {
        throw new Error(`Source wallet not found: ${fromWalletId}`);
    }
    if (!toWallet) {
        throw new Error(`Destination wallet not found: ${toWalletId}`);
    }
    if (fromWallet.balance < amount) {
        throw new Error(`Insufficient balance: ${fromWallet.balance} < ${amount}`);
    }

    const now = new Date().toISOString();

    // Create transaction record
    await zero.mutate.transaction.insert({
        id: nanoid(),
        fromWalletId,
        toWalletId,
        amount,
        type,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        createdAt: now,
    });

    // Update balances (Zero auto-syncs)
    await zero.mutate.wallet.update({
        id: fromWalletId,
        balance: fromWallet.balance - amount,
        updatedAt: now,
    });

    await zero.mutate.wallet.update({
        id: toWalletId,
        balance: toWallet.balance + amount,
        updatedAt: now,
    });
}

/**
 * Purchase hearts (creates new hearts from nothing)
 * @param zero - Zero instance
 * @param userWalletId - User's wallet ID
 * @param amount - Number of hearts to purchase
 * @throws Error if wallet not found
 */
export async function purchaseHearts(
    zero: any,
    userWalletId: string,
    amount: number
): Promise<void> {
    const now = new Date().toISOString();

    // Create purchase transaction (no fromWallet - system generated)
    await zero.mutate.transaction.insert({
        id: nanoid(),
        fromWalletId: null, // null = system/purchase
        toWalletId: userWalletId,
        amount,
        type: 'purchase',
        metadata: JSON.stringify({ timestamp: Date.now() }),
        createdAt: now,
    });

    // Get fresh wallet data after transaction is created
    const wallet = await getWallet(zero, userWalletId);
    if (!wallet) {
        throw new Error(`Wallet not found: ${userWalletId}`);
    }

    // Update wallet balance using set-based mutation
    await zero.mutate.wallet.update({
        id: userWalletId,
        balance: wallet.balance + amount,
        updatedAt: now,
    });

    console.log(`✅ Purchased ${amount} hearts. New balance: ${wallet.balance + amount}`);
}

/**
 * Get wallet balance
 * @param zero - Zero instance
 * @param entityType - Entity type
 * @param entityId - Entity ID
 * @returns Current balance or 0 if wallet doesn't exist
 */
export async function getBalance(
    zero: any,
    entityType: EntityType,
    entityId: string
): Promise<number> {
    const wallet = await getOrCreateWallet(zero, entityType, entityId);
    return wallet.balance;
}

/**
 * Get user's wallet and balance
 * @param zero - Zero instance
 * @param userId - User ID
 * @returns Wallet with balance
 */
export async function getUserWallet(
    zero: any,
    userId: string
): Promise<Wallet> {
    return getOrCreateWallet(zero, 'user', userId);
}

