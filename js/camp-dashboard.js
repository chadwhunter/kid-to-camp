// Updated camp-dashboard.js for organization-based structure

class CampDashboard {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.userOrganizations = [];
        this.currentOrganization = null;
        this.camps = [];
        this.bookings = [];
        this.stats = {};
        this.profile = null;
        this.init();
    }

    async init() {
        console.log('🏕️ Initializing Organization-Aware Camp Dashboard...');

        try {
            await this.waitForDependencies();

            if (!this.supabase) {
                console.error('❌ Camp Dashboard: Supabase not available');
                this.showError('System initialization failed. Please refresh the page.');
                return;
            }

            await this.checkAuth();

            if (!this.currentUser) {
                console.log('❌ No user found, redirecting to login...');
                window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
                return;
            }

            // Load user's organizations
            await this.loadUserOrganizations();

            if (this.userOrganizations.length === 0) {
                console.log('⚠️ User has no organizations, redirecting...');
                this.showError('No organizations found. Please contact support.');
                return;
            }

            // Set current organization (first one for now)
            this.currentOrganization = this.userOrganizations[0];
            console.log('✅ Camp Dashboard ready for organization:', this.currentOrganization.name);

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

        console.log('⏳ Waiting for dependencies...');

        while (attempts < maxAttempts) {
            if (window.supabase && window.supabase.auth && typeof window.supabase.auth.getSession === 'function') {
                console.log('✅ Found global Supabase client from config.js');
                this.supabase = window.supabase;
                return true;
            }

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

    async loadUserOrganizations() {
        try {
            console.log('🏢 Loading user organizations...');

            const { data, error } = await this.supabase
                .from('organization_members')
                .select(`
                    role,
                    organizations (
                        id,
                        name,
                        description,
                        email,
                        phone,
                        website
                    )
                `)
                .eq('user_id', this.currentUser.id);

            if (error) {
                console.warn('⚠️ Error loading organizations:', error);
                this.userOrganizations = [];
                return;
            }

            this.userOrganizations = data.map(item => ({
                ...item.organizations,
                role: item.role
            }));

            console.log('✅ Organizations loaded:', this.userOrganizations.length);

        } catch (error) {
            console.warn('⚠️ Exception loading organizations:', error);
            this.userOrganizations = [];
        }
    }

    async loadDashboardData() {
        console.log('📊 Loading dashboard data for organization:', this.currentOrganization.name);

        await this.loadCamps();
        await this.loadBookings();
        await this.loadSchedules();
        await this.calculateStats();

        console.log('✅ Dashboard data loaded');
    }

    async loadCamps() {
        try {
            console.log('🏕️ Loading camps for organization...');

            const { data, error } = await this.supabase
                .from('camps')
                .select('*')
                .eq('organization_id', this.currentOrganization.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('⚠️ Camps loading error:', error);
                this.camps = [];
                return;
            }

            this.camps = data || [];
            console.log('✅ Camps loaded:', this.camps.length);

        } catch (error) {
            console.warn('⚠️ Exception loading camps:', error);
            this.camps = [];
        }
    }

    async loadBookings() {
        try {
            console.log('📋 Loading bookings for organization...');

            const { data, error } = await this.supabase
                .from('bookings')
                .select(`
                    *,
                    child_profiles!inner(first_name, last_name),
                    camps!inner(name)
                `)
                .eq('organization_id', this.currentOrganization.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.warn('⚠️ Bookings query failed, trying simple query:', error);

                const { data: simpleData, error: simpleError } = await this.supabase
                    .from('bookings')
                    .select('*')
                    .eq('organization_id', this.currentOrganization.id)
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
            console.warn('⚠️ Exception loading bookings:', error);
            this.bookings = [];
        }
    }

    async loadSchedules() {
        try {
            console.log('📅 Loading schedules...');

            if (this.camps.length === 0) {
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
            console.warn('⚠️ Exception loading schedules:', error);
            this.schedules = [];
        }
    }

    async calculateStats() {
        try {
            const activeSchedules = this.schedules?.filter(schedule => {
                const now = new Date();
                const endDate = new Date(schedule.end_date);
                return endDate >= now;
            }).length || 0;

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

    renderDashboard() {
        console.log('🎨 Rendering organization dashboard...');

        this.renderOrganizationHeader();
        this.renderStats();
        this.renderCamps();
        this.renderRecentBookings();

        console.log('✅ Dashboard rendered');
    }

    renderOrganizationHeader() {
        // Update page header with organization info
        const pageHeader = document.querySelector('.page-header h1');
        if (pageHeader) {
            pageHeader.textContent = `🏢 ${this.currentOrganization.name} Dashboard`;
        }

        const pageSubtitle = document.querySelector('.page-header p');
        if (pageSubtitle) {
            pageSubtitle.textContent = `Manage camps and registrations for ${this.currentOrganization.name}`;
        }
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
                    <p>No camps created yet for ${this.currentOrganization.name}</p>
                    <button class="btn btn-primary" onclick="showAddCamp()">Add Your First Camp</button>
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
                    <p>No registrations yet</p>
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
                    <small>Registered: ${new Date(booking.created_at).toLocaleDateString()}</small>
                </div>
                <div class="booking-amount">
                    $${parseFloat(booking.amount || 0).toFixed(2)}
                </div>
            </div>
        `).join('');

        bookingsContainer.innerHTML = bookingsHTML;
    }

    async handleCampSubmit(e) {
        e.preventDefault();
        e.stopPropagation();

        console.log('🏕️ Processing camp form submission for organization:', this.currentOrganization.name);

        try {
            const form = e.target;

            // Include organization_id in camp data
            const campData = {
                organization_id: this.currentOrganization.id, // NEW: Required for organization-based camps
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

            // Handle accommodations
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
                console.error('❌ Error details:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });

                if (error.code === '23505') {
                    this.showError('A camp with this name already exists. Please choose a different name.');
                } else if (error.message.includes('duplicate key')) {
                    this.showError('A camp with this information already exists. Please modify the details.');
                } else {
                    this.showError(`Failed to create camp: ${error.message}`);
                }
                return;
            }

            console.log('✅ Camp created successfully:', data);
            this.showSuccess(`Camp "${data.name}" created successfully for ${this.currentOrganization.name}!`);

            // Refresh dashboard
            await this.loadDashboardData();
            this.renderDashboard();

            // Close modal and reset form
            this.closeModal('addCampModal');
            form.reset();

        } catch (error) {
            console.error('❌ Exception creating camp:', error);
            this.showError('Failed to create camp. Please try again.');
        }
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');

        // Camp form
        const campForm = document.getElementById('campForm');
        if (campForm) {
            campForm.addEventListener('submit', (e) => this.handleCampSubmit(e));
        }

        console.log('✅ Event listeners set up');
    }

    // UI Helper methods (same as before)
    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; float: right; cursor: pointer;">&times;</button>
        `;

        const container = document.querySelector('.container') || document.body;
        container.insertBefore(messageEl, container.firstChild);

        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.remove();
            }
        }, 5000);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

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

function editCamp(campId) {
    console.log('Edit camp:', campId);
    alert('Camp editing coming soon!');
}

function viewCampDetails(campId) {
    console.log('View camp details:', campId);
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
    console.log('🏢 Organization-Aware Camp Dashboard script loaded');
    window.campDashboard = new CampDashboard();
});

if (document.readyState !== 'loading') {
    console.log('🏢 Organization-Aware Camp Dashboard script loaded (DOM already ready)');
    window.campDashboard = new CampDashboard();
}