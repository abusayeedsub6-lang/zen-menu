'use strict';

// Manage Menu Module
// This module handles all menu management functionality (categories, dishes, offers)
// It depends on supabaseClient and currentUserId from the parent scope (admin.html)

(function() {
  // State variables
  let menu = [];
  let categories = [];
  let editingDishId = null;
  let editingCategoryId = null;

  // Access supabaseClient and currentUserId from parent scope
  // These are defined in admin.html
  function getSupabaseClient() {
    return window.supabaseClient;
  }

  async function getCurrentUserId() {
    if (window.currentUserId) return window.currentUserId;
    
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return null;
    }
    
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error || !session) {
        console.error('Error getting session:', error);
        return null;
      }
      window.currentUserId = session.user.id;
      return window.currentUserId;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  }

  // ==================== SUPABASE DATA OPERATIONS ====================

  // Load categories from Supabase (filtered by user_id)
  async function loadCategories() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return [];
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available');
      return [];
    }
    
    try {
      // Order by display_order first, then by created_at as fallback, then by name
      const { data, error } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      categories = data || [];
      updateCategoryDropdown();
      if (document.getElementById('categoryTableBody')) {
        renderCategories();
      }
      return categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('Failed to load categories: ' + error.message);
      return [];
    }
  }

  // Load dishes from Supabase with category names (filtered by user_id)
  async function loadDishes() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return [];
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available');
      return [];
    }
    
    try {
      const { data, error } = await supabaseClient
        .from('dishes')
        .select(`
          *,
          categories:category_id (
            id,
            name,
            display_order
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to include category name and map dish_name to name for compatibility
      menu = (data || []).map(dish => ({
        ...dish,
        name: dish.dish_name, // Map dish_name to name for UI compatibility
        category: dish.categories?.name || '',
        category_id: dish.category_id,
        category_display_order: dish.categories?.display_order ?? 999999 // Use high value for null display_order
      }));
      
      // Sort dishes consistently in descending order: newest first
      // First by creation time (descending), then by category display_order as secondary sort
      menu.sort((a, b) => {
        // Primary sort: creation time descending (newest first)
        const createdA = new Date(a.created_at || 0).getTime();
        const createdB = new Date(b.created_at || 0).getTime();
        if (createdA !== createdB) {
          return createdB - createdA; // Descending order
        }
        // Secondary sort: category display_order (if same creation time)
        const orderA = a.category_display_order ?? 999999;
        const orderB = b.category_display_order ?? 999999;
        return orderA - orderB;
      });
      
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        renderMenu(searchInput.value.trim());
      }
      return menu;
    } catch (error) {
      console.error('Error loading dishes:', error);
      alert('Failed to load dishes: ' + error.message);
      return [];
    }
  }

  // Category management functions
  async function getCategories() {
    if (categories.length === 0) {
      await loadCategories();
    }
    return categories.map(c => c.name);
  }

  async function addCategory(name) {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      alert('Supabase client not initialized');
      return;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      alert('User ID not available. Please log in again.');
      window.location.href = '../index.html';
      return;
    }
    
    try {
      // Verify session is active
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        alert('Session expired. Please log in again.');
        window.location.href = '../index.html';
        return;
      }
      
      // Get the maximum display_order for this user to assign the next order
      const { data: existingCategories, error: maxError } = await supabaseClient
        .from('categories')
        .select('display_order')
        .eq('user_id', userId)
        .order('display_order', { ascending: false, nullsLast: true })
        .limit(1);
      
      let nextDisplayOrder = 1;
      if (!maxError && existingCategories && existingCategories.length > 0) {
        const maxOrder = existingCategories[0].display_order;
        if (maxOrder !== null && maxOrder !== undefined) {
          nextDisplayOrder = maxOrder + 1;
        }
      }
      
      // Note: id (UUID) and created_at are auto-generated by Supabase
      const { data, error } = await supabaseClient
        .from('categories')
        .insert([{ 
          name: name.trim(), 
          user_id: userId,
          display_order: nextDisplayOrder
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      await loadCategories();
      return data;
    } catch (error) {
      console.error('Error adding category:', error);
      if (error.code === '42501') {
        alert('Permission denied: Row-level security policy violation. Please check your Supabase RLS policies for the categories table.');
      } else {
        alert('Failed to add category: ' + error.message);
      }
      throw error;
    }
  }

  async function updateCategoryInDB(id, oldName, newName) {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      alert('Supabase client not initialized');
      return;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      alert('User ID not available. Please log in again.');
      window.location.href = '../index.html';
      return;
    }
    
    try {
      // Verify session is active
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        alert('Session expired. Please log in again.');
        window.location.href = '../index.html';
        return;
      }
      
      // Ensure the category belongs to the current user
      const { data, error } = await supabaseClient
        .from('categories')
        .update({ name: newName.trim() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      // No need to update dishes - they use category_id foreign key which stays the same
      await loadCategories();
      await loadDishes();
      return data;
    } catch (error) {
      console.error('Error updating category:', error);
      if (error.code === '42501') {
        alert('Permission denied: Row-level security policy violation. Please check your Supabase RLS policies for the categories table.');
      } else {
        alert('Failed to update category: ' + error.message);
      }
      throw error;
    }
  }

  async function deleteCategoryFromDB(id, name) {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      alert('Supabase client not initialized');
      return;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      alert('User ID not available. Please log in again.');
      window.location.href = '../index.html';
      return;
    }
    
    try {
      // Verify session is active
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        alert('Session expired. Please log in again.');
        window.location.href = '../index.html';
        return;
      }
      
      // Check if any dishes use this category (id is UUID) - only for current user
      const { data: dishesUsingCategory, error: checkError } = await supabaseClient
        .from('dishes')
        .select('id')
        .eq('category_id', id)
        .eq('user_id', userId); // UUID comparison
      
      if (checkError) throw checkError;
      
      if (dishesUsingCategory && dishesUsingCategory.length > 0) {
        if (!confirm(`This category is used by ${dishesUsingCategory.length} dish(es). Remove anyway?`)) {
          return;
        }
        // Delete dishes that use this category (only user's dishes)
        await supabaseClient
          .from('dishes')
          .delete()
          .eq('category_id', id)
          .eq('user_id', userId); // UUID comparison
      }
      
      // Delete category (id is UUID) - only if it belongs to current user
      const { error } = await supabaseClient
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // UUID comparison
      
      if (error) throw error;
      
      await loadCategories();
      await loadDishes();
    } catch (error) {
      console.error('Error deleting category:', error);
      if (error.code === '42501') {
        alert('Permission denied: Row-level security policy violation. Please check your Supabase RLS policies for the categories table.');
      } else {
        alert('Failed to delete category: ' + error.message);
      }
      throw error;
    }
  }

  function updateCategoryDropdown() {
    const categoryInput = document.getElementById('category');
    if (!categoryInput) return;
    categoryInput.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.text = cat.name;
      opt.value = cat.id; // Store category ID, not name
      categoryInput.appendChild(opt);
    });
  }

  // Initialize data on load
  async function initializeData() {
    await Promise.all([loadCategories(), loadDishes()]);
  }

  // ==================== UI INITIALIZATION ====================

  function initializeUI() {
    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const imageInput = document.getElementById('image');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');
    const searchInput = document.getElementById('searchInput');
    const notFoundText = document.getElementById('notFound');
    const saveBtn = document.getElementById('saveBtn');

    if (!saveBtn || !searchInput) return; // Elements not loaded yet

    saveBtn.addEventListener('click', saveDish);
    searchInput.addEventListener('input', () => renderMenu(searchInput.value.trim()));

    // Remove error state when user starts typing/selecting
    [nameInput, priceInput, imageInput, categoryInput].forEach(field => {
      if (field) {
        if (field.tagName === 'SELECT') {
          field.addEventListener('change', function() {
            this.classList.remove('error');
          });
        } else {
          field.addEventListener('input', function() {
            this.classList.remove('error');
          });
        }
      }
    });

    // Navigation buttons for cards
    const navCategoryBtn = document.getElementById('navCategoryBtn');
    const navDishBtn = document.getElementById('navDishBtn');
    const navOffersBtn = document.getElementById('navOffersBtn');

    const categoryCard = document.getElementById('categoryCard');
    const dishCard = document.getElementById('dishCard');
    const offersCard = document.getElementById('offersCard');
    const menuItemsCard = document.getElementById('menuItemsCard');

    function setActiveNavButton(buttonId) {
      // Remove active class from all nav buttons
      [navCategoryBtn, navDishBtn, navOffersBtn].forEach(btn => {
        if (btn) btn.classList.remove('active');
      });
      // Add active class to the selected button
      const activeBtn = document.getElementById(buttonId);
      if (activeBtn) activeBtn.classList.add('active');
    }

    function showCard(id) {
      if (categoryCard) categoryCard.style.display = 'none';
      if (dishCard) dishCard.style.display = 'none';
      if (offersCard) offersCard.style.display = 'none';
      if (menuItemsCard) menuItemsCard.style.display = 'none';
      const card = document.getElementById(id);
      if (card) card.style.display = 'block';
      // Show Menu Items table only when Dish Ops is selected
      if (id === 'dishCard' && menuItemsCard) {
        menuItemsCard.style.display = 'block';
      }
      
      // Update active nav button based on card shown
      if (id === 'categoryCard') {
        setActiveNavButton('navCategoryBtn');
      } else if (id === 'dishCard') {
        setActiveNavButton('navDishBtn');
      } else if (id === 'offersCard') {
        setActiveNavButton('navOffersBtn');
      }
      
      // Update table container height when cards are shown/hidden
      setTimeout(() => {
        updateTableContainerHeight();
      }, 0);
    }

    if (navCategoryBtn) {
      navCategoryBtn.addEventListener('click', () => {
        showCard('categoryCard');
        renderCategories();
      });
    }
    if (navDishBtn) {
      navDishBtn.addEventListener('click', () => {
        showCard('dishCard');
        updateCategoryDropdown();
      });
    }
    if (navOffersBtn) {
      navOffersBtn.addEventListener('click', () => showCard('offersCard'));
    }
    
    // Set initial active state (Category Ops is shown by default)
    setActiveNavButton('navCategoryBtn');
    showCard('categoryCard');
    renderCategories();

    // Category ops
    const newCategoryInput = document.getElementById('newCategoryInput');
    const addCategoryActionBtn = document.getElementById('addCategoryActionBtn');

    if (addCategoryActionBtn) {
      addCategoryActionBtn.addEventListener('click', async () => {
        const name = (newCategoryInput?.value || '').trim();
        if (!name) return alert('Enter a category name');
        
        const catList = await getCategories();
        const exists = catList.some(c => c.toLowerCase() === name.toLowerCase());
        if (exists) return alert('Category exists');
        
        try {
          await addCategory(name);
          if (newCategoryInput) newCategoryInput.value = '';
        } catch (error) {
          // Error already handled in addCategory
        }
      });
    }

    // Offers
    const offerInput = document.getElementById('offerInput');
    const offerSaveBtn = document.getElementById('offerSaveBtn');
    const offerText = document.getElementById('offerText');

    function saveOffer() {
      const v = parseFloat(offerInput?.value || 0) || 0;
      localStorage.setItem('offer', String(v));
      if (offerText) {
        offerText.innerText = v > 0 ? v + '% OFF applied to all items' : 'No active offer';
      }
      if (offerInput) offerInput.value = '';
    }

    if (offerSaveBtn) {
      offerSaveBtn.addEventListener('click', saveOffer);
    }

    // Close sidebar when clicking nav buttons on mobile
    [navCategoryBtn, navDishBtn, navOffersBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            const manageMenuSection = document.getElementById('manageMenuSection');
            const sidebar = manageMenuSection ? manageMenuSection.querySelector('.layout .sidebar') : document.querySelector('.layout .sidebar');
            const overlay = document.getElementById('overlay');
            if (sidebar) sidebar.classList.add('mobile-hidden');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
          }
        });
      }
    });
  }

  // ==================== RENDER FUNCTIONS ====================

  async function renderCategories() {
    const tbody = document.getElementById('categoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    await getCategories(); // Ensure categories are loaded

    categories.forEach((cat, index) => {
      const tr = document.createElement('tr');
      tr.className = 'draggable-row';
      tr.draggable = true;
      tr.dataset.categoryId = cat.id;
      tr.dataset.index = index;
      
      const escapedCat = cat.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedId = String(cat.id).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      
      tr.innerHTML = `
        <td class="drag-handle">⋮⋮</td>
        <td>${index + 1}</td>
        <td>${cat.name}</td>
        <td class="actions">
          <div class="dots" onclick="window.manageMenuModule.toggleCategoryMenu(this)">⋮</div>
          <div class="menu-actions">
            <div onclick="window.manageMenuModule.updateCategory('${escapedId}', '${escapedCat}')">Update</div>
            <div class="danger" onclick="window.manageMenuModule.removeCategory('${escapedId}', '${escapedCat}')">Remove</div>
          </div>
        </td>`;
      
      // Add drag event listeners
      tr.addEventListener('dragstart', handleDragStart);
      tr.addEventListener('dragover', handleDragOver);
      tr.addEventListener('drop', handleDrop);
      tr.addEventListener('dragend', handleDragEnd);
      
      // Prevent drag when clicking on action buttons
      const actionsCell = tr.querySelector('.actions');
      if (actionsCell) {
        actionsCell.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });
      }
      
      tbody.appendChild(tr);
    });
  }

  // Drag and drop handlers
  let draggedElement = null;
  let draggedIndex = null;

  function handleDragStart(e) {
    // Prevent drag when clicking directly on action buttons or menu
    const target = e.target;
    if (target.closest('.menu-actions') || target.classList.contains('dots')) {
      e.preventDefault();
      return false;
    }
    
    draggedElement = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const targetRow = this;
    if (targetRow && targetRow !== draggedElement && targetRow.classList.contains('draggable-row')) {
      const targetIndex = parseInt(targetRow.dataset.index);
      const allRows = Array.from(targetRow.parentNode.querySelectorAll('tr.draggable-row'));
      
      // Remove previous drop indicators
      allRows.forEach(row => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      
      // Add visual indicator
      if (targetIndex < draggedIndex) {
        targetRow.classList.add('drag-over-top');
      } else if (targetIndex > draggedIndex) {
        targetRow.classList.add('drag-over-bottom');
      }
    }
    
    return false;
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const targetRow = this;
    if (!targetRow || targetRow === draggedElement || !targetRow.classList.contains('draggable-row')) {
      return false;
    }
    
    const targetIndex = parseInt(targetRow.dataset.index);
    const sourceIndex = draggedIndex;
    
    if (targetIndex === sourceIndex) {
      // No change needed
      return false;
    }
    
    // Remove visual indicators
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    
    // Reorder categories array
    const [movedCategory] = categories.splice(sourceIndex, 1);
    categories.splice(targetIndex, 0, movedCategory);
    
    // Update display_order values in database
    updateCategoryOrders();
    
    return false;
  }

  function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedElement = null;
    draggedIndex = null;
  }

  // Update display_order values in database after reordering
  async function updateCategoryOrders() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available');
      return;
    }
    
    try {
      // Update each category with its new display_order
      for (let i = 0; i < categories.length; i++) {
        const { error } = await supabaseClient
          .from('categories')
          .update({ display_order: i + 1 })
          .eq('id', categories[i].id)
          .eq('user_id', userId);
        
        if (error) {
          console.error(`Error updating category ${categories[i].id}:`, error);
          // Reload categories on error to restore correct order
          await loadCategories();
          return;
        }
      }
      
      // Reload to ensure UI is in sync
      await loadCategories();
    } catch (error) {
      console.error('Error updating category orders:', error);
      alert('Failed to save category order: ' + error.message);
      // Reload categories on error to restore correct order
      await loadCategories();
    }
  }

  function renderMenu(search = '') {
    const tbody = document.querySelector('#menuTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = search
      ? menu.filter(d => d && d.name && d.name.toLowerCase().includes(search.toLowerCase()))
      : menu.filter(d => d && d.name);

    const notFoundText = document.getElementById('notFound');
    if (notFoundText) {
      notFoundText.style.display = filtered.length === 0 && search ? 'block' : 'none';
    }

    filtered.forEach((d, index) => {
      const tr = document.createElement('tr');
      const escapedName = d.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const escapedId = String(d.id).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      // Number dishes in descending order: newest dish gets highest number
      const dishNumber = filtered.length - index;
      tr.innerHTML = `
        <td>${dishNumber}</td>
        <td>${d.name}</td>
        <td>₹${d.price}</td>
        <td>${d.category || 'N/A'}</td>
        <td title="${(d.description || '').replace(/"/g, '&quot;')}">${d.description || ''}</td>
        <td><img src="${d.image_url || ''}" alt="${d.name}" style="width:60px;height:40px;object-fit:cover;border-radius:6px" loading="lazy"></td>
        <td class="actions">
          <div class="dots" onclick="window.manageMenuModule.toggleMenu(this)">⋮</div>
          <div class="menu-actions">
            <div onclick="window.manageMenuModule.editDish('${escapedId}')">Update</div>
            <div class="danger" onclick="window.manageMenuModule.deleteDish('${escapedId}')">Remove</div>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
    
    // Update table container height after rows are rendered
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      updateTableContainerHeight();
    });
  }

  // ==================== CATEGORY OPERATIONS ====================

  function toggleCategoryMenu(el) {
    document.querySelectorAll('#categoryTable .menu-actions').forEach(m => m.style.display = 'none');
    if (el.nextElementSibling) {
      el.nextElementSibling.style.display = 'block';
    }
  }

  async function removeCategory(id, name) {
    try {
      await deleteCategoryFromDB(id, name);
    } catch (error) {
      // Error already handled in deleteCategoryFromDB
    }
  }

  async function updateCategory(id, name) {
    const newName = prompt('Enter new category name:', name);
    if (!newName || newName.trim() === '') return;
    
    const trimmedName = newName.trim();
    const catList = await getCategories();
    const exists = catList.some(c => c.toLowerCase() === trimmedName.toLowerCase() && c !== name);
    if (exists) return alert('Category already exists');
    
    try {
      await updateCategoryInDB(id, name, trimmedName);
    } catch (error) {
      // Error already handled in updateCategoryInDB
    }
  }


  // ==================== DISH OPERATIONS ====================

  async function saveDish() {
    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const imageInput = document.getElementById('image');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');

    // Remove previous error states
    [nameInput, priceInput, imageInput, categoryInput].forEach(field => {
      if (field) field.classList.remove('error');
    });

    // Validate required fields
    let hasError = false;
    
    if (!nameInput?.value || !nameInput.value.trim()) {
      if (nameInput) nameInput.classList.add('error');
      hasError = true;
    }
    
    if (!priceInput?.value || !priceInput.value.trim()) {
      if (priceInput) priceInput.classList.add('error');
      hasError = true;
    }
    
    if (!imageInput?.value || !imageInput.value.trim()) {
      if (imageInput) imageInput.classList.add('error');
      hasError = true;
    }
    
    const catList = await getCategories();
    if (catList.length === 0) {
      alert('Please add at least one category before adding dishes');
      return;
    }
    
    if (!categoryInput?.value) {
      if (categoryInput) categoryInput.classList.add('error');
      hasError = true;
    }

    // If there are errors, stop here
    if (hasError) {
      return;
    }

    const dishName = nameInput.value.trim();
    const dishPrice = parseInt(priceInput.value.trim());
    const categoryId = categoryInput.value; // UUID, no need to parse
    
    if (isNaN(dishPrice) || dishPrice <= 0) {
      if (priceInput) priceInput.classList.add('error');
      alert('Please enter a valid price');
      return;
    }

    if (!categoryId) {
      if (categoryInput) categoryInput.classList.add('error');
      alert('Please select a valid category');
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      alert('User ID not available. Please log in again.');
      window.location.href = '../index.html';
      return;
    }

    // Note: id (UUID) and created_at are auto-generated by Supabase
    const dishData = {
      dish_name: dishName, // Use dish_name as per table schema
      price: dishPrice,
      image_url: imageInput.value.trim(),
      description: descriptionInput?.value.trim() || null,
      category_id: categoryId,
      user_id: userId
    };

    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      alert('Supabase client not initialized');
      return;
    }
    
    try {
      // Verify session is active
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        alert('Session expired. Please log in again.');
        window.location.href = '../index.html';
        return;
      }
      
      if (editingDishId) {
        // Update existing dish - ensure it belongs to current user
        const { error } = await supabaseClient
          .from('dishes')
          .update(dishData)
          .eq('id', editingDishId)
          .eq('user_id', userId);
        
        if (error) throw error;
        editingDishId = null;
      } else {
        // Check if dish already exists for this user
        const { data: existing, error: checkError } = await supabaseClient
          .from('dishes')
          .select('id')
          .eq('dish_name', dishName)
          .eq('user_id', userId);
        
        if (checkError) {
          console.error('Error checking for existing dish:', checkError);
          // Continue with insert attempt even if check fails
        } else if (existing && existing.length > 0) {
          alert('This dish already exists');
          return;
        }
        
        // Insert new dish
        const { error } = await supabaseClient
          .from('dishes')
          .insert([dishData]);
        
        if (error) throw error;
      }
      
      await loadDishes();
      clearForm();
    } catch (error) {
      console.error('Error saving dish:', error);
      if (error.code === '42501') {
        alert('Permission denied: Row-level security policy violation. Please check your Supabase RLS policies for the dishes table.');
      } else {
        alert('Failed to save dish: ' + error.message);
      }
    }
  }

  function clearForm() {
    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const imageInput = document.getElementById('image');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');

    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (imageInput) imageInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (categoryInput && categories.length > 0) {
      categoryInput.value = categories[0].id;
    }
    // Remove error states
    [nameInput, priceInput, imageInput, categoryInput].forEach(field => {
      if (field) field.classList.remove('error');
    });
    editingDishId = null;
  }

  async function deleteDish(id) {
    if (!confirm('Are you sure you want to delete this dish?')) return;
    
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      alert('Supabase client not initialized');
      return;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      alert('User ID not available. Please log in again.');
      window.location.href = '../index.html';
      return;
    }
    
    try {
      // Verify session is active
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session) {
        alert('Session expired. Please log in again.');
        window.location.href = '../index.html';
        return;
      }
      
      // Delete dish - only if it belongs to current user
      const { error } = await supabaseClient
        .from('dishes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      await loadDishes();
    } catch (error) {
      console.error('Error deleting dish:', error);
      if (error.code === '42501') {
        alert('Permission denied: Row-level security policy violation. Please check your Supabase RLS policies for the dishes table.');
      } else {
        alert('Failed to delete dish: ' + error.message);
      }
    }
  }

  function editDish(id) {
    const dish = menu.find(d => d.id === id);
    if (!dish) return;

    const nameInput = document.getElementById('name');
    const priceInput = document.getElementById('price');
    const imageInput = document.getElementById('image');
    const descriptionInput = document.getElementById('description');
    const categoryInput = document.getElementById('category');

    if (nameInput) nameInput.value = dish.name;
    if (priceInput) priceInput.value = dish.price;
    if (imageInput) imageInput.value = dish.image_url || '';
    if (descriptionInput) descriptionInput.value = dish.description || '';
    
    // Set category_id in dropdown
    if (categoryInput) {
      if (dish.category_id && categories.some(c => c.id === dish.category_id)) {
        categoryInput.value = dish.category_id;
      } else if (categories.length > 0) {
        categoryInput.value = categories[0].id;
      }
    }
    
    editingDishId = id;
  }

  function toggleMenu(el) {
    document.querySelectorAll('.menu-actions').forEach(m => m.style.display = 'none');
    if (el.nextElementSibling) {
      el.nextElementSibling.style.display = 'block';
    }
  }

  // Close menu actions when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.classList.contains('dots')) {
      document.querySelectorAll('.menu-actions').forEach(m => m.style.display = 'none');
      document.querySelectorAll('#categoryTable .menu-actions').forEach(m => m.style.display = 'none');
    }
  });

  // ==================== SIDEBAR POSITIONING ====================

  function setSidebarPosition() {
    const header = document.querySelector('header');
    const manageMenuSection = document.getElementById('manageMenuSection');
    const sidebar = manageMenuSection ? manageMenuSection.querySelector('.layout .sidebar') : document.querySelector('.layout .sidebar');
    if (header) {
      const headerHeight = header.offsetHeight;
      if (sidebar) {
        sidebar.style.top = headerHeight + 'px';
        sidebar.style.height = `calc(100vh - ${headerHeight}px)`;
      }
    }
  }

  // Update container width based on sidebar state
  function updateContainerWidth() {
    const manageMenuSection = document.getElementById('manageMenuSection');
    const sidebar = manageMenuSection ? manageMenuSection.querySelector('.layout .sidebar') : document.querySelector('.layout .sidebar');
    const container = manageMenuSection ? manageMenuSection.querySelector('.layout .container') : document.querySelector('.layout .container');
    if (container && sidebar) {
      if (sidebar.classList.contains('collapsed')) {
        container.classList.add('full-width');
      } else {
        container.classList.remove('full-width');
      }
    }
  }

  // Initialize sidebar collapse behavior
  let manageMenuSidebarInitialized = false;
  function initializeSidebarBehavior() {
    const manageMenuSection = document.getElementById('manageMenuSection');
    const sidebar = manageMenuSection ? manageMenuSection.querySelector('.layout .sidebar') : null;
    const container = manageMenuSection ? manageMenuSection.querySelector('.layout .container') : null;
    
    if (!sidebar) return;
    
    // Reset initialization if sidebar was removed and re-added
    if (manageMenuSidebarInitialized && !sidebar.hasAttribute('data-behavior-initialized')) {
      manageMenuSidebarInitialized = false;
    }
    
    if (manageMenuSidebarInitialized) return;
    manageMenuSidebarInitialized = true;
    sidebar.setAttribute('data-behavior-initialized', 'true');

    // Ensure sidebar is collapsed on initial load (desktop only)
    if (window.innerWidth > 768) {
      sidebar.classList.add('collapsed');
      sidebar.classList.remove('mobile-hidden');
      if (container) {
        container.classList.add('full-width');
      }
    } else {
      // Mobile: start hidden
      sidebar.classList.add('mobile-hidden');
    }

    // Desktop hover behavior
    let hoverTimeout;
    let isHovering = false;
    
    const handleMouseEnter = function() {
      if (window.innerWidth > 768) {
        isHovering = true;
        if (sidebar.classList.contains('collapsed')) {
          clearTimeout(hoverTimeout);
          sidebar.classList.remove('collapsed');
          updateContainerWidth();
        }
      }
    };
    
    const handleMouseLeave = function() {
      if (window.innerWidth > 768) {
        isHovering = false;
        if (!sidebar.classList.contains('collapsed')) {
          hoverTimeout = setTimeout(function() {
            if (!isHovering) {
              sidebar.classList.add('collapsed');
              updateContainerWidth();
            }
          }, 200);
        }
      }
    };
    
    sidebar.addEventListener('mouseenter', handleMouseEnter);
    sidebar.addEventListener('mouseleave', handleMouseLeave);

    // Auto-collapse sidebar when clicking outside (desktop only)
    const handleClickOutside = function(e) {
      if (window.innerWidth > 768 && sidebar && manageMenuSection && manageMenuSection.style.display !== 'none') {
        // Don't collapse if clicking on menu toggle, overlay, or sidebar itself
        const menuToggle = document.getElementById('menuToggle');
        const overlay = document.getElementById('overlay');
        if (menuToggle && menuToggle.contains(e.target)) return;
        if (overlay && overlay.contains(e.target)) return;
        if (sidebar.contains(e.target)) return;
        
        if (!sidebar.classList.contains('collapsed')) {
          sidebar.classList.add('collapsed');
          updateContainerWidth();
        }
      }
    };
    document.addEventListener('click', handleClickOutside);

    // Auto-collapse on desktop after sidebar tab selection
    const sidebarTabs = manageMenuSection ? manageMenuSection.querySelectorAll('.layout .sidebar-tab') : [];
    sidebarTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        if (window.innerWidth > 768 && sidebar) {
          setTimeout(function() {
            if (!sidebar.matches(':hover')) {
              sidebar.classList.add('collapsed');
              updateContainerWidth();
            }
          }, 300);
        }
      });
    });
  }

  // ==================== REAL-TIME SUBSCRIPTIONS ====================
  
  async function setupRealtimeSubscriptions() {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User ID not available for real-time subscriptions');
      return;
    }
    
    // Subscribe to categories changes for current user only
    supabaseClient
      .channel('categories-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'categories',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log('Category change detected:', payload);
          await loadCategories();
        }
      )
      .subscribe();

    // Subscribe to dishes changes for current user only
    supabaseClient
      .channel('dishes-changes')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'dishes',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log('Dish change detected:', payload);
          await loadDishes();
        }
      )
      .subscribe();
  }

  // ==================== PUBLIC API ====================

  // Update table container height for proper scrolling - show exactly 6 rows
  function updateTableContainerHeight() {
    const tableContainer = document.getElementById('tableContainer');
    const menuItemsCard = document.getElementById('menuItemsCard');
    const menuTable = document.getElementById('menuTable');
    
    if (tableContainer && menuItemsCard && menuTable) {
      // Get the table header height
      const thead = menuTable.querySelector('thead');
      const firstRow = menuTable.querySelector('tbody tr:first-child');
      
      if (thead && firstRow) {
        const headerHeight = thead.offsetHeight;
        const rowHeight = firstRow.offsetHeight;
        
        // Calculate height for exactly 6 rows: header + (6 rows * row height)
        // Add 1px for border on the last row
        const maxTableHeight = headerHeight + (6 * rowHeight) + 1;
        tableContainer.style.maxHeight = maxTableHeight + 'px';
      } else {
        // Fallback: calculate based on card dimensions
        const cardHeight = menuItemsCard.offsetHeight;
        const headerHeight = menuItemsCard.querySelector('.menu-items-header')?.offsetHeight || 0;
        const notFoundText = document.getElementById('notFound');
        const notFoundHeight = notFoundText && notFoundText.style.display !== 'none' ? notFoundText.offsetHeight : 0;
        const availableHeight = cardHeight - headerHeight - notFoundHeight - 20; // 20px for margins/padding
        
        // Estimate: approximately 50px per row (padding + content + border)
        // Show exactly 6 rows: header (~40px) + (6 rows * ~50px) = ~340px
        const estimatedHeight = 40 + (6 * 50) + 1; // header + 6 rows + border
        const calculatedHeight = Math.min(availableHeight, estimatedHeight);
        
        if (calculatedHeight > 0) {
          tableContainer.style.maxHeight = calculatedHeight + 'px';
        }
      }
    }
  }

  // Expose functions to window for onclick handlers and external access
  window.manageMenuModule = {
    initialize: async function() {
      initializeUI();
      await initializeData();
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setSidebarPosition();
        window.addEventListener('resize', () => {
          setSidebarPosition();
          updateTableContainerHeight();
        });
        
        // Initialize sidebar behavior
        initializeSidebarBehavior();
        
        // Initialize sidebar state on load
        const manageMenuSection = document.getElementById('manageMenuSection');
        const sidebar = manageMenuSection ? manageMenuSection.querySelector('.layout .sidebar') : null;
        const container = manageMenuSection ? manageMenuSection.querySelector('.layout .container') : null;
        
        if (sidebar) {
          if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-hidden');
          } else {
            // Desktop: ensure collapsed state and update container width
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('mobile-hidden');
            if (container) {
              container.classList.add('full-width');
            }
            updateContainerWidth();
          }
        }
        
        // Update table container height after initialization
        setTimeout(() => {
          updateTableContainerHeight();
        }, 100);
      }, 10);
    },
    initializeData: initializeData,
    setupRealtimeSubscriptions: setupRealtimeSubscriptions,
    toggleCategoryMenu: toggleCategoryMenu,
    updateCategory: updateCategory,
    removeCategory: removeCategory,
    toggleMenu: toggleMenu,
    editDish: editDish,
    deleteDish: deleteDish,
    loadCategories: loadCategories,
    loadDishes: loadDishes
  };
})();
