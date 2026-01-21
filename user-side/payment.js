function renderOrderSummary() {
  const cart = JSON.parse(localStorage.getItem('cart')) || {};
  const summaryDiv = document.getElementById('orderSummary');
  const paymentDiv = document.getElementById('paymentMethods');
  const payBtn = document.getElementById('payBtn');

  if (Object.keys(cart).length === 0) {
    summaryDiv.innerHTML = `
      <div class="empty-cart">
        <p>Your cart is empty</p>
        <a href="cart.html" class="back-btn">Back to Cart</a>
      </div>
    `;
    paymentDiv.style.display = 'none';
    payBtn.style.display = 'none';
    return;
  }

  let subtotal = 0;

  // Check if items are more than 5 to make it scrollable
  const itemCount = Object.keys(cart).length;
  const itemsWrapperClass = itemCount > 5 ? 'order-items-wrapper scrollable' : 'order-items-wrapper';
  const hasMoreItems = itemCount > 5;

  let html = `<h2>Order Summary</h2><div class="${itemsWrapperClass}">`;
  
  Object.values(cart).forEach(item => {
    const price = parseFloat(item.price.replace('₹', '').replace(',', ''));
    const itemTotal = price * item.qty;
    subtotal += itemTotal;

    html += `
      <div class="order-item">
        <div class="order-item-info">
          <strong>${item.name}</strong>
          <span>Qty: ${item.qty} × ${item.price}</span>
        </div>
        <div class="order-item-price">₹${itemTotal.toFixed(2)}</div>
      </div>
    `;
  });

  const total = subtotal;

  html += `</div>
    <div class="total-section">
      <div class="total-row final">
        <span>Total</span>
        <span>₹${total.toFixed(2)}</span>
      </div>
    </div>
  `;

  summaryDiv.innerHTML = html;
  
  // Add class to show fade effect when there are more than 5 items
  if (hasMoreItems) {
    summaryDiv.classList.add('has-more-items');
    
    // Handle scroll to show/hide fade effect dynamically
    const scrollableWrapper = summaryDiv.querySelector('.order-items-wrapper.scrollable');
    if (scrollableWrapper) {
      const updateFadeEffect = () => {
        const scrollTop = scrollableWrapper.scrollTop;
        const scrollHeight = scrollableWrapper.scrollHeight;
        const clientHeight = scrollableWrapper.clientHeight;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px threshold
        
        // Hide fade when scrolled to bottom, show when there's more content
        if (isAtBottom) {
          summaryDiv.classList.remove('has-more-items');
        } else {
          summaryDiv.classList.add('has-more-items');
        }
      };
      
      scrollableWrapper.addEventListener('scroll', updateFadeEffect);
      updateFadeEffect(); // Initial check
    }
  } else {
    summaryDiv.classList.remove('has-more-items');
  }
}

function renderPaymentMethods() {
  const paymentDiv = document.getElementById('paymentMethods');
  paymentDiv.innerHTML = `
    <h2>Select Payment Method</h2>
    <div class="payment-option" onclick="selectPayment(this, 'qr', event)">
      <div class="payment-option-header">
        <input type="radio" name="payment" id="qr" value="qr">
        <label for="qr">📱 QR Code</label>
      </div>
    </div>
    <div class="payment-option" data-payment="upi" onclick="selectPayment(this, 'upi', event)">
      <div class="payment-option-header">
        <input type="radio" name="payment" id="upi" value="upi">
        <label for="upi">📱 UPI</label>
      </div>
      <div class="upi-apps" id="upiApps">
        <a href="phonepe://pay" class="upi-app-option" onclick="handleUpiPayment(event, 'phonepe')">
          <div class="upi-app-icon" style="background: #5f259f; color: white;">📱</div>
          <div class="upi-app-name">PhonePe</div>
        </a>
        <a href="tez://pay" class="upi-app-option" onclick="handleUpiPayment(event, 'gpay')">
          <div class="upi-app-icon" style="background: #4285f4; color: white;">💳</div>
          <div class="upi-app-name">GPay</div>
        </a>
        <a href="paytmmp://pay" class="upi-app-option" onclick="handleUpiPayment(event, 'paytm')">
          <div class="upi-app-icon" style="background: #00baf2; color: white;">💰</div>
          <div class="upi-app-name">Paytm</div>
        </a>
      </div>
    </div>
    <div class="payment-option" onclick="selectPayment(this, 'cash', event)">
      <div class="payment-option-header">
        <input type="radio" name="payment" id="cash" value="cash">
        <label for="cash">💵 Pay at Counter </label>
      </div>
    </div>
    <button class="pay-btn" id="payBtn" onclick="processPayment()">Pay Now</button>
  `;
}

