import type { ComponentResponse } from './types';
import type { MenuItem, CartItem, SpaBeautyService, TaxiService } from './types';

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

/**
 * Create SpaBeautyList component response
 */
export function createSpaBeautyListComponent(
  services: SpaBeautyService[],
  category?: string | null
): ComponentResponse {
  return createComponentResponse('SpaBeautyList', {
    services: services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      duration: service.duration, // Already formatted as "60 Min" in execute-action
      price: service.price,
      priceFormatted: service.priceFormatted,
      unit: service.unit || 'session',
      unitFormatted: service.unitFormatted || '/session',
      category: service.category
    })),
    category: category || null
  });
}

/**
 * Create TaxiList component response
 */
export function createTaxiListComponent(
  services: TaxiService[]
): ComponentResponse {
  return createComponentResponse('TaxiList', {
    services: services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      capacity: service.capacity,
      basePrice: service.basePrice,
      basePriceFormatted: service.basePriceFormatted,
      pricePerKm: service.pricePerKm,
      pricePerKmFormatted: service.pricePerKmFormatted,
      unit: service.unit
    }))
  });
}

/**
 * Create RoomServiceList component response (uses MenuList format)
 */
export function createRoomServiceListComponent(
  items: MenuItem[],
  category?: string | null
): ComponentResponse {
  return createComponentResponse('RoomServiceList', {
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

