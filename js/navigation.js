// js/navigation.js - Fixed Navigation with Proper Authentication

class Navigation {
    constructor() {
        this.user = null;
        this.supabase = window.supabase;
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();

        // Listen for auth state changes
        if (this.supabase) {
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event, session);
                if (event === 'SIGNED_IN') {
                    this.user = session.user;
                    this.renderUserDropdown();
                } else if (event === 'SIGNED_OUT') {
                    this.user = null;
                    this.renderAuthButtons();
                }
            });
        }
    }

    async checkAuth() {
        try {
            if (!this.supabase) {
                console.warn('Supabase not initialized, showing auth buttons');
                this.renderAuthButtons();
                return;
            }

            // Get current session
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.error('Error getting session:', error);
                this.renderAuthButtons();
                return;
            }

            if (session && session.user) {
                this.user = session.user;
                console.log('User is logged in:', this.user.email);
                this.renderUserDropdown();
            } else {
                console.log('No active session, showing auth buttons');
                this.renderAuthButtons();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.renderAuthButtons();
        }
    }

    renderUserDropdown() {
        const navAuth = document.getElementById('navAuth');
        if (!navAuth) {
            console.warn('navAuth element not found');
            return;
        }

        const userEmail = this.user?.email || 'User';
        // Take first part of email for display
        const displayName = userEmail.split('@')[0];

        navAuth.innerHTML = `
            <div class="user-dropdown">
                <button class="user-btn" id="userBtn">
                    ${displayName}
                </button>
                <div class="dropdown-menu" id="dropdownMenu">
                    <a href="/profile.html">Profile</a>
                    <a href="/calendar.html">Calendar</a>
                    <a href="/bookings.html">Bookings</a>
                    <div class="divider"></div>
                    <a href="#" id="logoutBtn">Logout</a>
                </div>
            </div>
        `;
    }

    renderAuthButtons() {
        const navAuth = document.getElementById('navAuth');
        if (!navAuth) {
            console.warn('navAuth element not found');
            return;
        }

        navAuth.innerHTML = `
            <div class="auth-buttons">
                <a href="/login.html" class="btn btn-secondary">Login</a>
                <a href="/signup.html" class="btn btn-primary">Sign Up</a>
            </div>
        `;
    }

    setupEventListeners() {
        // Handle dropdown toggle with event delegation
        document.addEventListener('click', (e) => {
            const userBtn = document.getElementById('userBtn');
            const dropdownMenu = document.getElementById('dropdownMenu');

            if (userBtn && e.target === userBtn) {
                e.preventDefault();
                const isOpen = dropdownMenu.classList.contains('show');

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

        // Handle logout
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutBtn') {
                e.preventDefault();
                this.logout();
            }
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
            }
        });
    }

    openDropdown() {
        const userBtn = document.getElementById('userBtn');
        const dropdownMenu = document.getElementById('dropdownMenu');

        if (userBtn && dropdownMenu) {
            userBtn.classList.add('active');
            dropdownMenu.classList.add('show');
        }
    }

    closeDropdown() {
        const userBtn = document.getElementById('userBtn');
        const dropdownMenu = document.getElementById('dropdownMenu');

        if (userBtn && dropdownMenu) {
            userBtn.classList.remove('active');
            dropdownMenu.classList.remove('show');
        }
    }

    async logout() {
        try {
            if (!this.supabase) {
                console.warn('Supabase not initialized');
                return;
            }

            console.log('Logging out...');
            const { error } = await this.supabase.auth.signOut();

            if (error) {
                console.error('Logout error:', error);
                return;
            }

            console.log('Logout successful');
            this.user = null;
            this.renderAuthButtons();

            // Redirect to home page after logout
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    // Public method to manually refresh auth state
    async refreshAuth() {
        await this.checkAuth();
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing navigation...');
    window.navigation = new Navigation();
});

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navigation;
}