function selectPayment(element, value, event) {
  // Prevent event bubbling when clicking on UPI apps
  if (event && event.target && event.target.closest('.upi-app-option')) {
    return;
  }
  
  // Remove selected state from all options
  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.classList.remove('selected');
    const input = opt.querySelector('input');
    if (input) input.checked = false;
    
    // Hide all UPI apps
    const upiApps = opt.querySelector('.upi-apps');
    if (upiApps) {
      upiApps.classList.remove('show');
    }
  });
  
  // Add selected state to clicked option
  element.classList.add('selected');
  const input = element.querySelector('input');
  if (input) input.checked = true;
  
  // Show UPI apps if UPI is selected
  if (value === 'upi') {
    const upiApps = element.querySelector('.upi-apps');
    if (upiApps) {
      upiApps.classList.add('show');
    }
  }
}

async function handleUpiPayment(event, appName) {
  event.preventDefault();
  event.stopPropagation(); // Prevent triggering the parent payment option click
  const cart = JSON.parse(localStorage.getItem('cart')) || {};
  
  if (Object.keys(cart).length === 0) {
    alert('Your cart is empty');
    return;
  }

  // Calculate total
  let subtotal = 0;
  Object.values(cart).forEach(item => {
    const price = parseFloat(item.price.replace('₹', '').replace(',', ''));
    subtotal += price * item.qty;
  });
  const total = subtotal.toFixed(2);

  // UPI merchant details (you can update these with your actual UPI ID)
  const upiId = 'merchant@paytm'; // Replace with your actual UPI ID
  const merchantName = 'Menu Mate';
  
  // Format amount for UPI (should be a string with 2 decimal places)
  const amount = total;

  // Save order to database before redirecting
  const orderNumber = await saveOrderToDatabase(cart, 'upi', parseFloat(total));
  
  // Set flag to indicate user has placed an order (even if save fails, we'll show the button)
  if (orderNumber) {
    localStorage.setItem('hasOrders', 'true');
    // Store order number for later display
    localStorage.setItem('lastOrderNumber', orderNumber);
  }

  // Create UPI deep link URLs for each app
  let appUrl = '';
  switch(appName) {
    case 'phonepe':
      // PhonePe UPI deep link
      appUrl = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Menu Mate Order')}`;
      break;
    case 'gpay':
      // Google Pay UPI deep link
      appUrl = `gpay://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Menu Mate Order')}`;
      break;
    case 'paytm':
      // Paytm UPI deep link
      appUrl = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Menu Mate Order')}`;
      break;
  }

  // Redirect to the UPI app
  if (appUrl) {
    // Store payment info for later verification
    localStorage.setItem('pendingPayment', JSON.stringify({
      method: appName,
      amount: amount,
      timestamp: new Date().toISOString()
    }));

    // Clear cart
    localStorage.removeItem('cart');
    
    // Try to open the app
    window.location.href = appUrl;
    
    // Fallback: if UPI app doesn't open, show order placed modal after a delay
    setTimeout(() => {
      showOrderPlacedModal(orderNumber);
    }, 2000);
  }
}

