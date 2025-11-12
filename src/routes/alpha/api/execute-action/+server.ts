import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadView } from '$lib/mitosis/view-loader';
import menuData from '$lib/data/menu.json';
import spaBeautyData from '$lib/data/spa-beauty.json';
import taxiData from '$lib/data/taxi.json';
import roomServiceData from '$lib/data/room-service.json';
import type { CartItem, Cart } from '$lib/stores/cart';

// Removed todosStore - todos functionality removed

// In-memory cart storage for MVP (server-side)
let cartStore: Cart = {
  items: [],
  total: 0,
  totalFormatted: '€0.00'
};

function addToCartServer(item: CartItem) {
  const existingItemIndex = cartStore.items.findIndex(i => i.id === item.id);
  
  if (existingItemIndex >= 0) {
    // Update quantity if item already exists
    const updatedItems = [...cartStore.items];
    updatedItems[existingItemIndex] = {
      ...updatedItems[existingItemIndex],
      quantity: updatedItems[existingItemIndex].quantity + item.quantity,
      totalPrice: updatedItems[existingItemIndex].totalPrice + item.totalPrice,
      totalPriceFormatted: `€${(updatedItems[existingItemIndex].totalPrice + item.totalPrice).toFixed(2)}`,
      displayText: `${updatedItems[existingItemIndex].quantity + item.quantity}x ${item.name}`
    };
    
    const total = updatedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    cartStore = {
      items: updatedItems,
      total,
      totalFormatted: `€${total.toFixed(2)}`
    };
  } else {
    // Add new item
    const newItems = [...cartStore.items, item];
    const total = newItems.reduce((sum, i) => sum + i.totalPrice, 0);
    cartStore = {
      items: newItems,
      total,
      totalFormatted: `€${total.toFixed(2)}`
    };
  }
}

function clearCartServer() {
  cartStore = {
    items: [],
    total: 0,
    totalFormatted: '€0.00'
  };
}

function getCartServer(): Cart {
  return cartStore;
}

