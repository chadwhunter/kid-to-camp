// js/camp-owner-portal.js - Camp Owner Portal Management

class CampOwnerPortal {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.organization = null;
        this.camps = [];
        this.schedules = [];
        this.registrations = [];
        this.teamMembers = [];
        this.currentTab = 'dashboard';
        this.init();
    }

    async init() {
        console.log('🏕️ Initializing Camp Owner Portal...');

        // Wait for dependencies
        await this.waitForDependencies();

        if (!this.supabase) {
            console.error('❌ Camp Owner Portal: Supabase not available');
            this.showError('Authentication service not available. Please refresh the page.');
            return;
        }

        // Check authentication and user type
        await this.checkAuth();

        if (!this.currentUser) {
            console.log('❌ No user found, redirecting to login...');
            window.location.href = '/login.html';
            return;
        }

        // Verify user is camp owner/admin
        if (this.currentUser.user_metadata?.user_type !== 'admin') {
            console.log('❌ User is not a camp owner, redirecting...');
            window.location.href = '/index.html';
            return;
        }

        console.log('✅ Camp Owner Portal ready for:', this.currentUser.email);

        // Load initial data
        await this.loadData();
        this.setupEventListeners();
        this.renderDashboard();
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
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.error('❌ Error getting session:', error);
                return;
            }

            this.currentUser = session?.user;
        } catch (error) {
            console.error('❌ Auth check failed:', error);
        }
    }

    async loadData() {
        try {
            console.log('📊 Loading camp owner data...');

            await Promise.all([
                this.loadOrganization(),
                this.loadCamps(),
                this.loadSchedules(),
                this.loadRegistrations(),
                this.loadTeamMembers()
            ]);

            console.log('✅ Data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading data:', error);
            this.showError('Failed to load portal data');
        }
    }

    async loadOrganization() {
        try {
            // Load organization profile for camp owner
            const { data: org, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }

            this.organization = org;

            // Update header with organization name
            const orgNameElement = document.getElementById('organizationName');
            if (orgNameElement && org?.first_name) {
                orgNameElement.textContent = `Welcome to ${org.first_name}'s Camp Management Portal`;
            }

        } catch (error) {
            console.error('❌ Error loading organization:', error);
        }
    }

    async loadCamps() {
        try {
            const { data: camps, error } = await this.supabase
                .from('camps')
                .select('*')
                .eq('owner_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.camps = camps || [];
            console.log('🏕️ Loaded camps:', this.camps.length);

        } catch (error) {
            console.error('❌ Error loading camps:', error);
            this.camps = [];
        }
    }

    async loadSchedules() {
        try {
            // For now, we'll create a simple query. Later we can join with camps
            const { data: schedules, error } = await this.supabase
                .from('camp_schedules')
                .select('*')
                .order('start_date', { ascending: true });

            if (error) throw error;

            // Filter schedules for camps owned by current user
            this.schedules = schedules?.filter(schedule =>
                this.camps.some(camp => camp.id === schedule.camp_id)
            ) || [];

            console.log('📅 Loaded schedules:', this.schedules.length);

        } catch (error) {
            console.error('❌ Error loading schedules:', error);
            this.schedules = [];
        }
    }

    async loadRegistrations() {
        try {
            // Load registrations for camps owned by this user
            const campIds = this.camps.map(camp => camp.id);

            if (campIds.length === 0) {
                this.registrations = [];
                return;
            }

            const { data: registrations, error } = await this.supabase
                .from('bookings')
                .select('*')
                .in('camp_id', campIds)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Load related data for each registration
            for (let registration of registrations || []) {
                await this.loadRegistrationRelatedData(registration);
            }

            this.registrations = registrations || [];
            console.log('👥 Loaded registrations:', this.registrations.length);

        } catch (error) {
            console.error('❌ Error loading registrations:', error);
            this.registrations = [];
        }
    }

    async loadRegistrationRelatedData(registration) {
        try {
            // Load child info
            if (registration.child_id) {
                const { data: child } = await this.supabase
                    .from('child_profiles')
                    .select('first_name, last_name, birthdate')
                    .eq('id', registration.child_id)
                    .single();
                registration.child = child;
            }

            // Load parent info
            if (registration.parent_id) {
                const { data: parent } = await this.supabase
                    .from('profiles')
                    .select('first_name, last_name, email, phone')
                    .eq('id', registration.parent_id)
                    .single();
                registration.parent = parent;
            }

            // Load camp info
            const camp = this.camps.find(c => c.id === registration.camp_id);
            registration.camp = camp;

            // Load schedule info
            const schedule = this.schedules.find(s => s.id === registration.schedule_id);
            registration.schedule = schedule;

        } catch (error) {
            console.warn('⚠️ Error loading related data for registration:', registration.id, error);
        }
    }

    async loadTeamMembers() {
        try {
            // For now, just return the owner. Later we can implement team invitations
            this.teamMembers = [{
                id: this.currentUser.id,
                name: this.organization?.first_name && this.organization?.last_name
                    ? `${this.organization.first_name} ${this.organization.last_name}`
                    : this.currentUser.email,
                email: this.currentUser.email,
                role: 'Owner',
                status: 'active',
                permissions: ['all']
            }];

            console.log('👨‍💼 Loaded team members:', this.teamMembers.length);

        } catch (error) {
            console.error('❌ Error loading team members:', error);
            this.teamMembers = [];
        }
    }

    setupEventListeners() {
        // Form submissions
        document.getElementById('organizationForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleOrganizationUpdate();
        });

        document.getElementById('policiesForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePoliciesUpdate();
        });

        document.getElementById('notificationForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleNotificationUpdate();
        });

        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
            if (e.target.classList.contains('modal-close')) {
                this.closeModal(e.target.closest('.modal').id);
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal[style*="block"]');
                if (openModal) {
                    this.closeModal(openModal.id);
                }
            }
        });
    }

    // Tab Management
    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active class from all nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }

        // Add active class to clicked nav tab
        event.target.classList.add('active');

        this.currentTab = tabName;

        // Render content for the specific tab
        switch (tabName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'camps':
                this.renderCamps();
                break;
            case 'schedules':
                this.renderSchedules();
                break;
            case 'registrations':
                this.renderRegistrations();
                break;
            case 'team':
                this.renderTeam();
                break;
            case 'forms':
                this.renderForms();
                break;
            case 'jobs':
                this.renderJobs();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    // Dashboard Rendering
    renderDashboard() {
        this.updateStats();
        this.renderRecentActivity();
    }

    updateStats() {
        // Update stat cards
        document.getElementById('totalCamps').textContent = this.camps.length;
        document.getElementById('totalRegistrations').textContent = this.registrations.length;

        // Calculate total revenue (assuming cost field exists in registrations)
        const totalRevenue = this.registrations.reduce((sum, reg) => {
            return sum + (parseFloat(reg.cost) || 0);
        }, 0);
        document.getElementById('totalRevenue').textContent = `$${totalRevenue.toLocaleString()}`;

        // Calculate available spots
        const totalSpots = this.schedules.reduce((sum, schedule) => {
            return sum + (schedule.available_spots || 0);
        }, 0);
        const bookedSpots = this.registrations.filter(reg => reg.status === 'confirmed').length;
        document.getElementById('availableSpots').textContent = Math.max(0, totalSpots - bookedSpots);
    }

    renderRecentActivity() {
        const activityContainer = document.getElementById('recentActivityList');
        if (!activityContainer) return;

        // Create sample recent activity based on registrations
        const recentActivities = [];

        // Recent registrations
        this.registrations.slice(0, 5).forEach(reg => {
            recentActivities.push({
                icon: '👤',
                title: 'New Registration',
                desc: `${reg.child?.first_name || 'A child'} registered for ${reg.camp?.name || 'a camp'}`,
                time: this.formatRelativeTime(reg.created_at)
            });
        });

        if (recentActivities.length === 0) {
            activityContainer.innerHTML = `
                <div class="empty-state">
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        const activitiesHTML = recentActivities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-desc">${activity.desc}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');

        activityContainer.innerHTML = activitiesHTML;
    }

    // Camps Rendering
    renderCamps() {
        const campsContainer = document.getElementById('campsList');
        if (!campsContainer) return;

        if (this.camps.length === 0) {
            campsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No camps created yet</h3>
                    <p>Create your first camp to start accepting registrations</p>
                    <button class="btn btn-primary" onclick="campOwnerPortal.showAddCampModal()">
                        + Create Your First Camp
                    </button>
                </div>
            `;
            return;
        }

        const campsHTML = this.camps.map(camp => {
            const registrationCount = this.registrations.filter(reg => reg.camp_id === camp.id).length;
            const scheduleCount = this.schedules.filter(schedule => schedule.camp_id === camp.id).length;

            return `
                <div class="camp-card">
                    <div class="camp-header">
                        <h3 class="camp-title">${camp.name || 'Untitled Camp'}</h3>
                        <span class="camp-status status-active">Active</span>
                    </div>
                    <p>${camp.description || 'No description provided'}</p>
                    
                    <div class="camp-stats">
                        <div class="camp-stat">
                            <div class="camp-stat-number">${registrationCount}</div>
                            <div class="camp-stat-label">Registrations</div>
                        </div>
                        <div class="camp-stat">
                            <div class="camp-stat-number">${scheduleCount}</div>
                            <div class="camp-stat-label">Schedules</div>
                        </div>
                        <div class="camp-stat">
                            <div class="camp-stat-number">${camp.max_participants || 0}</div>
                            <div class="camp-stat-label">Max Capacity</div>
                        </div>
                    </div>
                    
                    <div class="camp-actions">
                        <button class="btn btn-small btn-primary" onclick="campOwnerPortal.editCamp('${camp.id}')">
                            Edit
                        </button>
                        <button class="btn btn-small btn-outline" onclick="campOwnerPortal.viewCampDetails('${camp.id}')">
                            View Details
                        </button>
                        <button class="btn btn-small btn-outline" onclick="campOwnerPortal.duplicateCamp('${camp.id}')">
                            Duplicate
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        campsContainer.innerHTML = campsHTML;
    }

    // Schedules Rendering
    renderSchedules() {
        const schedulesContainer = document.getElementById('schedulesList');
        if (!schedulesContainer) return;

        if (this.schedules.length === 0) {
            schedulesContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No schedules created yet</h3>
                    <p>Create schedules to make your camps available for registration</p>
                    <button class="btn btn-primary" onclick="campOwnerPortal.showAddScheduleModal()">
                        + Create Your First Schedule
                    </button>
                </div>
            `;
            return;
        }

        const schedulesHTML = this.schedules.map(schedule => {
            const camp = this.camps.find(c => c.id === schedule.camp_id);
            const registrationCount = this.registrations.filter(reg => reg.schedule_id === schedule.id).length;
            const startDate = new Date(schedule.start_date).toLocaleDateString();
            const endDate = new Date(schedule.end_date).toLocaleDateString();

            return `
                <div class="schedule-item">
                    <div class="schedule-header">
                        <h4>${camp?.name || 'Unknown Camp'}</h4>
                        <span class="status-badge status-active">Active</span>
                    </div>
                    
                    <div class="schedule-details">
                        <div class="schedule-detail">
                            📅 <span>${startDate} - ${endDate}</span>
                        </div>
                        <div class="schedule-detail">
                            🕐 <span>${schedule.start_time || 'All day'} - ${schedule.end_time || ''}</span>
                        </div>
                        <div class="schedule-detail">
                            👥 <span>${registrationCount}/${schedule.max_participants || 'Unlimited'} registered</span>
                        </div>
                        <div class="schedule-detail">
                            💰 <span>$${schedule.cost || 0}</span>
                        </div>
                    </div>
                    
                    <div class="camp-actions">
                        <button class="btn btn-small btn-primary" onclick="campOwnerPortal.editSchedule('${schedule.id}')">
                            Edit
                        </button>
                        <button class="btn btn-small btn-outline" onclick="campOwnerPortal.viewScheduleRegistrations('${schedule.id}')">
                            View Registrations
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        schedulesContainer.innerHTML = schedulesHTML;
    }

    // Registrations Rendering
    renderRegistrations() {
        const registrationsContainer = document.getElementById('registrationsList');
        if (!registrationsContainer) return;

        if (this.registrations.length === 0) {
            registrationsContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No registrations yet</h3>
                    <p>Registrations will appear here when families sign up for your camps</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Child Name</th>
                        <th>Parent Contact</th>
                        <th>Camp</th>
                        <th>Schedule</th>
                        <th>Status</th>
                        <th>Registration Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.registrations.map(reg => `
                        <tr>
                            <td>
                                <strong>${reg.child?.first_name || 'Unknown'} ${reg.child?.last_name || ''}</strong>
                                ${reg.child?.birthdate ? `<br><small>Age: ${this.calculateAge(reg.child.birthdate)}</small>` : ''}
                            </td>
                            <td>
                                <strong>${reg.parent?.first_name || ''} ${reg.parent?.last_name || ''}</strong>
                                <br><small>${reg.parent?.email || ''}</small>
                                ${reg.parent?.phone ? `<br><small>${reg.parent.phone}</small>` : ''}
                            </td>
                            <td>${reg.camp?.name || 'Unknown Camp'}</td>
                            <td>
                                ${reg.schedule?.start_date ? new Date(reg.schedule.start_date).toLocaleDateString() : 'TBD'}
                                ${reg.schedule?.start_time ? `<br><small>${reg.schedule.start_time}</small>` : ''}
                            </td>
                            <td>
                                <span class="status-badge status-${reg.status || 'pending'}">${reg.status || 'pending'}</span>
                            </td>
                            <td>${new Date(reg.created_at).toLocaleDateString()}</td>
                            <td>
                                <div class="camp-actions">
                                    <button class="btn btn-small btn-outline" onclick="campOwnerPortal.viewRegistrationDetails('${reg.id}')">
                                        View
                                    </button>
                                    <button class="btn btn-small btn-outline" onclick="campOwnerPortal.contactParent('${reg.parent_id}')">
                                        Contact
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        registrationsContainer.innerHTML = tableHTML;
    }

    // Team Rendering
    renderTeam() {
        const teamContainer = document.getElementById('teamList');
        if (!teamContainer) return;

        const teamHTML = this.teamMembers.map(member => {
            const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();

            return `
                <div class="team-member-card">
                    <div class="member-avatar">${initials}</div>
                    <div class="member-name">${member.name}</div>
                    <div class="member-role">${member.role}</div>
                    <div class="member-actions">
                        ${member.role !== 'Owner' ? `
                            <button class="btn btn-small btn-outline" onclick="campOwnerPortal.editTeamMember('${member.id}')">
                                Edit
                            </button>
                            <button class="btn btn-small btn-danger" onclick="campOwnerPortal.removeTeamMember('${member.id}')">
                                Remove
                            </button>
                        ` : `
                            <button class="btn btn-small btn-outline" onclick="campOwnerPortal.editProfile()">
                                Edit Profile
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        teamContainer.innerHTML = teamHTML;
    }

    // Forms Rendering
    renderForms() {
        const customFormsContainer = document.getElementById('customFormsList');
        if (!customFormsContainer) return;

        // For now, show empty state - we'll implement custom forms later
        customFormsContainer.innerHTML = `
            <div class="empty-state">
                <h4>No custom forms created yet</h4>
                <p>Create custom registration forms to collect specific information for your camps</p>
                <button class="btn btn-outline" onclick="campOwnerPortal.showCreateFormModal()">
                    + Create Custom Form
                </button>
            </div>
        `;
    }

    // Jobs Rendering
    renderJobs() {
        const jobsContainer = document.getElementById('jobsList');
        if (!jobsContainer) return;

        // For now, show empty state - we'll implement job postings later
        jobsContainer.innerHTML = `
            <div class="empty-state">
                <h3>No job postings yet</h3>
                <p>Create job postings to attract camp counselors and staff</p>
                <button class="btn btn-primary" onclick="campOwnerPortal.showCreateJobModal()">
                    + Post Your First Job
                </button>
            </div>
        `;
    }

    // Settings Rendering
    renderSettings() {
        // Pre-fill organization form if data exists
        if (this.organization) {
            document.getElementById('orgName').value = this.organization.first_name || '';
            document.getElementById('orgEmail').value = this.organization.email || this.currentUser.email;
            document.getElementById('orgPhone').value = this.organization.phone || '';
            document.getElementById('orgWebsite').value = this.organization.website || '';
            document.getElementById('orgAddress').value = this.organization.address || '';
            document.getElementById('orgCity').value = this.organization.city || '';
            document.getElementById('orgState').value = this.organization.state || 'NC';
            document.getElementById('orgZip').value = this.organization.zip || '';
        }
    }

    // Modal Management
    showAddCampModal() {
        const modalHTML = `
            <div id="addCampModal" class="modal" style="display: block;">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <h2>Add New Camp</h2>
                    <form id="addCampForm">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Camp Name *</label>
                                <input type="text" id="campName" required>
                            </div>
                            <div class="form-group">
                                <label>Category</label>
                                <select id="campCategory">
                                    <option value="sports">Sports</option>
                                    <option value="arts">Arts & Crafts</option>
                                    <option value="stem">STEM/Science</option>
                                    <option value="nature">Nature/Outdoors</option>
                                    <option value="academic">Academic</option>
                                    <option value="music">Music</option>
                                    <option value="theater">Theater/Drama</option>
                                    <option value="cooking">Cooking</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Description *</label>
                            <textarea id="campDescription" rows="3" required 
                                placeholder="Describe your camp activities, what makes it special..."></textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Location *</label>
                                <input type="text" id="campLocation" required placeholder="e.g., Matthews, NC">
                            </div>
                            <div class="form-group">
                                <label>Address</label>
                                <input type="text" id="campAddress" placeholder="Full address for parents">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Age Range</label>
                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input type="number" id="minAge" placeholder="Min" min="3" max="18" style="width: 80px;">
                                    <span>to</span>
                                    <input type="number" id="maxAge" placeholder="Max" min="3" max="18" style="width: 80px;">
                                    <span>years old</span>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Max Participants</label>
                                <input type="number" id="maxParticipants" min="1" placeholder="e.g., 20">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Interests/Activities (select all that apply)</label>
                            <div class="checkbox-grid">
                                <label class="checkbox-label">
                                    <input type="checkbox" name="interests" value="sports"> Sports
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="interests" value="arts"> Arts & Crafts
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="interests" value="stem"> STEM/Science
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="interests" value="nature"> Nature/Outdoors
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="interests" value="academic"> Academic
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="interests" value="music"> Music
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="interests" value="theater"> Theater/Drama
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="interests" value="cooking"> Cooking
                                </label>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Accommodations Available</label>
                            <div class="checkbox-grid">
                                <label class="checkbox-label">
                                    <input type="checkbox" name="accommodations" value="wheelchair_accessible"> 
                                    Wheelchair accessible
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="accommodations" value="nut_free_environment"> 
                                    Nut-free environment
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="accommodations" value="adhd_support"> 
                                    ADHD support
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="accommodations" value="autism_support"> 
                                    Autism spectrum support
                                </label>
                            </div>
                        </div>
                        
                        <div class="form-buttons">
                            <button type="button" class="btn btn-outline" onclick="campOwnerPortal.closeModal('addCampModal')">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                Create Camp
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('modalContainer').innerHTML = modalHTML;

        // Setup form submission
        document.getElementById('addCampForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddCamp();
        });
    }

    showAddScheduleModal() {
        if (this.camps.length === 0) {
            this.showError('Please create a camp first before adding schedules');
            return;
        }

        const campsOptions = this.camps.map(camp =>
            `<option value="${camp.id}">${camp.name}</option>`
        ).join('');

        const modalHTML = `
            <div id="addScheduleModal" class="modal" style="display: block;">
                <div class="modal-content wide">
                    <span class="modal-close">&times;</span>
                    <h2>Create New Schedule</h2>
                    <form id="addScheduleForm">
                        <div class="form-group">
                            <label>Select Camp *</label>
                            <select id="scheduleCamp" required>
                                <option value="">Choose a camp...</option>
                                ${campsOptions}
                            </select>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Start Date *</label>
                                <input type="date" id="scheduleStartDate" required>
                            </div>
                            <div class="form-group">
                                <label>End Date *</label>
                                <input type="date" id="scheduleEndDate" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Start Time</label>
                                <input type="time" id="scheduleStartTime">
                            </div>
                            <div class="form-group">
                                <label>End Time</label>
                                <input type="time" id="scheduleEndTime">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Cost ($)</label>
                                <input type="number" id="scheduleCost" min="0" step="0.01" placeholder="0.00">
                            </div>
                            <div class="form-group">
                                <label>Max Participants</label>
                                <input type="number" id="scheduleMaxParticipants" min="1" placeholder="20">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Days of Week (if recurring)</label>
                            <div class="checkbox-grid">
                                <label class="checkbox-label">
                                    <input type="checkbox" name="daysOfWeek" value="0"> Sunday
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="daysOfWeek" value="1"> Monday
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="daysOfWeek" value="2"> Tuesday
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="daysOfWeek" value="3"> Wednesday
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="daysOfWeek" value="4"> Thursday
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="daysOfWeek" value="5"> Friday
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="daysOfWeek" value="6"> Saturday
                                </label>
                            </div>
                            <small style="color: #666; margin-top: 0.5rem; display: block;">
                                Leave unchecked if camp runs every day in the date range
                            </small>
                        </div>
                        
                        <div class="form-buttons">
                            <button type="button" class="btn btn-outline" onclick="campOwnerPortal.closeModal('addScheduleModal')">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                Create Schedule
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('modalContainer').innerHTML = modalHTML;

        // Setup form submission
        document.getElementById('addScheduleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddSchedule();
        });
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    }

    // Form Handlers
    async handleAddCamp() {
        const campData = {
            name: document.getElementById('campName').value,
            description: document.getElementById('campDescription').value,
            location: document.getElementById('campLocation').value,
            address: document.getElementById('campAddress').value,
            min_age: parseInt(document.getElementById('minAge').value) || null,
            max_age: parseInt(document.getElementById('maxAge').value) || null,
            max_participants: parseInt(document.getElementById('maxParticipants').value) || null,
            interests: Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(cb => cb.value),
            accommodations: Array.from(document.querySelectorAll('input[name="accommodations"]:checked')).map(cb => cb.value),
            owner_id: this.currentUser.id,
            category: document.getElementById('campCategory').value
        };

        try {
            const { data, error } = await this.supabase
                .from('camps')
                .insert(campData)
                .select()
                .single();

            if (error) throw error;

            this.camps.push(data);
            this.showSuccess('Camp created successfully!');
            this.closeModal('addCampModal');
            this.renderCamps();

        } catch (error) {
            console.error('❌ Error creating camp:', error);
            this.showError('Failed to create camp: ' + error.message);
        }
    }

    async handleAddSchedule() {
        const scheduleData = {
            camp_id: document.getElementById('scheduleCamp').value,
            start_date: document.getElementById('scheduleStartDate').value,
            end_date: document.getElementById('scheduleEndDate').value,
            start_time: document.getElementById('scheduleStartTime').value || null,
            end_time: document.getElementById('scheduleEndTime').value || null,
            cost: parseFloat(document.getElementById('scheduleCost').value) || 0,
            max_participants: parseInt(document.getElementById('scheduleMaxParticipants').value) || null,
            available_spots: parseInt(document.getElementById('scheduleMaxParticipants').value) || null,
            days_of_week: Array.from(document.querySelectorAll('input[name="daysOfWeek"]:checked')).map(cb => parseInt(cb.value))
        };

        // If no days selected, set to null (runs every day)
        if (scheduleData.days_of_week.length === 0) {
            scheduleData.days_of_week = null;
        }

        try {
            const { data, error } = await this.supabase
                .from('camp_schedules')
                .insert(scheduleData)
                .select()
                .single();

            if (error) throw error;

            this.schedules.push(data);
            this.showSuccess('Schedule created successfully!');
            this.closeModal('addScheduleModal');
            this.renderSchedules();

        } catch (error) {
            console.error('❌ Error creating schedule:', error);
            this.showError('Failed to create schedule: ' + error.message);
        }
    }

    async handleOrganizationUpdate() {
        const orgData = {
            first_name: document.getElementById('orgName').value,
            email: document.getElementById('orgEmail').value,
            phone: document.getElementById('orgPhone').value,
            website: document.getElementById('orgWebsite').value,
            address: document.getElementById('orgAddress').value,
            city: document.getElementById('orgCity').value,
            state: document.getElementById('orgState').value,
            zip: document.getElementById('orgZip').value,
            user_type: 'admin'
        };

        try {
            const { error } = await this.supabase
                .from('profiles')
                .upsert({
                    id: this.currentUser.id,
                    ...orgData
                });

            if (error) throw error;

            this.organization = { ...this.organization, ...orgData };
            this.showSuccess('Organization information updated successfully!');

        } catch (error) {
            console.error('❌ Error updating organization:', error);
            this.showError('Failed to update organization information');
        }
    }

    async handlePoliciesUpdate() {
        // For now, we'll store policies in the profiles table
        // Later we might want a separate policies table
        const policiesData = {
            cancellation_policy: document.getElementById('cancellationPolicy').value,
            refund_policy: document.getElementById('refundPolicy').value,
            advance_notice_days: parseInt(document.getElementById('advanceNotice').value) || 7,
            refund_percentage: parseInt(document.getElementById('refundPercentage').value) || 100
        };

        try {
            const { error } = await this.supabase
                .from('profiles')
                .update(policiesData)
                .eq('id', this.currentUser.id);

            if (error) throw error;

            this.showSuccess('Policies updated successfully!');

        } catch (error) {
            console.error('❌ Error updating policies:', error);
            this.showError('Failed to update policies');
        }
    }

    async handleNotificationUpdate() {
        const notificationSettings = {
            notify_new_registration: document.getElementById('emailNewRegistration').checked,
            notify_cancellation: document.getElementById('emailCancellation').checked,
            notify_waitlist: document.getElementById('emailWaitlist').checked,
            notify_capacity_warning: document.getElementById('emailCapacityWarning').checked
        };

        try {
            const { error } = await this.supabase
                .from('profiles')
                .update(notificationSettings)
                .eq('id', this.currentUser.id);

            if (error) throw error;

            this.showSuccess('Notification settings updated successfully!');

        } catch (error) {
            console.error('❌ Error updating notifications:', error);
            this.showError('Failed to update notification settings');
        }
    }

    // Utility Methods
    calculateAge(birthdate) {
        const today = new Date();
        const birth = new Date(birthdate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        return age;
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else {
            return `${diffDays}d ago`;
        }
    }

    showError(message) {
        // Reuse the message system from kidToCamp if available
        if (window.kidToCamp && window.kidToCamp.ui && window.kidToCamp.ui.showMessage) {
            window.kidToCamp.ui.showMessage(message, 'error');
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        // Reuse the message system from kidToCamp if available
        if (window.kidToCamp && window.kidToCamp.ui && window.kidToCamp.ui.showMessage) {
            window.kidToCamp.ui.showMessage(message, 'success');
        } else {
            alert('Success: ' + message);
        }
    }

    // Stub methods for future implementation
    showInviteTeamModal() {
        this.showError('Team invitations feature coming soon!');
    }

    showCreateFormModal() {
        this.showError('Custom forms feature coming soon!');
    }

    showCreateJobModal() {
        this.showError('Job postings feature coming soon!');
    }

    previewStandardForm() {
        this.showError('Form preview feature coming soon!');
    }

    customizeStandardForm() {
        this.showError('Form customization feature coming soon!');
    }

    uploadCustomWaiver() {
        this.showError('Custom waiver upload feature coming soon!');
    }

    exportRegistrations() {
        this.showError('Registration export feature coming soon!');
    }

    sendBulkEmail() {
        this.showError('Bulk email feature coming soon!');
    }

    editCamp(campId) {
        this.showError('Edit camp feature coming soon!');
    }

    viewCampDetails(campId) {
        this.showError('Camp details view coming soon!');
    }

    duplicateCamp(campId) {
        this.showError('Duplicate camp feature coming soon!');
    }

    editSchedule(scheduleId) {
        this.showError('Edit schedule feature coming soon!');
    }

    viewScheduleRegistrations(scheduleId) {
        this.showError('Schedule registrations view coming soon!');
    }

    viewRegistrationDetails(registrationId) {
        this.showError('Registration details view coming soon!');
    }

    contactParent(parentId) {
        this.showError('Contact parent feature coming soon!');
    }

    editTeamMember(memberId) {
        this.showError('Edit team member feature coming soon!');
    }

    removeTeamMember(memberId) {
        this.showError('Remove team member feature coming soon!');
    }

    editProfile() {
        window.location.href = '/profile.html';
    }
}

// Initialize camp owner portal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏕️ Camp Owner Portal script loaded');
    window.campOwnerPortal = new CampOwnerPortal();
});