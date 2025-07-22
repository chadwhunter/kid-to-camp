// js/camp-dashboard.js - Fixed version with robust error handling and correct column names

class CampDashboard {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.camps = [];
        this.bookings = [];
        this.schedules = [];
        this.stats = {};
        this.profile = null;
        this.init();
    }

    async init() {
        console.log('🏕️ Initializing Camp Dashboard...');

        try {
            // Wait for dependencies
            await this.waitForDependencies();

            if (!this.supabase) {
                console.error('❌ Camp Dashboard: Supabase not available');
                this.showError('System initialization failed. Please refresh the page.');
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
                this.showError('Access denied. This dashboard is for camp owners only.');
                setTimeout(() => window.location.href = '/index.html', 2000);
                return;
            }

            console.log('✅ Camp Dashboard ready for:', this.currentUser.email);

            // Load initial data with error handling
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
        const maxAttempts = 50; // 5 seconds max

        console.log('⏳ Waiting for dependencies...');

        while (attempts < maxAttempts) {
            // Primary check: Look for the global Supabase client created by config.js
            if (window.supabase && window.supabase.auth && typeof window.supabase.auth.getSession === 'function') {
                console.log('✅ Found global Supabase client from config.js');
                this.supabase = window.supabase;
                return true;
            }

            // Secondary check: Look for kidToCamp instance (fallback)
            if (window.kidToCamp?.supabase) {
                console.log('✅ Found Supabase via kidToCamp');
                this.supabase = window.kidToCamp.supabase;
                return true;
            }

            console.log(`⏳ Attempt ${attempts + 1}/${maxAttempts} - waiting for Supabase...`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        console.error('❌ Dependencies timeout');
        console.log('Available globals:', {
            'window.supabase': !!window.supabase,
            'window.supabase.auth': !!window.supabase?.auth,
            'window.kidToCamp': !!window.kidToCamp,
            'window.CONFIG': !!window.CONFIG
        });
        return false;
    }

    async checkAuth() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            this.currentUser = session?.user || null;

            if (this.currentUser) {
                console.log('✅ User authenticated:', this.currentUser.email);
            }

            return this.currentUser;
        } catch (error) {
            console.error('❌ Auth check failed:', error);
            return null;
        }
    }

    async loadDashboardData() {
        console.log('📊 Loading dashboard data...');

        // Load in sequence with error handling for each
        await this.loadUserProfile();
        await this.loadCamps();
        await this.loadBookings();
        await this.loadSchedules();
        await this.calculateStats();

        console.log('✅ Dashboard data loaded');
    }

    async loadUserProfile() {
        try {
            console.log('👤 Loading user profile...');

            // Use maybeSingle to avoid errors if profile doesn't exist
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                console.warn('⚠️ Profile loading error:', error);
                // Don't fail completely - dashboard can work without profile
            }

            this.profile = data || {};
            console.log('✅ Profile loaded:', this.profile.id ? 'Found' : 'Using defaults');

            this.populateProfileDisplay();

        } catch (error) {
            console.warn('⚠️ Exception loading profile, using defaults:', error);
            this.profile = {};
            this.populateProfileDisplay();
        }
    }

    async loadCamps() {
        try {
            console.log('🏕️ Loading camps...');

            const { data, error } = await this.supabase
                .from('camps')
                .select('*')
                .eq('owner_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('⚠️ Camps loading error:', error);
                this.camps = [];
                return;
            }

            this.camps = data || [];
            console.log('✅ Camps loaded:', this.camps.length);

        } catch (error) {
            console.warn('⚠️ Exception loading camps, using empty array:', error);
            this.camps = [];
        }
    }

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

            // Simple query - avoid complex joins for now
            const { data, error } = await this.supabase
                .from('bookings')
                .select(`
                    *,
                    child_profiles!inner(first_name, last_name),
                    camps!inner(name)
                `)
                .in('camp_id', campIds)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.warn('⚠️ Bookings query with joins failed, trying simple query:', error);

                // Fallback to simple query
                const { data: simpleData, error: simpleError } = await this.supabase
                    .from('bookings')
                    .select('*')
                    .in('camp_id', campIds)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (simpleError) {
                    console.warn('⚠️ Simple bookings query also failed:', simpleError);
                    this.bookings = [];
                    return;
                }

                this.bookings = simpleData || [];
                console.log('✅ Bookings loaded (simple query):', this.bookings.length);
                return;
            }

            this.bookings = data || [];
            console.log('✅ Bookings loaded (with joins):', this.bookings.length);

        } catch (error) {
            console.warn('⚠️ Exception loading bookings, using empty array:', error);
            this.bookings = [];
        }
    }

    async loadSchedules() {
        try {
            console.log('📅 Loading schedules...');

            if (!this.camps || this.camps.length === 0) {
                console.log('ℹ️ No camps found, skipping schedules load');
                this.schedules = [];
                return;
            }

            const campIds = this.camps.map(camp => camp.id);

            const { data, error } = await this.supabase
                .from('camp_schedules')
                .select('*')
                .in('camp_id', campIds)
                .order('start_date', { ascending: true });

            if (error) {
                console.warn('⚠️ Schedules loading error:', error);
                this.schedules = [];
                return;
            }

            this.schedules = data || [];
            console.log('✅ Schedules loaded:', this.schedules.length);

        } catch (error) {
            console.warn('⚠️ Exception loading schedules, using empty array:', error);
            this.schedules = [];
        }
    }

    async calculateStats() {
        try {
            // Calculate stats from loaded data
            const activeSchedules = this.schedules.filter(schedule => {
                const now = new Date();
                const endDate = new Date(schedule.end_date);
                return endDate >= now;
            }).length;

            const totalRevenue = this.bookings.reduce((sum, booking) => {
                return sum + (parseFloat(booking.amount) || 0);
            }, 0);

            this.stats = {
                totalCamps: this.camps.length,
                activeSchedules: activeSchedules,
                totalBookings: this.bookings.length,
                totalRevenue: totalRevenue
            };

            console.log('✅ Stats calculated:', this.stats);
        } catch (error) {
            console.error('❌ Error calculating stats:', error);
            this.stats = { totalCamps: 0, activeSchedules: 0, totalBookings: 0, totalRevenue: 0 };
        }
    }

    populateProfileDisplay() {
        const profile = this.profile || {};

        const fields = {
            'displayName': profile.full_name || profile.first_name || 'Not provided',
            'displayEmail': this.currentUser.email,
            'displayPhone': profile.phone || 'Not provided',
            'displayAddress': profile.business_address || profile.address || 'Not provided',
            'displayCity': profile.city || 'Not provided',
            'displayState': profile.state || 'Not provided',
            'displayZip': profile.zip_code || profile.zip || 'Not provided',
            'displayWebsite': profile.website || 'Not provided'
        };

        for (const [elementId, value] of Object.entries(fields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
            }
        }
    }

    renderDashboard() {
        console.log('🎨 Rendering dashboard...');

        this.renderStats();
        this.renderCamps();
        this.renderRecentBookings();

        console.log('✅ Dashboard rendered');
    }

    renderStats() {
        const statElements = {
            'campCount': this.stats.totalCamps,
            'scheduleCount': this.stats.activeSchedules,
            'bookingCount': this.stats.totalBookings,
            'revenueCount': `$${this.stats.totalRevenue.toFixed(2)}`
        };

        for (const [elementId, value] of Object.entries(statElements)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
            }
        }
    }

    renderCamps() {
        const campsContainer = document.getElementById('myCamps');
        if (!campsContainer) return;

        if (this.camps.length === 0) {
            campsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No camps created yet</p>
                    <button class="btn btn-primary" onclick="showModal('addCampModal')">Add Your First Camp</button>
                </div>
            `;
            return;
        }

        const campsHTML = this.camps.map(camp => `
            <div class="camp-card">
                <div class="camp-header">
                    <h4>${camp.name}</h4>
                    <div class="camp-actions">
                        <button class="btn btn-sm btn-outline" onclick="editCamp(${camp.id})">Edit</button>
                        <button class="btn btn-sm btn-primary" onclick="viewCampDetails(${camp.id})">View</button>
                    </div>
                </div>
                <div class="camp-details">
                    <p><strong>Location:</strong> ${camp.location || 'Not specified'}</p>
                    <p><strong>Ages:</strong> ${camp.min_age || 0}-${camp.max_age || 18}</p>
                    <p><strong>Description:</strong> ${camp.description || 'No description'}</p>
                    <p><strong>Interests:</strong> ${camp.interests?.join(', ') || 'None specified'}</p>
                    <p><strong>Accommodations:</strong> ${camp.special_needs_accommodations?.join(', ') || 'None specified'}</p>
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
                    <p>No bookings yet</p>
                </div>
            `;
            return;
        }

        const bookingsHTML = this.bookings.slice(0, 5).map(booking => `
            <div class="booking-card">
                <div class="booking-info">
                    <h4>
                        ${booking.child_profiles?.first_name || 'Unknown'} 
                        ${booking.child_profiles?.last_name || ''}
                    </h4>
                    <p>${booking.camps?.name || 'Unknown Camp'}</p>
                    <small>Booked: ${new Date(booking.created_at).toLocaleDateString()}</small>
                </div>
                <div class="booking-amount">
                    $${parseFloat(booking.amount || 0).toFixed(2)}
                </div>
            </div>
        `).join('');

        bookingsContainer.innerHTML = bookingsHTML;
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');

        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Camp form - with correct column names
        const campForm = document.getElementById('campForm');
        if (campForm) {
            campForm.addEventListener('submit', (e) => this.handleCampSubmit(e));
        }

        console.log('✅ Event listeners set up');
    }

    async handleCampSubmit(e) {
        e.preventDefault();

        console.log('🏕️ Processing camp form submission...');

        try {
            const form = e.target;

            // Get form values with CORRECT column names from database schema
            const campData = {
                owner_id: this.currentUser.id,
                name: form.querySelector('#campName').value,
                location: form.querySelector('#campLocation').value,
                description: form.querySelector('#campDescription').value || '',
                min_age: parseInt(form.querySelector('#minAge').value) || 3,
                max_age: parseInt(form.querySelector('#maxAge').value) || 18
            };

            // Handle interests array
            const interestCheckboxes = form.querySelectorAll('input[name="camp-interests"]:checked');
            const interests = Array.from(interestCheckboxes).map(cb => cb.value);
            if (interests.length > 0) {
                campData.interests = interests;
            }

            // Handle accommodations - use CORRECT column name: special_needs_accommodations
            const accommodationCheckboxes = form.querySelectorAll('input[name="camp-accommodations"]:checked');
            const accommodations = Array.from(accommodationCheckboxes).map(cb => cb.value);
            if (accommodations.length > 0) {
                campData.special_needs_accommodations = accommodations;
            }

            console.log('📊 Camp data to submit:', JSON.stringify(campData, null, 2));

            // Validate required fields
            if (!campData.name || !campData.location) {
                this.showError('Please fill in camp name and location');
                return;
            }

            // Submit to database
            console.log('📤 Submitting camp data...');
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

            // Refresh camps list
            await this.loadCamps();
            await this.calculateStats();
            this.renderDashboard();

            // Close modal and reset form
            this.closeModal('addCampModal');
            form.reset();

        } catch (error) {
            console.error('❌ Exception creating camp:', error);
            this.showError('Failed to create camp. Please try again.');
        }
    }

    async handleProfileUpdate(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const profileData = {
            id: this.currentUser.id,
            user_type: this.currentUser.user_metadata?.user_type || 'admin',
            updated_at: new Date().toISOString()
        };

        // Add form fields
        for (const [key, value] of formData.entries()) {
            profileData[key] = value;
        }

        try {
            const { error } = await this.supabase
                .from('profiles')
                .upsert(profileData);

            if (error) {
                console.error('❌ Error updating profile:', error);
                this.showError(`Failed to update profile: ${error.message}`);
                return;
            }

            this.showSuccess('Profile updated successfully!');

            // Reload profile and update display
            await this.loadUserProfile();
            this.toggleProfileEdit();

        } catch (error) {
            console.error('❌ Exception updating profile:', error);
            this.showError('Failed to update profile');
        }
    }

    // UI Helper Methods
    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type = 'info') {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; float: right; cursor: pointer;">&times;</button>
        `;

        // Add to page
        const container = document.querySelector('.container') || document.body;
        container.insertBefore(messageEl, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.remove();
            }
        }, 5000);
    }

    toggleProfileEdit() {
        const display = document.getElementById('profileDisplay');
        const edit = document.getElementById('profileEdit');

        if (display && edit) {
            const isEditing = display.style.display === 'none';

            display.style.display = isEditing ? 'block' : 'none';
            edit.style.display = isEditing ? 'none' : 'block';

            // If switching to edit mode, populate form
            if (!isEditing && this.profile) {
                this.populateProfileForm();
            }
        }
    }

    populateProfileForm() {
        const profile = this.profile || {};

        const fields = {
            'profileName': profile.full_name || profile.first_name || '',
            'profilePhone': profile.phone || '',
            'profileAddress': profile.business_address || profile.address || '',
            'profileCity': profile.city || '',
            'profileState': profile.state || '',
            'profileZip': profile.zip_code || profile.zip || '',
            'profileWebsite': profile.website || ''
        };

        for (const [elementId, value] of Object.entries(fields)) {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = value;
            }
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Camp management methods
    showAddCampModal() {
        showModal('addCampModal');
    }
}

// Global functions for HTML onclick handlers
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function showAddCamp() {
    if (window.campDashboard) {
        window.campDashboard.showAddCampModal();
    } else {
        showModal('addCampModal');
    }
}

function toggleProfileEdit() {
    if (window.campDashboard) {
        window.campDashboard.toggleProfileEdit();
    }
}

function editCamp(campId) {
    console.log('Edit camp:', campId);
    // TODO: Implement camp editing
    alert('Camp editing coming soon!');
}

function viewCampDetails(campId) {
    console.log('View camp details:', campId);
    // TODO: Implement camp details view
    alert('Camp details view coming soon!');
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
if (document.readyState !== 'loading') {
    console.log('🏕️ Camp Dashboard script loaded (DOM already ready)');
    window.campDashboard = new CampDashboard();
}