// Action handlers registry
const actionHandlers: Record<string, (params: any) => Promise<{ result: any; ui?: any; view?: string }>> = {
  async list_menu(params: { category?: string; view?: string } = {}) {
    const { category } = params;
    
    // Map German category names to JSON keys
    const categoryMap: Record<string, keyof typeof menuData.categories> = {
      'getränke': 'getraenke',
      'getraenke': 'getraenke',
      'drinks': 'getraenke',
      'vorspeisen': 'vorspeisen',
      'starter': 'vorspeisen',
      'vorspeise': 'vorspeisen',
      'hauptgerichte': 'hauptgerichte',
      'hauptgericht': 'hauptgerichte',
      'main': 'hauptgerichte',
      'nachspeisen': 'nachspeisen',
      'nachspeise': 'nachspeisen',
      'dessert': 'nachspeisen',
      'desserts': 'nachspeisen'
    };
    
    let menuItems: any[] = [];
    let selectedCategory: string | null = null;
    
    if (category) {
      // Normalize category name
      const normalizedCategory = category.toLowerCase().trim();
      const categoryKey = categoryMap[normalizedCategory];
      
      if (categoryKey && menuData.categories[categoryKey]) {
        menuItems = menuData.categories[categoryKey];
        selectedCategory = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
      } else {
        // If category not found, return empty
        menuItems = [];
      }
    } else {
      // Return all items from all categories
      Object.values(menuData.categories).forEach(items => {
        menuItems.push(...items);
      });
    }
    
    // Format prices for display
    const formattedMenuItems = menuItems.map(item => ({
      ...item,
      priceFormatted: `€${item.price.toFixed(2)}`,
      unitFormatted: `/${item.unit}`
    }));
    
    const output = { menuItems: formattedMenuItems, category: selectedCategory };
    
    // Load view by view-id (defaults to 'menu-list' if not specified)
    const viewId = params.view || 'menu-list';
    const ui = loadView(viewId, { menuItems: formattedMenuItems, category: selectedCategory });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },

  async list_spa_beauty(params: { category?: string; view?: string } = {}) {
    const { category } = params;
    
    // Map German category names to JSON keys
    const categoryMap: Record<string, keyof typeof spaBeautyData.categories> = {
      'massage': 'massage',
      'massagen': 'massage',
      'facial': 'facial',
      'gesichtsbehandlung': 'facial',
      'gesichtsbehandlungen': 'facial',
      'wellness': 'wellness',
      'sauna': 'wellness',
      'dampfbad': 'wellness'
    };
    
    let services: any[] = [];
    let selectedCategory: string | null = null;
    
    if (category) {
      const normalizedCategory = category.toLowerCase().trim();
      const categoryKey = categoryMap[normalizedCategory];
      
      if (categoryKey && spaBeautyData.categories[categoryKey]) {
        services = spaBeautyData.categories[categoryKey];
        selectedCategory = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
      } else {
        services = [];
      }
    } else {
      // Return all services from all categories
      Object.values(spaBeautyData.categories).forEach(categoryServices => {
        services.push(...categoryServices);
      });
    }
    
    // Format prices and add available slots info
    const formattedServices = services.map(service => ({
      ...service,
      priceFormatted: `€${service.price.toFixed(2)}`,
      unitFormatted: `/${service.unit}`,
      availableSlotsCount: service.availableSlots.filter((slot: any) => slot.available).length
    }));
    
    const output = { services: formattedServices, category: selectedCategory };
    
    const viewId = params.view || 'spa-beauty-list';
    const ui = loadView(viewId, { services: formattedServices, category: selectedCategory });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },

  async add_to_cart(params: { items: Array<{ id: string; quantity?: number; timeSlot?: string; pickupTime?: string; pickupAddress?: string; destinationAddress?: string; estimatedDistance?: number; deliveryTime?: string }>; view?: string }) {
    const { items } = params;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }
    
    // Collect all menu items from all categories
    const allMenuItems: any[] = [];
    Object.values(menuData.categories).forEach(categoryItems => {
      allMenuItems.push(...categoryItems);
    });
    
    // Collect all SPA/Beauty services from all categories
    const allSpaServices: any[] = [];
    Object.values(spaBeautyData.categories).forEach(categoryServices => {
      allSpaServices.push(...categoryServices);
    });
    
    // Collect all Taxi services
    const allTaxiServices = taxiData.services;
    
    // Collect all Room Service items from all categories
    const allRoomServiceItems: any[] = [];
    Object.values(roomServiceData.categories).forEach(categoryItems => {
      allRoomServiceItems.push(...categoryItems);
    });
    
    // Build cart items
    const cartItems: CartItem[] = items.map(orderItem => {
      // Try to find in menu first
      let foundItem = allMenuItems.find(item => item.id === orderItem.id);
      let itemType: 'menu' | 'spa-beauty' | 'taxi' | 'room-service' = 'menu';
      
      // If not found in menu, try SPA/Beauty services
      if (!foundItem) {
        foundItem = allSpaServices.find(item => item.id === orderItem.id);
        itemType = 'spa-beauty';
      }
      
      // If not found, try Taxi services
      if (!foundItem) {
        foundItem = allTaxiServices.find(item => item.id === orderItem.id);
        itemType = 'taxi';
      }
      
      // If not found, try Room Service
      if (!foundItem) {
        foundItem = allRoomServiceItems.find(item => item.id === orderItem.id);
        itemType = 'room-service';
      }
      
      if (!foundItem) {
        const allItems = [...allMenuItems, ...allSpaServices, ...allTaxiServices, ...allRoomServiceItems];
        const availableItems = allItems.map(item => `${item.name} (${item.id})`).join(', ');
        throw new Error(`Item with ID "${orderItem.id}" not found. Available items: ${availableItems}`);
      }
      
      const quantity = orderItem.quantity || 1;
      
      // Calculate total price based on item type
      let totalPrice: number;
      if (itemType === 'taxi') {
        // Taxi: basePrice + (pricePerKm * estimatedDistance)
        const distance = orderItem.estimatedDistance || 5; // Default 5km if not specified
        totalPrice = (foundItem.basePrice + (foundItem.pricePerKm * distance)) * quantity;
      } else {
        totalPrice = foundItem.price * quantity;
      }
      
      const cartItem: CartItem = {
        id: foundItem.id,
        name: foundItem.name,
        description: foundItem.description,
        price: itemType === 'taxi' ? foundItem.basePrice : foundItem.price,
        unit: foundItem.unit,
        quantity,
        totalPrice,
        totalPriceFormatted: `€${totalPrice.toFixed(2)}`,
        displayText: `${quantity}x ${foundItem.name}`,
        type: itemType
      };
      
      // Add time slot for SPA/Beauty services (if provided)
      if (itemType === 'spa-beauty') {
        cartItem.duration = foundItem.duration;
        if (orderItem.timeSlot) {
          cartItem.timeSlot = orderItem.timeSlot;
          cartItem.displayText = `${quantity}x ${foundItem.name} um ${orderItem.timeSlot} Uhr`;
        }
      }
      
      // Add pickup time and addresses for Taxi services
      if (itemType === 'taxi') {
        if (orderItem.pickupTime) {
          cartItem.pickupTime = orderItem.pickupTime;
          cartItem.displayText = `${quantity}x ${foundItem.name} um ${orderItem.pickupTime} Uhr`;
        }
        if (orderItem.pickupAddress) {
          cartItem.pickupAddress = orderItem.pickupAddress;
        }
        if (orderItem.destinationAddress) {
          cartItem.destinationAddress = orderItem.destinationAddress;
        }
        if (orderItem.estimatedDistance) {
          cartItem.estimatedDistance = orderItem.estimatedDistance;
        }
      }
      
      // Add delivery date and time for Room Service
      if (itemType === 'room-service') {
        const deliveryDate = getDeliveryDate(foundItem.availableUntil);
        cartItem.deliveryDate = deliveryDate;
        if (orderItem.deliveryTime) {
          cartItem.deliveryTime = orderItem.deliveryTime;
          const dateLabel = deliveryDate === new Date().toISOString().split('T')[0] ? 'heute' : 'morgen';
          cartItem.displayText = `${quantity}x ${foundItem.name} ${dateLabel} um ${orderItem.deliveryTime} Uhr`;
        } else {
          const dateLabel = deliveryDate === new Date().toISOString().split('T')[0] ? 'heute' : 'morgen';
          cartItem.displayText = `${quantity}x ${foundItem.name} ${dateLabel}`;
        }
      }
      
      return cartItem;
    });
    
    // Add items to cart
    cartItems.forEach(item => addToCartServer(item));
    
    // Get updated cart
    const cart = getCartServer();
    
    // Check if any SPA/Beauty services were added without time slots
    const addedSpaItemsWithoutSlots = cartItems.filter(item => 
      item.type === 'spa-beauty' && !item.timeSlot
    );
    
    // If SPA items without slots were added, show time slot selection UI for the first one
    if (addedSpaItemsWithoutSlots.length > 0) {
      const firstService = addedSpaItemsWithoutSlots[0];
      const allSpaServices: any[] = [];
      Object.values(spaBeautyData.categories).forEach(categoryServices => {
        allSpaServices.push(...categoryServices);
      });
      const serviceData = allSpaServices.find(s => s.id === firstService.id);
      
      if (serviceData) {
        const output = {
          cart,
          needsTimeSlot: true,
          service: {
            id: serviceData.id,
            name: serviceData.name,
            availableSlots: serviceData.availableSlots
          },
          success: true,
          message: `Added ${cartItems.length} item(s) to cart. Please select a time slot for ${serviceData.name}.`
        };
        
        // Load time slot selection view for mini-modal display
        const viewId = params.view || 'time-slot-selection';
        const ui = loadView(viewId, { service: output.service });
        
        return {
          result: output,
          ui,
          view: viewId
        };
      }
    }
    
    const output = {
      cart,
      success: true,
      message: `Added ${cartItems.length} item(s) to cart`
    };
    
    // Load cart view for mini-modal display
    const viewId = params.view || 'cart';
    const ui = loadView(viewId, { cart });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },

  async get_cart(params: { view?: string } = {}) {
    const cart = getCartServer();
    
    // Check if there are SPA/Beauty services without time slots
    const spaItemsWithoutSlots = cart.items.filter(item => 
      item.type === 'spa-beauty' && !item.timeSlot
    );
    
    // If there are SPA items without slots, show time slot selection UI for the first one
    if (spaItemsWithoutSlots.length > 0) {
      const firstService = spaItemsWithoutSlots[0];
      const allSpaServices: any[] = [];
      Object.values(spaBeautyData.categories).forEach(categoryServices => {
        allSpaServices.push(...categoryServices);
      });
      const serviceData = allSpaServices.find(s => s.id === firstService.id);
      
      if (serviceData) {
        const output = {
          cart,
          needsTimeSlot: true,
          service: {
            id: serviceData.id,
            name: serviceData.name,
            availableSlots: serviceData.availableSlots
          },
          success: true
        };
        
        // Load time slot selection view for mini-modal display
        const viewId = params.view || 'time-slot-selection';
        const ui = loadView(viewId, { service: output.service });
        
        return {
          result: output,
          ui,
          view: viewId
        };
      }
    }
    
    const output = {
      cart,
      success: true
    };
    
    // Load cart view for mini-modal display
    const viewId = params.view || 'cart';
    const ui = loadView(viewId, { cart });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },

  async select_time_slot(params: { serviceId: string; timeSlot: string; view?: string }) {
    const { serviceId, timeSlot } = params;
    
    if (!serviceId || !timeSlot) {
      throw new Error('Service ID and time slot are required');
    }
    
    // Find the service
    const allSpaServices: any[] = [];
    Object.values(spaBeautyData.categories).forEach(categoryServices => {
      allSpaServices.push(...categoryServices);
    });
    
    const service = allSpaServices.find(s => s.id === serviceId);
    if (!service) {
      throw new Error(`Service with ID "${serviceId}" not found`);
    }
    
    // Check if time slot exists and is available
    const slot = service.availableSlots.find((s: any) => s.time === timeSlot);
    if (!slot) {
      const availableSlots = service.availableSlots
        .filter((s: any) => s.available)
        .map((s: any) => s.time)
        .join(', ');
      throw new Error(`Time slot "${timeSlot}" not found for "${service.name}". Available slots: ${availableSlots}`);
    }
    
    if (!slot.available) {
      const availableSlots = service.availableSlots
        .filter((s: any) => s.available)
        .map((s: any) => s.time)
        .join(', ');
      throw new Error(`Time slot "${timeSlot}" is not available for "${service.name}". Available slots: ${availableSlots}`);
    }
    
    // Update the cart item with the selected time slot
    const cart = getCartServer();
    const cartItemIndex = cart.items.findIndex(item => item.id === serviceId && item.type === 'spa-beauty' && !item.timeSlot);
    
    if (cartItemIndex >= 0) {
      // Update the cart item
      const updatedItems = [...cart.items];
      updatedItems[cartItemIndex] = {
        ...updatedItems[cartItemIndex],
        timeSlot: timeSlot,
        displayText: `${updatedItems[cartItemIndex].quantity}x ${service.name} um ${timeSlot} Uhr`
      };
      
      // Update cart store
      const total = updatedItems.reduce((sum, i) => sum + i.totalPrice, 0);
      cartStore = {
        items: updatedItems,
        total,
        totalFormatted: `€${total.toFixed(2)}`
      };
    }
    
    // Get updated cart
    const updatedCart = getCartServer();
    
    const output = {
      serviceId,
      serviceName: service.name,
      timeSlot,
      duration: service.duration,
      cart: updatedCart,
      success: true,
      message: `Time slot ${timeSlot} selected for ${service.name}`
    };
    
    // Show updated cart in mini-modal
    const viewId = params.view || 'cart';
    const ui = loadView(viewId, { cart: updatedCart });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },

  async confirm_order(params: { view?: string } = {}) {
    const cart = getCartServer();
    
    if (cart.items.length === 0) {
      throw new Error('Cart is empty. Add items to cart before confirming order.');
    }
    
    // Check if SPA/Beauty services have time slots
    const spaItemsWithoutSlots = cart.items.filter(item => 
      item.type === 'spa-beauty' && !item.timeSlot
    );
    
    if (spaItemsWithoutSlots.length > 0) {
      const serviceNames = spaItemsWithoutSlots.map(item => item.name).join(', ');
      // Get available slots for the first service without slot
      const firstService = spaItemsWithoutSlots[0];
      const allSpaServices: any[] = [];
      Object.values(spaBeautyData.categories).forEach(categoryServices => {
        allSpaServices.push(...categoryServices);
      });
      const serviceData = allSpaServices.find(s => s.id === firstService.id);
      const availableSlots = serviceData 
        ? serviceData.availableSlots.filter((s: any) => s.available).map((s: any) => s.time).join(', ')
        : 'keine verfügbar';
      throw new Error(`Time slots are required for SPA/Beauty services: ${serviceNames}. Available slots for "${firstService.name}": ${availableSlots}. Please select time slots first using select_time_slot.`);
    }
    
    // Build order from cart
    const order = {
      items: cart.items,
      total: cart.total,
      totalFormatted: cart.totalFormatted,
      timestamp: new Date().toISOString()
    };
    
    const output = {
      order,
      success: true,
      message: 'Order confirmed successfully'
    };
    
    // Clear cart after order confirmation
    clearCartServer();
    
    // Load order confirmation view for mini-modal display
    const viewId = params.view || 'order-confirmation';
    const ui = loadView(viewId, { order });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },

  async list_taxi(params: { view?: string } = {}) {
    // Format prices for display
    const formattedServices = taxiData.services.map(service => ({
      ...service,
      basePriceFormatted: `€${service.basePrice.toFixed(2)}`,
      pricePerKmFormatted: `€${service.pricePerKm.toFixed(2)}`
    }));
    
    const output = { services: formattedServices };
    
    const viewId = params.view || 'taxi-list';
    const ui = loadView(viewId, { services: formattedServices });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },

  async list_room_service(params: { category?: string; view?: string } = {}) {
    const { category } = params;
    
    // Map German category names to JSON keys
    const categoryMap: Record<string, keyof typeof roomServiceData.categories> = {
      'breakfast': 'breakfast',
      'frühstück': 'breakfast',
      'lunch': 'lunch',
      'mittagessen': 'lunch',
      'dinner': 'dinner',
      'abendessen': 'dinner',
      'snacks': 'snacks',
      'snack': 'snacks'
    };
    
    let services: any[] = [];
    let selectedCategory: string | null = null;
    
    if (category) {
      const normalizedCategory = category.toLowerCase().trim();
      const categoryKey = categoryMap[normalizedCategory];
      
      if (categoryKey && roomServiceData.categories[categoryKey]) {
        services = roomServiceData.categories[categoryKey];
        selectedCategory = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
      } else {
        services = [];
      }
    } else {
      // Return all services from all categories
      Object.values(roomServiceData.categories).forEach(categoryServices => {
        services.push(...categoryServices);
      });
    }
    
    // Format prices
    const formattedServices = services.map(service => ({
      ...service,
      priceFormatted: `€${service.price.toFixed(2)}`,
      unitFormatted: `/${service.unit}`
    }));
    
    const output = { services: formattedServices, category: selectedCategory };
    
    const viewId = params.view || 'room-service-list';
    const ui = loadView(viewId, { services: formattedServices, category: selectedCategory });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },
};

