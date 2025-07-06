// js/navigation.js - Fixed Navigation Dropdown System

class Navigation {
    constructor() {
        this.user = null;
        this.supabase = window.supabase; // Assuming you have supabase initialized
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
    }

    async checkAuth() {
        try {
            // Replace with your actual Supabase auth check
            const { data: { user }, error } = await this.supabase.auth.getUser();

            if (user) {
                this.user = user;
                this.renderUserDropdown();
            } else {
                this.renderAuthButtons();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.renderAuthButtons();
        }
    }

    renderUserDropdown() {
        const navAuth = document.getElementById('navAuth');
        if (!navAuth) return;

        const userEmail = this.user.email || 'User';

        navAuth.innerHTML = `
            <div class="user-dropdown">
                <button class="user-btn" id="userBtn">
                    ${userEmail}
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
        if (!navAuth) return;

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
            // Replace with your actual Supabase logout
            const { error } = await this.supabase.auth.signOut();

            if (error) {
                console.error('Logout error:', error);
                return;
            }

            this.user = null;
            this.renderAuthButtons();

            // Redirect to home page
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Navigation();
});

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navigation;
}