async function saveOrderToDatabase(cart, paymentMethod, total) {
  try {
    // Get admin_id from URL parameter or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let adminId = urlParams.get('admin_id');
    
    // Fallback to localStorage if not in URL
    if (!adminId) {
      adminId = localStorage.getItem('admin_id');
    }
    
    if (!adminId) {
      console.error('Admin ID not found in URL or localStorage');
      alert('Error: Restaurant information not found. Please access the menu through the restaurant link.');
      return null;
    }
    
    console.log('Saving order with admin_id:', adminId);

    // Initialize Supabase client
    const SUPABASE_URL = 'https://fddutzbdtcgpunkagflp.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_ouboZig1iVAlFVc1rNatIg_Z3buQJZl';
    
    if (typeof window.supabase === 'undefined') {
      console.error('Supabase library not loaded');
      return null;
    }

    // Create Supabase client - simple configuration for anonymous access
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Step 1: Generate sequential order number per restaurant (unique per restaurant)
    // IMPORTANT: Order numbers are unique per restaurant (user_id), not globally.
    // Different restaurants can have the same order number (e.g., both can have Order #1).
    // Within a single restaurant, order numbers must be unique and sequential.
    // 
    // Try to get the maximum order number for THIS SPECIFIC RESTAURANT (filtered by user_id)
    // If RLS blocks this query, we'll let the RPC function handle it
    let nextOrderNumber = 1; // Default to 1 if we can't query
    
    console.log('🔍 Querying max order number for restaurant:', adminId);
    const { data: maxOrderData, error: maxOrderError } = await supabaseClient
      .from('orders')
      .select('order_number')
      .eq('user_id', adminId)  // Filter by restaurant - ensures uniqueness per restaurant
      .not('order_number', 'is', null)
      .order('order_number', { ascending: false })
      .limit(1);
    
    if (maxOrderError) {
      console.warn('⚠ Could not query max order number (may be blocked by RLS):', maxOrderError.message);
      console.log('📝 Will let RPC function calculate order number, or default to 1');
    } else if (maxOrderData && maxOrderData.length > 0) {
      // Found existing orders - calculate next number
      const maxOrderNum = maxOrderData[0].order_number;
      console.log('📊 Found max order number:', maxOrderNum);
      
      if (typeof maxOrderNum === 'number') {
        nextOrderNumber = maxOrderNum + 1;
      } else if (typeof maxOrderNum === 'string') {
        // Handle if stored as "12" or "ORD-1012" format
        const numMatch = maxOrderNum.match(/\d+/);
        if (numMatch) {
          const numPart = parseInt(numMatch[0]);
          // If format is "ORD-1012", extract 12; if "12", use as is
          nextOrderNumber = numPart >= 1000 ? numPart - 1000 + 1 : numPart + 1;
        }
      }
      console.log('✅ Calculated next order number:', nextOrderNumber);
    } else {
      console.log('📝 No existing orders found for this restaurant, starting with order number 1');
    }
    
    console.log('🎯 Final order number to use:', nextOrderNumber, 'for restaurant:', adminId);

    // Step 2: Create the order using RPC function (bypasses RLS)
    // Try to pass order_number to RPC first (if RPC supports it)
    // If RPC doesn't support it, create order first, then update order_number
    let orderId = null;
    
    // First, try with order_number parameter (if RPC has been updated)
    console.log('🔄 Attempting to create order with order_number:', nextOrderNumber);
    const { data: rpcResult, error: orderErrorWithNum } = await supabaseClient.rpc('insert_order', {
      p_user_id: adminId,
      p_total_amount: parseFloat(total).toFixed(2),
      p_payment_method: paymentMethod,
      p_order_number: nextOrderNumber
    });

    if (!orderErrorWithNum && rpcResult) {
      // RPC function now returns JSON with both order_id and order_number
      // This avoids RLS issues when trying to fetch the order number
      if (typeof rpcResult === 'object' && rpcResult.order_id) {
        // New format: returns JSON with order_id and order_number
        orderId = rpcResult.order_id;
        nextOrderNumber = rpcResult.order_number;
        console.log('✅ Order created via RPC. Order ID:', orderId, 'Order Number:', nextOrderNumber);
      } else if (typeof rpcResult === 'string') {
        // Old format: returns just UUID string (backward compatibility)
        orderId = rpcResult;
        console.log('✅ Order created via RPC (old format). Order ID:', orderId);
        console.log('⚠ RPC returned old format - will need to fetch order_number separately');
      } else {
        // Unexpected format
        console.warn('⚠ Unexpected RPC return format:', rpcResult);
        orderId = rpcResult; // Try to use as-is
      }
    } else {
      // RPC doesn't support order_number parameter or it failed
      if (orderErrorWithNum) {
        console.log('ℹ️ RPC insert_order with p_order_number failed:', orderErrorWithNum.message);
        console.log('ℹ️ This means the RPC function may not support p_order_number yet, or there was an error');
      }
      // RPC doesn't support order_number parameter yet, create order without it
      console.log('RPC insert_order without p_order_number parameter...');
      const { data: orderIdResult, error: orderError } = await supabaseClient.rpc('insert_order', {
        p_user_id: adminId,
        p_total_amount: parseFloat(total).toFixed(2),
        p_payment_method: paymentMethod
      });
      
      if (orderError || !orderIdResult) {
      console.error('Error saving order:', orderError);
      console.error('Order error details:', JSON.stringify(orderError, null, 2));
        alert('Error saving order: ' + (orderError?.message || 'Unknown error'));
        return null;
      }
      
      // Handle both new JSON format and old UUID format
      if (typeof orderIdResult === 'object' && orderIdResult.order_id) {
        // New format: returns JSON with order_id and order_number
        orderId = orderIdResult.order_id;
        nextOrderNumber = orderIdResult.order_number;
        console.log('✅ Order created via RPC. Order ID:', orderId, 'Order Number:', nextOrderNumber);
      } else if (typeof orderIdResult === 'string') {
        // Old format: returns just UUID string
        orderId = orderIdResult;
        console.log('Order created successfully, Order ID (UUID):', orderId);
        console.log('⚠ RPC returned old format - will need to fetch/update order_number');
      } else {
        console.error('Unexpected RPC return format:', orderIdResult);
      return null;
    }
    
      // IMPORTANT: The RPC function may have already calculated and set the order_number automatically
      // Let's check if it was set before trying to update
      console.log('🔍 Checking if RPC already set order_number...');
      const { data: orderDataCheck, error: checkError } = await supabaseClient
        .from('orders')
        .select('order_number')
        .eq('id', orderId)
        .single();
      
      if (!checkError && orderDataCheck && orderDataCheck.order_number !== null) {
        // RPC already set the order number! Use that value
        nextOrderNumber = orderDataCheck.order_number;
        console.log('✅ RPC already calculated and set order number:', nextOrderNumber);
        console.log('✅ Skipping manual update - using database value');
      } else {
        // RPC didn't set order number (or RLS is blocking the read), proceed with manual update
        console.log('📝 RPC did not set order number (or cannot verify), will update manually');
        console.log('🔄 Attempting to update order with order_number:', nextOrderNumber);
        const { error: updateError, data: updateData } = await supabaseClient
        .from('orders')
        .update({ order_number: nextOrderNumber })
        .eq('id', orderId)
        .select('order_number');
        
        if (updateError) {
        console.error('❌ Error updating order number via direct update:', updateError);
        console.error('Update error details:', JSON.stringify(updateError, null, 2));
        console.warn('⚠ This is likely due to RLS policies blocking the update.');
        console.warn('💡 Trying RPC function update_order_number as fallback...');
        
        // Try using an RPC function if it exists
        const { data: rpcResult, error: rpcError } = await supabaseClient.rpc('update_order_number', {
          p_order_id: orderId,
          p_order_number: nextOrderNumber
        });
        
        if (!rpcError) {
          console.log('✅ Order number updated successfully via RPC function update_order_number');
        } else {
          console.error('❌ RPC function update_order_number also failed:', rpcError?.message);
          console.warn('⚠ Order created but order_number could not be set. Order ID:', orderId);
          console.warn('💡 SOLUTION: Run the SQL script (database_fix.sql) to fix this issue.');
          console.warn('   The script will modify insert_order RPC to accept p_order_number parameter.');
        }
        } else {
          if (updateData && updateData.length > 0) {
            const savedNumber = updateData[0].order_number;
            nextOrderNumber = savedNumber; // Use the actual saved number
            console.log('✅ Order number updated successfully:', savedNumber);
          } else {
            console.log('✅ Order number update completed (no data returned - may need verification)');
          }
        }
      }
      
      // Final step: ALWAYS fetch the actual order number from database to ensure accuracy
      // This is the source of truth for what the customer should see
      // The RPC function may have calculated a different number than we expected
      console.log('🔍 Fetching final order number from database (source of truth)...');
      const { data: finalOrderData, error: finalFetchError } = await supabaseClient
        .from('orders')
        .select('order_number')
        .eq('id', orderId)
        .limit(1); // Use limit instead of single to avoid RLS issues
      
      if (!finalFetchError && finalOrderData && finalOrderData.length > 0) {
        const dbOrderNumber = finalOrderData[0].order_number;
        if (dbOrderNumber !== null) {
          nextOrderNumber = dbOrderNumber;
          console.log('✅ Final order number from database (source of truth):', nextOrderNumber);
        } else {
          console.warn('⚠ Database order_number is null. Using calculated value:', nextOrderNumber);
        }
      } else {
        console.warn('⚠ Could not fetch final order number from database. Using calculated value:', nextOrderNumber);
        if (finalFetchError) {
          console.warn('⚠ Fetch error (may be RLS):', finalFetchError.message);
          console.warn('💡 The order was created, but we cannot verify the order_number due to RLS.');
          console.warn('💡 Check the database directly or use admin panel to see the actual order number.');
        }
      }
      
      // Final verification - fetch the order to confirm order_number was saved
      // Use limit(1) instead of single() to avoid RLS issues
      try {
        const { data: verifyData, error: verifyError } = await supabaseClient
          .from('orders')
          .select('order_number')
          .eq('id', orderId)
          .limit(1);
        
        if (!verifyError && verifyData && verifyData.length > 0) {
          const savedOrderNumber = verifyData[0].order_number;
          if (savedOrderNumber === nextOrderNumber) {
            console.log('✓ Order number confirmed in database:', savedOrderNumber);
          } else if (savedOrderNumber === null) {
            console.warn('⚠ Order number is null in database. Retrying update...');
            // If order_number is null, try one more update attempt
            const { error: retryError } = await supabaseClient
              .from('orders')
              .update({ order_number: nextOrderNumber })
              .eq('id', orderId);
            
            if (retryError) {
              console.error('Retry update failed:', retryError);
              console.error('Retry error details:', JSON.stringify(retryError, null, 2));
              console.warn('⚠ Order number may not be saved. Check RLS policies or use an RPC function.');
            } else {
              console.log('✓ Order number updated on retry');
            }
          } else {
            console.warn('⚠ Order number mismatch! Expected:', nextOrderNumber, 'Got:', savedOrderNumber);
          }
        } else if (verifyError) {
          // RLS might be blocking the read - this is okay, we'll assume update worked if no error
          console.warn('Could not verify order number (may be blocked by RLS):', verifyError.message);
          if (!updateError) {
            console.log('Assuming order number was saved since update succeeded');
          }
        } else {
          console.warn('No data returned from verification query');
        }
      } catch (err) {
        console.warn('Error during verification (non-critical):', err);
        if (!updateError) {
          console.log('Assuming order number was saved since update succeeded');
        }
      }
    }

    // Step 2: Prepare and insert order items using RPC function
    const orderItems = Object.values(cart).map(item => {
      // Remove ₹, $, commas, and any other non-numeric characters except decimal point
      const priceStr = String(item.price || '0').replace(/[₹$,]/g, '').trim();
      const price = parseFloat(priceStr) || 0;
      
      return {
        order_id: orderId,
        dish_id: item.dish_id || null,
        dish_name: item.name || 'Unknown Item',
        price: parseFloat(price).toFixed(2),
        quantity: parseInt(item.qty) || 1
      };
    });

    // Insert all order items using RPC function
    const insertPromises = orderItems.map(item => 
      supabaseClient.rpc('insert_order_item', {
        p_order_id: orderId,
        p_dish_id: item.dish_id,
        p_dish_name: item.dish_name,
        p_price: item.price,
        p_quantity: item.quantity
      })
    );

    const itemsResults = await Promise.all(insertPromises);
    const itemsError = itemsResults.find(result => result.error)?.error;

    if (itemsError) {
      console.error('Error saving order items:', itemsError);
      console.error('Items error details:', JSON.stringify(itemsError, null, 2));
      alert('Error saving order items: ' + (itemsError.message || 'Unknown error'));
      // Order was created but items failed - you might want to delete the order here
      return null;
    }

    console.log('Order and items saved successfully!');
    console.log('Order ID (UUID):', orderId);
    console.log('Order Number:', nextOrderNumber);
    console.log('Order Items Count:', orderItems.length);
    
    // Format order number for display with zero-padding (e.g., "01", "02", "12")
    // Store as integer in DB, format for display
    const displayOrderNumber = String(nextOrderNumber).padStart(2, '0');
    
    // Set flag to indicate user has placed an order
    localStorage.setItem('hasOrders', 'true');
    
    // Store complete order data in localStorage for customer orders page
    const orderData = {
      id: orderId,
      order_number: nextOrderNumber,
      total_amount: parseFloat(total).toFixed(2),
      payment_method: paymentMethod,
      created_at: new Date().toISOString(),
      order_items: orderItems.map((item, index) => ({
        id: orderId + '_item_' + index, // Generate a unique ID for the item
        dish_id: item.dish_id,
        dish_name: item.dish_name,
        price: item.price,
        quantity: parseInt(item.quantity) || 1
      }))
    };
    
    // Get existing orders from localStorage
    let customerOrders = JSON.parse(localStorage.getItem('customerOrders') || '[]');
    
    // Add new order to the beginning (newest first)
    customerOrders.unshift(orderData);
    
    // Store back to localStorage
    localStorage.setItem('customerOrders', JSON.stringify(customerOrders));
    
    // Return the formatted order number for display to users (e.g., "01", "02")
    return displayOrderNumber;
  } catch (error) {
    console.error('Error in saveOrderToDatabase:', error);
    return null;
  }
}