// Helper function to check if room service can be ordered for today
function canOrderRoomServiceForToday(availableUntil: string): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute; // minutes since midnight
  
  // Parse availableUntil (e.g., "11:00")
  const [hours, minutes] = availableUntil.split(':').map(Number);
  const availableUntilTime = hours * 60 + minutes;
  
  return currentTime < availableUntilTime;
}

// Helper function to get delivery date (today or tomorrow)
function getDeliveryDate(availableUntil: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (canOrderRoomServiceForToday(availableUntil)) {
    return today.toISOString().split('T')[0]; // Today
  } else {
    return tomorrow.toISOString().split('T')[0]; // Tomorrow
  }
}

/**
 * Universal action execution endpoint
 * POST /alpha/api/execute-action
 * Body: { action: string, params?: Record<string, any> }
 * 
 * Hume's LLM automatically extracts action and params from user's natural language request.
 * The tool schema guides Hume's LLM to intelligently parse the request.
 * This endpoint is fully generic and can handle any action type.
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, params = {} } = body;

    if (!action || typeof action !== 'string') {
      return error(400, 'action is required and must be a string');
    }

    const handler = actionHandlers[action];
    if (!handler) {
      return error(404, `Action "${action}" not found`);
    }

    // Execute the action with the extracted params
    const { result, ui } = await handler(params);

    console.log('[Execute Action] Action:', action, 'UI:', ui ? 'present' : 'missing', 'Result:', result);

    return json({
      success: true,
      action,
      result,
      ui
    });
  } catch (err: any) {
    console.error('[Execute Action] Error:', err);
    return error(500, err.message || 'Action execution failed');
  }
};

