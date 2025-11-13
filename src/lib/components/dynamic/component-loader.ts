import type { ComponentResponse } from './types';
import type { MenuItem, CartItem } from './types';

/**
 * Convert data to ComponentResponse format
 * This replaces the Mitosis JSON system with native Svelte components
 */
export function createComponentResponse(
  component: string,
  props: Record<string, any>
): ComponentResponse {
  return { component, props };
}

/**
 * Create MenuList component response
 */
export function createMenuListComponent(
  items: MenuItem[],
  category?: string | null
): ComponentResponse {
  return createComponentResponse('MenuList', {
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      priceFormatted: item.priceFormatted,
      unit: item.unit,
      unitFormatted: item.unitFormatted,
      category: item.category
    })),
    category: category || null
  });
}

/**
 * Create Cart component response
 */
export function createCartComponent(items: CartItem[]): ComponentResponse {
  return createComponentResponse('Cart', {
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      priceFormatted: item.priceFormatted,
      unit: item.unit,
      timeSlot: item.timeSlot
    }))
  });
}

