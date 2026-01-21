'use strict';

// Login and Authentication Module
// Handles Supabase authentication, session management, and profile setup

(function() {
  // Supabase project credentials
  const SUPABASE_URL = 'https://fddutzbdtcgpunkagflp.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ouboZig1iVAlFVc1rNatIg_Z3buQJZl';

  /*
   * IMPORTANT: Row-Level Security (RLS) Policies Configuration
   * 
   * To enable insert/update/delete operations, you need to configure RLS policies in Supabase:
   * 
   * 1. Go to Supabase Dashboard > Authentication > Policies
   * 2. For the 'categories' table, create policies:
   *    - SELECT: Allow authenticated users to read
   *    - INSERT: Allow authenticated users to insert
   *    - UPDATE: Allow authenticated users to update
   *    - DELETE: Allow authenticated users to delete
   * 
   * 3. For the 'dishes' table, create the same policies
   * 
   * Example policy SQL for INSERT on categories:
   *   CREATE POLICY "Allow authenticated users to insert categories"
   *   ON categories FOR INSERT
   *   TO authenticated
   *   WITH CHECK (true);
   * 
   * Example policy SQL for SELECT on categories:
   *   CREATE POLICY "Allow authenticated users to select categories"
   *   ON categories FOR SELECT
   *   TO authenticated
   *   USING (true);
   */

  // Initialize Supabase client (global scope)
  let supabaseClient;
  
  function initializeSupabaseClient() {
    if (typeof window.supabase === 'undefined') {
      setTimeout(initializeSupabaseClient, 100);
      return;
    }
    
    try {
      if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.error('Supabase credentials not configured');
        window.location.replace('../index.html');
        return;
      }
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      // Make supabaseClient available globally for manage_menu.js
      window.supabaseClient = supabaseClient;
      console.log('Supabase client initialized');
      
      // After Supabase is initialized, check authentication and setup
      checkAuthAndSetup();
    } catch (error) {
      console.error('Error initializing Supabase:', error);
      window.location.replace('../index.html');
    }
  }
  
  function checkAuthAndSetup() {
    // Authentication check and profile setup
    (async function() {
      if (!supabaseClient) {
        window.location.replace('../index.html');
        return;
      }

      // Handle OAuth callback if present (when OAuth redirects to admin.html)
      const hash = window.location.hash;
      let session = null;
      let sessionError = null;
      
      if (hash && (hash.includes('access_token') || hash.includes('error'))) {
        // Wait for Supabase to process the OAuth tokens from the hash
        // Initial wait to let Supabase process the tokens, then retry if needed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry checking session up to 5 times with delays
        for (let i = 0; i < 5; i++) {
          const result = await supabaseClient.auth.getSession();
          session = result.data?.session;
          sessionError = result.error;
          if (session) {
            // Session found, clean up URL hash and proceed
            window.history.replaceState({}, document.title, window.location.pathname);
            break;
          }
          if (sessionError) break; // Error occurred, stop retrying
          // Wait before next retry
          if (i < 4) await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Clean up URL hash if not already cleaned
        if (window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        // Normal session check (no OAuth callback)
        const result = await supabaseClient.auth.getSession();
        session = result.data?.session;
        sessionError = result.error;
      }

      if (sessionError || !session) {
        // No valid session, redirect to login
        window.location.replace('../index.html');
        return;
      }

      // User is authenticated, setup profile
      const user = session.user;
      const profileIcon = document.getElementById('profileIcon');
      const profileEmail = document.getElementById('profileEmail');
      const profileDropdown = document.getElementById('profileDropdown');
      const logoutOption = document.getElementById('logoutOption');

      // Get user email (from user_metadata or email)
      const userEmail = user.email || user.user_metadata?.email || 'Admin';
      const firstLetter = userEmail.charAt(0).toUpperCase();

      profileIcon.textContent = firstLetter;
      profileEmail.textContent = userEmail;
      
      // Add menu URL to profile dropdown
      const menuUrlItem = document.createElement('div');
      menuUrlItem.className = 'profile-dropdown-item menu-url';
      menuUrlItem.style.cssText = 'padding: 8px 12px; border-top: 1px solid #e5e7eb; cursor: pointer; font-size: 12px;';
      
      // Get the base URL for the user-side menu
      // Include the repository path for GitHub Pages (e.g., /zen-menu)
      const basePath = window.location.pathname.split('/').filter(p => p && !p.includes('.html')).join('/');
      const baseUrl = window.location.origin + (basePath ? '/' + basePath : '');
      const menuUrl = `${baseUrl}/user-side/menu.html?admin_id=${user.id}`;
   
      
      menuUrlItem.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px; color: #1f2937;">Your Menu URL:</div>
        <div style="color: #3b82f6; word-break: break-all; font-size: 11px;" id="menuUrlText">${menuUrl}</div>
        <button style="margin-top: 8px; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;" onclick="navigator.clipboard.writeText('${menuUrl}').then(() => { this.textContent = 'Copied!'; setTimeout(() => { this.textContent = 'Copy URL'; }, 2000); })">Copy URL</button>
      `;
      
      profileDropdown.insertBefore(menuUrlItem, logoutOption);

      // Add Manage Menu option
      const manageMenuItem = document.createElement('div');
      manageMenuItem.className = 'profile-dropdown-item';
      manageMenuItem.textContent = 'Manage Menu';
      manageMenuItem.style.cssText = 'padding: 8px 12px; border-top: 1px solid #e5e7eb; cursor: pointer;';
      manageMenuItem.addEventListener('click', async function() {
        const manageMenuSection = document.getElementById('manageMenuSection');
        const menuToggle = document.getElementById('menuToggle');
        if (manageMenuSection) {
          // Load HTML content if not already loaded
          if (manageMenuSection.children.length === 0) {
            try {
              const response = await fetch('manage_menu.html');
              const html = await response.text();
              manageMenuSection.innerHTML = html;
              
              // Initialize the manage menu module
              if (window.manageMenuModule) {
                await window.manageMenuModule.initialize();
                await window.manageMenuModule.setupRealtimeSubscriptions();
              }
            } catch (error) {
              console.error('Error loading manage menu:', error);
              alert('Failed to load manage menu. Please refresh the page.');
              return;
            }
          }
          
          manageMenuSection.style.display = 'block';
          // Keep menu toggle visible for Manage Menu sidebar (especially on mobile)
          // Hide main Order Management sidebar
          const mainSidebar = document.getElementById('sidebar');
          const ordersSection = document.getElementById('ordersSection');
          if (mainSidebar) mainSidebar.style.display = 'none';
          if (ordersSection) ordersSection.style.display = 'none';
          // Close dropdown after clicking
          profileDropdown.classList.remove('show');
          
          // Update URL to reflect Manage Menu state
          window.history.pushState({ page: 'manage-menu' }, 'Manage Menu', '#manage-menu');
        }
      });
      profileDropdown.insertBefore(manageMenuItem, logoutOption);
      
      // Handle browser back/forward buttons
      window.addEventListener('popstate', function(event) {
        const manageMenuSection = document.getElementById('manageMenuSection');
        const menuToggle = document.getElementById('menuToggle');
        
        if (window.location.hash === '#manage-menu') {
          // Show manage menu
          if (manageMenuSection) {
            // Load HTML content if not already loaded
            if (manageMenuSection.children.length === 0) {
              fetch('manage_menu.html')
                .then(response => response.text())
                .then(html => {
                  manageMenuSection.innerHTML = html;
                  // Initialize the manage menu module
                  if (window.manageMenuModule) {
                    window.manageMenuModule.initialize().then(() => {
                      window.manageMenuModule.setupRealtimeSubscriptions();
                    });
                  }
                })
                .catch(error => {
                  console.error('Error loading manage menu:', error);
                });
            }
            manageMenuSection.style.display = 'block';
            // Keep menu toggle visible for Manage Menu sidebar
            // Hide main Order Management sidebar
            const mainSidebar = document.getElementById('sidebar');
            const ordersSection = document.getElementById('ordersSection');
            if (mainSidebar) mainSidebar.style.display = 'none';
            if (ordersSection) ordersSection.style.display = 'none';
          }
        } else {
          // Hide manage menu and show Orders section (going back to Orders page)
          if (manageMenuSection) {
            manageMenuSection.style.display = 'none';
          }
          
          // Show menu toggle
          if (menuToggle) {
            menuToggle.style.removeProperty('display');
          }
          
          // Show main Order Management sidebar again
          const mainSidebar = document.getElementById('sidebar');
          if (mainSidebar) {
            mainSidebar.style.removeProperty('display');
          }
          
          // Load and show Orders section
          const ordersSection = document.getElementById('ordersSection');
          if (ordersSection) {
            ordersSection.style.display = 'block';
            
            // Ensure Orders tab is active
            const ordersTab = document.querySelector('.sidebar-tab[data-tab="orders"]');
            if (ordersTab) {
              document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
              ordersTab.classList.add('active');
            }
            
            // Re-initialize order management to ensure orders are loaded
            setTimeout(function() {
              if (window.loadOrdersSummary) {
                window.loadOrdersSummary();
              } else if (window.orderManagementModule) {
                window.orderManagementModule.initialize();
              }
            }, 100);
          }
        }
      });
      
      // Check URL hash on load to show Manage Menu if needed
      // Check after a short delay to ensure all elements are ready
      setTimeout(function() {
        if (window.location.hash === '#manage-menu') {
          // Trigger Manage Menu click to load and show it
          manageMenuItem.click();
        } else {
          // Ensure Orders page is shown if no hash (initial load or back button)
          const manageMenuSection = document.getElementById('manageMenuSection');
          const ordersSection = document.getElementById('ordersSection');
          const mainSidebar = document.getElementById('sidebar');
          
          if (manageMenuSection && manageMenuSection.style.display !== 'none') {
            manageMenuSection.style.display = 'none';
          }
          if (ordersSection && ordersSection.style.display === 'none') {
            ordersSection.style.display = 'block';
            if (window.loadOrdersSummary) {
              window.loadOrdersSummary();
            }
          }
          if (mainSidebar && mainSidebar.style.display === 'none') {
            mainSidebar.style.removeProperty('display');
          }
        }
      }, 200);

      // Toggle dropdown on profile icon click
      profileIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', function(e) {
        if (!profileIcon.contains(e.target) && !profileDropdown.contains(e.target)) {
          profileDropdown.classList.remove('show');
        }
      });

      // Logout functionality
      logoutOption.addEventListener('click', async function() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
          console.error('Error signing out:', error);
        } else {
          window.location.replace('../index.html');
        }
      });

      // Listen for auth state changes (e.g., token expiration)
      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          window.location.replace('../index.html');
        }
      });
      
      // Store user ID after authentication and make available globally
      window.currentUserId = user.id;
    })();
  }
  
  // Expose initialization function
  window.loginModule = {
    initialize: function() {
      // Start initialization when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSupabaseClient);
      } else {
        initializeSupabaseClient();
      }
    }
  };
  
  // Auto-initialize if DOM is already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.loginModule.initialize();
    });
  } else {
    window.loginModule.initialize();
  }
})();
