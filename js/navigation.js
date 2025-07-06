// js/navigation.js - FIXED VERSION with Working Dropdown

class Navigation {
    constructor() {
        this.user = null;
        this.supabase = null;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 50;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing navigation...');

        // Wait for Supabase to be ready
        await this.waitForSupabase();

        if (!this.supabase) {
            console.error('❌ Navigation: Supabase not available');
            this.renderAuthButtons(); // Fallback to showing auth buttons
            return;
        }

        console.log('✅ Navigation: Supabase ready');

        // Now we can safely proceed
        this.checkAuth();
        this.setupEventListeners();
        this.setupAuthListener();
    }

    async waitForSupabase() {
        console.log('⏳ Navigation: Waiting for Supabase...');

        while (this.initializationAttempts < this.maxInitializationAttempts) {
            this.initializationAttempts++;

            // Check if Supabase client is ready
            if (window.supabase && window.supabase.auth) {
                this.supabase = window.supabase;
                console.log('✅ Navigation: Supabase client ready');
                return;
            }

            console.log(`⏳ Navigation: Attempt ${this.initializationAttempts}/${this.maxInitializationAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.error('❌ Navigation: Timeout waiting for Supabase');
    }

    setupAuthListener() {
        if (!this.supabase || !this.supabase.auth) {
            console.warn('⚠️ Navigation: Cannot setup auth listener - Supabase not ready');
            return;
        }

        // Listen for auth state changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔄 Navigation: Auth state changed:', event);

            if (event === 'SIGNED_IN' && session) {
                this.user = session.user;
                console.log('✅ Navigation: User signed in:', this.user.email);
                this.renderUserDropdown();
            } else if (event === 'SIGNED_OUT') {
                this.user = null;
                console.log('👋 Navigation: User signed out');
                this.renderAuthButtons();
            }
        });
    }

    async checkAuth() {
        if (!this.supabase || !this.supabase.auth) {
            console.warn('⚠️ Navigation: Cannot check auth - Supabase not ready');
            this.renderAuthButtons();
            return;
        }

        try {
            console.log('🔍 Navigation: Checking authentication...');

            // Get current session
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.error('❌ Navigation: Error getting session:', error);
                this.renderAuthButtons();
                return;
            }

            if (session && session.user) {
                this.user = session.user;
                console.log('✅ Navigation: User is logged in:', this.user.email);
                this.renderUserDropdown();
            } else {
                console.log('ℹ️ Navigation: No active session');
                this.renderAuthButtons();
            }

        } catch (error) {
            console.error('❌ Navigation: Auth check failed:', error);
            this.renderAuthButtons();
        }
    }

    renderUserDropdown() {
        const navAuth = document.getElementById('navAuth');
        if (!navAuth) {
            console.warn('⚠️ Navigation: navAuth element not found');
            return;
        }

        const userEmail = this.user?.email || 'User';
        // Take first part of email for display
        const displayName = userEmail.split('@')[0];

        navAuth.innerHTML = `
            <div class="user-dropdown">
                <button class="user-btn" id="userBtn">
                    <span>${displayName}</span>
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-menu" id="dropdownMenu">
                    <a href="/profile.html">👤 Profile</a>
                    <a href="/calendar.html">📅 Calendar</a>
                    <a href="/bookings.html">📋 Bookings</a>
                    <div class="divider"></div>
                    <a href="#" id="logoutBtn">🚪 Logout</a>
                </div>
            </div>
        `;

        console.log('✅ Navigation: User dropdown rendered for:', displayName);
    }

    renderAuthButtons() {
        const navAuth = document.getElementById('navAuth');
        if (!navAuth) {
            console.warn('⚠️ Navigation: navAuth element not found');
            return;
        }

        navAuth.innerHTML = `
            <div class="auth-buttons">
                <a href="/login.html" class="btn btn-secondary">Login</a>
                <a href="/signup.html" class="btn btn-primary">Sign Up</a>
            </div>
        `;

        console.log('✅ Navigation: Auth buttons rendered');
    }

    setupEventListeners() {
        // Handle dropdown toggle with event delegation
        document.addEventListener('click', (e) => {
            const userBtn = document.getElementById('userBtn');
            const dropdownMenu = document.getElementById('dropdownMenu');

            // Check if clicked on user button or its children
            if (userBtn && (e.target === userBtn || userBtn.contains(e.target))) {
                e.preventDefault();
                e.stopPropagation();

                console.log('👆 User button clicked');

                const isOpen = dropdownMenu && dropdownMenu.classList.contains('show');

                if (isOpen) {
                    this.closeDropdown();
                } else {
                    this.openDropdown();
                }
            } else if (dropdownMenu && !dropdownMenu.contains(e.target)) {
                // Click outside dropdown - close it
                this.closeDropdown();
            }
        });

        // Handle logout with event delegation
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutBtn') {
                e.preventDefault();
                e.stopPropagation();
                console.log('👆 Logout button clicked');
                this.logout();
            }
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
            }
        });

        console.log('✅ Navigation: Event listeners setup');
    }

    openDropdown() {
        const userBtn = document.getElementById('userBtn');
        const dropdownMenu = document.getElementById('dropdownMenu');

        if (userBtn && dropdownMenu) {
            console.log('📂 Opening dropdown');
            userBtn.classList.add('active');
            dropdownMenu.classList.add('show');

            // Update arrow
            const arrow = userBtn.querySelector('.dropdown-arrow');
            if (arrow) {
                arrow.style.transform = 'rotate(180deg)';
            }
        }
    }

    closeDropdown() {
        const userBtn = document.getElementById('userBtn');
        const dropdownMenu = document.getElementById('dropdownMenu');

        if (userBtn && dropdownMenu) {
            console.log('📁 Closing dropdown');
            userBtn.classList.remove('active');
            dropdownMenu.classList.remove('show');

            // Reset arrow
            const arrow = userBtn.querySelector('.dropdown-arrow');
            if (arrow) {
                arrow.style.transform = 'rotate(0deg)';
            }
        }
    }

    async logout() {
        if (!this.supabase || !this.supabase.auth) {
            console.warn('⚠️ Navigation: Cannot logout - Supabase not ready');
            return;
        }

        try {
            console.log('👋 Navigation: Logging out...');

            // Close dropdown first
            this.closeDropdown();

            const { error } = await this.supabase.auth.signOut();

            if (error) {
                console.error('❌ Navigation: Logout error:', error);
                return;
            }

            console.log('✅ Navigation: Logout successful');
            this.user = null;
            this.renderAuthButtons();

            // Redirect to home page after logout
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                window.location.href = '/';
            }

        } catch (error) {
            console.error('❌ Navigation: Logout failed:', error);
        }
    }

    // Public method to manually refresh auth state
    async refreshAuth() {
        await this.checkAuth();
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM ready - Initializing navigation...');
    window.navigation = new Navigation();
});

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navigation;
}