'use strict';

// Order Management Module
// Handles loading orders from Supabase, real-time updates, and rendering order cards

(function() {
  let supabaseClient;
  let ordersSubscription = null;
  let currentUserId = null;

  // Get Supabase client from global scope
  function getSupabaseClient() {
    if (window.supabaseClient) {
      return window.supabaseClient;
    }
    // Fallback: try to get from login module
    if (typeof window.supabase !== 'undefined') {
      const SUPABASE_URL = 'https://fddutzbdtcgpunkagflp.supabase.co';
      const SUPABASE_ANON_KEY = 'sb_publishable_ouboZig1iVAlFVc1rNatIg_Z3buQJZl';
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return null;
  }

  // Get current user ID
  async function getCurrentUserId() {
    if (currentUserId) return currentUserId;
    
    supabaseClient = getSupabaseClient();
    if (!supabaseClient) return null;

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        currentUserId = session.user.id;
        return currentUserId;
      }
    } catch (error) {
      console.error('Error getting user ID:', error);
    }
    return null;
  }

  // Format date and time
  function formatDateTime(dateString) {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    return `${month} ${day}, ${year} • ${hours}:${minutesStr} ${ampm}`;
  }

  // Format payment method for display
  function formatPaymentMethod(method) {
    const methodMap = {
      'card': 'Card',
      'qr': 'Card',
      'upi': 'UPI',
      'cash': 'Pay at Counter'
    };
    return methodMap[method] || method;
  }

  // Get payment badge class
  function getPaymentBadgeClass(method) {
    const classMap = {
      'card': 'card',
      'qr': 'card',
      'upi': 'upi',
      'cash': 'counter'
    };
    return classMap[method] || 'card';
  }

  // Format order number for display
  function formatOrderNumber(orderNumber) {
    // Check for null, undefined, or empty string (but allow 0 as valid)
    if (orderNumber === null || orderNumber === undefined || orderNumber === '') {
      return 'N/A';
    }
    // Display as zero-padded format (e.g., "01", "02", "12")
    // order_number is stored as integer in DB, format with zero-padding for display
    const numStr = String(orderNumber);
    const paddedNum = numStr.padStart(2, '0');
    return paddedNum;
  }

  // Render a single order card
  function renderOrderCard(order) {
    // Use stored order_number from database
    // Check for null/undefined specifically (0 is a valid order number)
    let displayOrderNumber = order.order_number;
    
    // Log if order_number is missing for debugging
    if (displayOrderNumber === null || displayOrderNumber === undefined) {
      console.warn('Order number is null/undefined for order:', order.id, '- Order UUID:', order.id);
    }
    
    const orderDisplayText = formatOrderNumber(displayOrderNumber);
    const dateTime = formatDateTime(order.created_at);
    const paymentMethod = formatPaymentMethod(order.payment_method);
    const paymentBadgeClass = getPaymentBadgeClass(order.payment_method);
    
    // Get order items from the joined order_items table
    const orderItems = order.order_items || [];

    // Build items HTML
    let itemsHTML = '';
    if (orderItems.length === 0) {
      itemsHTML = '<div class="order-item"><div class="item-name">No items found</div></div>';
    } else {
      orderItems.forEach(item => {
        const itemTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
        itemsHTML += `
          <div class="order-item">
            <div class="item-name">${item.dish_name || 'Unknown Item'}</div>
            <div class="item-details">
              <span class="item-quantity">${item.quantity || 1} × ₹${parseFloat(item.price || 0).toFixed(2)}</span>
              <span class="item-subtotal">₹${itemTotal.toFixed(2)}</span>
            </div>
          </div>
        `;
      });
    }

    return `
      <div class="order-card" data-order-id="${order.id}" data-order-number="${displayOrderNumber || ''}">
        <div class="order-header">
          <div class="order-id">Order #${orderDisplayText}</div>
          <span class="payment-badge ${paymentBadgeClass}">${paymentMethod}</span>
        </div>
        <div class="order-date">${dateTime}</div>
        <div class="order-items">
          ${itemsHTML}
        </div>
        <div class="order-total">
          <span class="total-label">Total</span>
          <span class="total-amount">₹${parseFloat(order.total_amount || 0).toFixed(2)}</span>
        </div>
      </div>
    `;
  }

  // Render all orders
  async function renderOrders() {
    const ordersGrid = document.querySelector('.orders-grid');
    if (!ordersGrid) {
      console.error('Orders grid not found');
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available');
      ordersGrid.innerHTML = '<p>Please log in to view orders.</p>';
      return;
    }

    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not available');
      return;
    }

    try {
      // Fetch orders with their items for this restaurant (filtered by user_id)
      // Include order_number field to display restaurant-level order numbers
      const { data: orders, error } = await supabaseClient
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          payment_method,
          created_at,
          user_id,
          order_items (
            id,
            dish_id,
            dish_name,
            price,
            quantity
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }); // Latest first

      if (error) throw error;

      if (!orders || orders.length === 0) {
        ordersGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #6b7280; padding: 40px;">No orders yet. Orders will appear here when customers place them.</p>';
        return;
      }

      // Render order cards using stored order_number from database
      ordersGrid.innerHTML = orders.map(order => renderOrderCard(order)).join('');
    } catch (error) {
      console.error('Error loading orders:', error);
      ordersGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #dc2626; padding: 40px;">Error loading orders. Please refresh the page.</p>';
    }
  }

  // Set up real-time subscription for new orders
  async function setupRealtimeSubscription() {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available for real-time subscription');
      return;
    }

    supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not available for real-time subscription');
      return;
    }

    // Remove existing subscription if any
    if (ordersSubscription) {
      await supabaseClient.removeChannel(ordersSubscription);
    }

    // Create new subscription for orders
    ordersSubscription = supabaseClient
      .channel('orders_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('New order received:', payload.new);
          // Re-render orders to show the new one
          renderOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_items'
        },
        (payload) => {
          console.log('New order item received:', payload.new);
          // Re-render orders when items are added
          renderOrders();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active for orders and order_items');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to orders channel');
        }
      });
  }

  // Initialize order management
  async function initialize() {
    // Wait for Supabase client to be available
    let retries = 0;
    while (!getSupabaseClient() && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!getSupabaseClient()) {
      console.error('Supabase client not available after waiting');
      return;
    }

    // Wait a bit more for the orders grid to be loaded
    await new Promise(resolve => setTimeout(resolve, 500));

    // Render initial orders
    await renderOrders();

    // Set up real-time subscription
    await setupRealtimeSubscription();
  }

  // Expose functions globally
  window.orderManagementModule = {
    initialize: initialize,
    renderOrders: renderOrders,
    setupRealtimeSubscription: setupRealtimeSubscription
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initialize, 1000); // Wait for order_summary.html to load
    });
  } else {
    setTimeout(initialize, 1000);
  }
})();

