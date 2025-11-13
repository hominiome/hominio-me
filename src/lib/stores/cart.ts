import { writable } from 'svelte/store';

export interface CartItem {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  quantity: number;
  totalPrice: number;
  totalPriceFormatted: string;
  displayText: string;
  // For SPA/Beauty services
  timeSlot?: string;
  duration?: number;
  // For Taxi services
  pickupTime?: string; // Specific time (e.g., "14:30")
  pickupAddress?: string;
  destinationAddress?: string;
  estimatedDistance?: number; // in km
  // For Room Service
  deliveryDate?: string; // ISO date string (today or tomorrow)
  deliveryTime?: string; // Specific time (e.g., "09:00")
  type?: 'menu' | 'spa-beauty' | 'taxi' | 'room-service';
}

export interface Cart {
  items: CartItem[];
  total: number;
  totalFormatted: string;
}

// In-memory cart store (for MVP, no persistence)
const cartStore = writable<Cart>({
  items: [],
  total: 0,
  totalFormatted: '€0.00'
});

export const cart = cartStore;

export function addToCart(item: CartItem) {
  cartStore.update((cart) => {
    const existingItemIndex = cart.items.findIndex(i => i.id === item.id);
    
    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const updatedItems = [...cart.items];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + item.quantity,
        totalPrice: updatedItems[existingItemIndex].totalPrice + item.totalPrice,
        totalPriceFormatted: `€${(updatedItems[existingItemIndex].totalPrice + item.totalPrice).toFixed(2)}`,
        displayText: `${updatedItems[existingItemIndex].quantity + item.quantity}x ${item.name}`
      };
      
      const total = updatedItems.reduce((sum, i) => sum + i.totalPrice, 0);
      return {
        items: updatedItems,
        total,
        totalFormatted: `€${total.toFixed(2)}`
      };
    } else {
      // Add new item
      const newItems = [...cart.items, item];
      const total = newItems.reduce((sum, i) => sum + i.totalPrice, 0);
      return {
        items: newItems,
        total,
        totalFormatted: `€${total.toFixed(2)}`
      };
    }
  });
}

export function clearCart() {
  cartStore.set({
    items: [],
    total: 0,
    totalFormatted: '€0.00'
  });
}

export function getCart(): Cart {
  let currentCart: Cart = { items: [], total: 0, totalFormatted: '€0.00' };
  cartStore.subscribe((cart) => {
    currentCart = cart;
  })();
  return currentCart;
}

