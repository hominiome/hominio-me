// Standardized data types for dynamic Svelte components

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  priceFormatted: string;
  unit: string;
  unitFormatted: string;
  category?: string;
}

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed';
  createdAt: string;
}

export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  priceFormatted: string;
  unit?: string;
  timeSlot?: string;
}

export interface SpaBeautyService {
  id: string;
  name: string;
  description: string;
  duration: string | number; // Can be number (minutes) or formatted string
  price: number;
  priceFormatted: string;
  category: string;
  unit?: string;
  unitFormatted?: string;
}

export interface TaxiService {
  id: string;
  name: string;
  description: string;
  capacity: number;
  basePrice: number;
  basePriceFormatted: string;
  pricePerKm: number;
  pricePerKmFormatted: string;
  unit: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

// Component response from server
export interface ComponentResponse {
  component: string; // Component name like 'MenuList', 'Cart', etc.
  props: Record<string, any>; // Props to pass to component
}

