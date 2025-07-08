// js/camp-dashboard.js - Fixed version with all required functions

class CampDashboard {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.camps = [];
        this.bookings = [];
        this.stats = {};
        this.init();
    }

    async init() {
        console.log('🏕️ Initializing Camp Dashboard...');

        try {
            // Wait for dependencies
            await this.waitForDependencies();

            if (!this.supabase) {
                console.error('❌ Camp Dashboard: Supabase not available');
                return;
            }

            // Check authentication
            await this.checkAuth();

            if (!this.currentUser) {
                console.log('❌ No user found, redirecting to login...');
                window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
                return;
            }

            // Verify user is admin/camp owner
            const userType = this.currentUser.user_metadata?.user_type;
            if (userType !== 'admin' && userType !== 'camp_owner') {
                console.log('⚠️ User is not a camp owner, redirecting...');
                window.location.href = '/index.html';
                return;
            }

            console.log('✅ Camp Dashboard ready for:', this.currentUser.email);

            // Load initial data
            await this.loadDashboardData();
            this.setupEventListeners();
            this.renderDashboard();

        } catch (error) {
            console.error('❌ Critical error in dashboard init:', error);
            this.showError('Dashboard initialization failed. Please refresh the page.');
        }
    }

    async waitForDependencies() {
        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            if (window.supabase && window.supabase.auth) {
                this.supabase = window.supabase;
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        console.error('❌ Timeout waiting for dependencies');
    }

    async checkAuth() {
        try {
            console.log('🔍 Camp Dashboard: Checking authentication...');
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.error('❌ Error getting session:', error);
                return;
            }

            if (session && session.user) {
                this.currentUser = session.user;
                console.log('✅ User authenticated:', this.currentUser.email);
            } else {
                console.log('❌ No session found');
                this.currentUser = null;
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);
            this.currentUser = null;
        }
    }

    async loadDashboardData() {
        console.log('📊 Loading dashboard data...');

        try {
            // Load camps, bookings, and stats
            await Promise.all([
                this.loadCamps(),
                this.loadBookings(),
                this.loadStats()
            ]);
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
        }
    }

    async loadCamps() {
        try {
            const { data, error } = await this.supabase
                .from('camps')
                .select('*')
                .eq('owner_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error loading camps:', error);
                return;
            }

            this.camps = data || [];
            console.log('✅ Loaded camps:', this.camps.length);
        } catch (error) {
            console.error('❌ Exception loading camps:', error);
            this.camps = [];
        }
    }

    // Also fix the loadBookings method to handle empty camps array:
    async loadBookings() {
        try {
            console.log('📋 Loading bookings...');

            // Only load bookings if we have camps
            if (!this.camps || this.camps.length === 0) {
                console.log('ℹ️ No camps found, skipping bookings load');
                this.bookings = [];
                return;
            }

            const campIds = this.camps.map(camp => camp.id);

            // Use a simpler query structure
            const { data, error } = await this.supabase
                .from('bookings')
                .select('*')
                .in('camp_id', campIds)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.warn('⚠️ Bookings query failed, using empty array:', error);
                this.bookings = [];
                return;
            }

            this.bookings = data || [];
            console.log('✅ Loaded bookings:', this.bookings.length);

        } catch (error) {
            console.warn('⚠️ Exception loading bookings, using empty array:', error);
            this.bookings = [];
        }
    }
    async loadStats() {
        try {
            // Calculate basic stats
            this.stats = {
                totalCamps: this.camps.length,
                activeSchedules: 0, // Will be calculated from schedules
                totalBookings: this.bookings.length,
                totalRevenue: this.bookings.reduce((sum, booking) => {
                    return sum + (parseFloat(booking.amount) || 0);
                }, 0)
            };

            console.log('✅ Stats calculated:', this.stats);
        } catch (error) {
            console.error('❌ Error calculating stats:', error);
            this.stats = { totalCamps: 0, activeSchedules: 0, totalBookings: 0, totalRevenue: 0 };
        }
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');

        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Camp form
        const campForm = document.getElementById('campForm');
        if (campForm) {
            campForm.addEventListener('submit', (e) => this.handleCampSubmit(e));
        }

        // Schedule form
        const scheduleForm = document.getElementById('scheduleForm');
        if (scheduleForm) {
            scheduleForm.addEventListener('submit', (e) => this.handleScheduleSubmit(e));
        }
    }

    renderDashboard() {
        console.log('🎨 Rendering dashboard...');

        this.updateStats();
        this.renderCamps();
        this.renderRecentBookings();
        this.loadUserProfile();
    }

    updateStats() {
        const campCountEl = document.getElementById('campCount');
        const scheduleCountEl = document.getElementById('scheduleCount');
        const bookingCountEl = document.getElementById('bookingCount');
        const revenueCountEl = document.getElementById('revenueCount');

        if (campCountEl) campCountEl.textContent = this.stats.totalCamps;
        if (scheduleCountEl) scheduleCountEl.textContent = this.stats.activeSchedules;
        if (bookingCountEl) bookingCountEl.textContent = this.stats.totalBookings;
        if (revenueCountEl) revenueCountEl.textContent = `$${this.stats.totalRevenue.toFixed(2)}`;
    }

    renderCamps() {
        const campsContainer = document.getElementById('campsList');
        if (!campsContainer) return;

        if (this.camps.length === 0) {
            campsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No camps created yet</h3>
                    <p>Create your first camp to start accepting registrations</p>
                    <button class="btn btn-primary" onclick="showAddCamp()">
                        + Create Your First Camp
                    </button>
                </div>
            `;
            return;
        }

        const campsHTML = this.camps.map(camp => `
            <div class="camp-card">
                <div class="camp-header">
                    <h3>${camp.name}</h3>
                    <div class="camp-actions">
                        <button class="btn btn-sm btn-outline" onclick="editCamp('${camp.id}')">Edit</button>
                        <button class="btn btn-sm btn-outline" onclick="viewCampDetails('${camp.id}')">View</button>
                    </div>
                </div>
                <div class="camp-details">
                    <p><strong>Location:</strong> ${camp.location || 'Not specified'}</p>
                    <p><strong>Ages:</strong> ${camp.min_age || 0}-${camp.max_age || 18}</p>
                    <p><strong>Description:</strong> ${camp.description || 'No description'}</p>
                </div>
            </div>
        `).join('');

        campsContainer.innerHTML = campsHTML;
    }

    renderRecentBookings() {
        const bookingsContainer = document.getElementById('recentBookings');
        if (!bookingsContainer) return;

        if (this.bookings.length === 0) {
            bookingsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No recent bookings</p>
                </div>
            `;
            return;
        }

        const bookingsHTML = this.bookings.slice(0, 5).map(booking => `
            <div class="booking-card">
                <div class="booking-info">
                    <h4>${booking.child?.first_name || 'Unknown'} ${booking.child?.last_name || ''}</h4>
                    <p>${booking.camp?.name || 'Unknown Camp'}</p>
                    <small>Booked: ${new Date(booking.created_at).toLocaleDateString()}</small>
                </div>
                <div class="booking-amount">
                    $${parseFloat(booking.amount || 0).toFixed(2)}
                </div>
            </div>
        `).join('');

        bookingsContainer.innerHTML = bookingsHTML;
    }

    async loadUserProfile() {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('❌ Error loading profile:', error);
                return;
            }

            const profile = data || {};
            this.populateProfileDisplay(profile);
        } catch (error) {
            console.error('❌ Exception loading profile:', error);
        }
    }

    populateProfileDisplay(profile) {
        const fields = {
            'displayName': profile.full_name || 'Not provided',
            'displayEmail': this.currentUser.email,
            'displayPhone': profile.phone || 'Not provided',
            'displayAddress': profile.business_address || 'Not provided',
            'displayCity': profile.city || 'Not provided',
            'displayState': profile.state || 'Not provided',
            'displayZip': profile.zip_code || 'Not provided',
            'displayWebsite': profile.website || 'Not provided'
        };

        for (const [elementId, value] of Object.entries(fields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
            }
        }
    }

    // Event Handlers
    async handleProfileUpdate(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const profileData = Object.fromEntries(formData.entries());

        try {
            const { error } = await this.supabase
                .from('profiles')
                .upsert({
                    id: this.currentUser.id,
                    ...profileData,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('❌ Error updating profile:', error);
                this.showError('Failed to update profile');
                return;
            }

            this.showSuccess('Profile updated successfully!');
            this.loadUserProfile();
            this.toggleProfileEdit();
        } catch (error) {
            console.error('❌ Exception updating profile:', error);
            this.showError('Failed to update profile');
        }
    }

    // Simplified fix for camp form submission
    // Replace the handleCampSubmit method in js/camp-dashboard.js

    async handleCampSubmit(e) {
        e.preventDefault();

        console.log('🏕️ Processing camp form submission...');

        try {
            const form = e.target;

            // Get form values using direct element selection (more reliable)
            const campData = {
                owner_id: this.currentUser.id,
                name: form.querySelector('#campName').value,
                location: form.querySelector('#campLocation').value,
                description: form.querySelector('#campDescription').value || '',
                min_age: parseInt(form.querySelector('#minAge').value) || 3,
                max_age: parseInt(form.querySelector('#maxAge').value) || 18
            };

            // Handle interests checkboxes
            const interestCheckboxes = form.querySelectorAll('input[name="camp-interests"]:checked');
            const interests = Array.from(interestCheckboxes).map(cb => cb.value);
            campData.interests = interests;

            // Handle accommodations checkboxes  
            const accommodationCheckboxes = form.querySelectorAll('input[name="camp-accommodations"]:checked');
            const accommodations = Array.from(accommodationCheckboxes).map(cb => cb.value);
            campData.accommodations = accommodations;

            console.log('📊 Camp data to submit:', campData);

            // Validate required fields
            if (!campData.name || !campData.location) {
                this.showError('Please fill in camp name and location');
                return;
            }

            // Submit to database with simpler query
            const { data, error } = await this.supabase
                .from('camps')
                .insert(campData)
                .select()
                .single();

            if (error) {
                console.error('❌ Database error:', error);
                this.showError(`Failed to create camp: ${error.message}`);
                return;
            }

            console.log('✅ Camp created successfully:', data);
            this.showSuccess('Camp created successfully!');

            // Clean up
            this.closeModal('addCampModal');
            form.reset();

            // Reload data
            await this.loadCamps();
            this.renderCamps();
            this.updateStats();

        } catch (error) {
            console.error('❌ Exception creating camp:', error);
            this.showError('An unexpected error occurred. Please try again.');
        }
    }

    async handleScheduleSubmit(e) {
        e.preventDefault();
        // Schedule handling implementation
        this.showError('Schedule creation coming soon!');
    }

    // UI Helper Functions
    showError(message) {
        // Create or update error message display
        let errorDiv = document.getElementById('errorMessage');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'errorMessage';
            errorDiv.className = 'error-message';
            document.body.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        // Create or update success message display
        let successDiv = document.getElementById('successMessage');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.id = 'successMessage';
            successDiv.className = 'success-message';
            document.body.appendChild(successDiv);
        }
        successDiv.textContent = message;
        successDiv.style.display = 'block';

        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }

    toggleProfileEdit() {
        const displayDiv = document.getElementById('profileDisplay');
        const editDiv = document.getElementById('profileEdit');

        if (displayDiv && editDiv) {
            if (displayDiv.style.display === 'none') {
                displayDiv.style.display = 'block';
                editDiv.style.display = 'none';
            } else {
                displayDiv.style.display = 'none';
                editDiv.style.display = 'block';
            }
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

// Global functions for onclick handlers
function showAddCamp() {
    const modal = document.getElementById('addCampModal');
    if (modal) {
        modal.style.display = 'block';
    } else {
        console.error('❌ Add camp modal not found');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function toggleProfileEdit() {
    if (window.campDashboard) {
        window.campDashboard.toggleProfileEdit();
    }
}

function editCamp(campId) {
    console.log('Edit camp:', campId);
    // Implementation coming soon
}

function viewCampDetails(campId) {
    console.log('View camp details:', campId);
    // Implementation coming soon
}

function refreshStats() {
    if (window.campDashboard) {
        window.campDashboard.loadDashboardData().then(() => {
            window.campDashboard.renderDashboard();
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏕️ Camp Dashboard script loaded');
    window.campDashboard = new CampDashboard();
});

// Also try to initialize immediately if DOM is already ready
if (document.readyState === 'loading') {
    // DOM is still loading, event listener above will handle it
} else {
    // DOM is already ready
    console.log('🏕️ Camp Dashboard script loaded (DOM already ready)');
    window.campDashboard = new CampDashboard();
}