function showOrderPlacedModal(orderNumber) {
  const modal = document.getElementById('orderPlacedModal');
  const orderNumberElement = document.getElementById('orderNumberValue');
  
  if (orderNumber) {
    // Display as zero-padded format (e.g., "#01", "#02", "#12")
    // orderNumber is already formatted with zero-padding from saveOrderToDatabase
    orderNumberElement.textContent = `#${orderNumber}`;
  } else {
    orderNumberElement.textContent = 'N/A';
  }
  
  modal.classList.add('show');
}

function goToMenu() {
  // Get admin_id from URL or localStorage to preserve it
  const urlParams = new URLSearchParams(window.location.search);
  let adminId = urlParams.get('admin_id');
  
  if (!adminId) {
    adminId = localStorage.getItem('admin_id');
  }
  
  // Redirect to menu with admin_id if available
  if (adminId) {
    window.location.href = `menu.html?admin_id=${adminId}`;
  } else {
    window.location.href = 'menu.html';
  }
}

async function processPayment() {
  const selectedPayment = document.querySelector('input[name="payment"]:checked');
  if (!selectedPayment) {
    alert('Please select a payment method');
    return;
  }

  const paymentMethod = selectedPayment.value;
  const cart = JSON.parse(localStorage.getItem('cart')) || {};
  
  if (Object.keys(cart).length === 0) {
    alert('Your cart is empty');
    return;
  }

  // If UPI is selected, show message to select an app
  if (paymentMethod === 'upi') {
    alert('Please select a UPI app (PhonePe, Google Pay, or Paytm)');
    return;
  }

  // Calculate total
  let subtotal = 0;
  Object.values(cart).forEach(item => {
    const price = parseFloat(item.price.replace('₹', '').replace(',', ''));
    subtotal += price * item.qty;
  });
  const total = subtotal;

  // Simulate payment processing
  const payBtn = document.getElementById('payBtn');
  payBtn.disabled = true;
  payBtn.textContent = 'Processing...';

  // Save order to database
  const orderNumber = await saveOrderToDatabase(cart, paymentMethod, total);
  
  if (!orderNumber) {
    // Even if saving fails, proceed with order (graceful degradation)
    console.warn('Order could not be saved to database, but proceeding with order');
  } else {
    // Set flag to indicate user has placed an order
    localStorage.setItem('hasOrders', 'true');
  }

  // Clear cart after successful payment
  localStorage.removeItem('cart');
  
  // Show order placed modal with order number
  showOrderPlacedModal(orderNumber);
  
  // Re-enable button (though modal is shown)
  payBtn.disabled = false;
  payBtn.textContent = 'Pay Now';
}

// Initialize
renderOrderSummary();
renderPaymentMethods();
