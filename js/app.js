// js/app.js - UPDATED with Smart Routing for User Types

class KidToCamp {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.userProfile = null;
        this.children = [];
        this.init();
    }

    async init() {
        try {
            // Initialize Supabase
            const { createClient } = supabase;
            if (window.supabase && window.supabase.auth) {
                this.supabase = window.supabase;
                console.log('✅ Using existing Supabase client from config.js');
            } else {
                console.error('❌ Supabase client not ready in app.js');
                throw new Error('Supabase client not available');
            }

            // Check for existing session
            const { data: { session } } = await this.supabase.auth.getSession();
            if (session) {
                this.currentUser = session.user;
                await this.loadUserData();
            }

            // Set up auth listener with smart routing
            this.supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN') {
                    this.currentUser = session.user;
                    await this.loadUserData();
                    this.handleSmartRouting(); // NEW: Smart routing based on user type
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.userProfile = null;
                    this.children = [];
                    this.updateUI();
                }
            });

            this.setupEventListeners();
            this.updateUI();

        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    // NEW: Smart routing based on user type
    handleSmartRouting() {
        // Don't redirect if we're already on the correct page
        const currentPath = window.location.pathname;
        const userType = this.currentUser?.user_metadata?.user_type;

        console.log('🔄 Smart routing for user type:', userType);

        // Skip routing if on auth callback pages
        if (currentPath.includes('auth') || currentPath.includes('callback')) {
            return;
        }

        // Route based on user type and current page
        if (userType === 'admin') {
            // Camp owners should go to camp dashboard unless already there
            if (!currentPath.includes('camp-dashboard') &&
                !currentPath.includes('calendar') &&
                !currentPath.includes('bookings')) {
                console.log('🏕️ Redirecting camp owner to dashboard');
                setTimeout(() => {
                    window.location.href = '/camp-dashboard.html';
                }, 1000);
            }
        } else if (userType === 'parent') {
            // Parents should go to profile unless already on a parent page
            if (!currentPath.includes('profile') &&
                !currentPath.includes('calendar') &&
                !currentPath.includes('bookings') &&
                currentPath !== '/' &&
                currentPath !== '/index.html') {
                console.log('👨‍👩‍👧‍👦 Redirecting parent to profile');
                setTimeout(() => {
                    window.location.href = '/profile.html';
                }, 1000);
            }
        }
    }

    setupEventListeners() {
        // Form submissions
        document.getElementById('signupForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('profileForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProfileUpdate();
        });

        document.getElementById('childProfileForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleChildProfile();
        });

        // Child selector change
        document.getElementById('childSelector')?.addEventListener('change', (e) => {
            this.handleChildSelection(e.target.value);
        });

        // Modal close on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.ui.closeModal(e.target.id);
            }
        });
    }

    async handleSignup() {
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const userType = document.getElementById('userType').value;

        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { user_type: userType }
                }
            });

            if (error) throw error;

            this.ui.showMessage('Account created! Please check your email to verify.', 'success');
            this.ui.closeModal('signupModal');

        } catch (error) {
            this.ui.showMessage(error.message, 'error');
        }
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.ui.closeModal('loginModal');

            // Smart routing will be handled by the auth state change listener

        } catch (error) {
            this.ui.showMessage(error.message, 'error');
        }
    }

    async handleProfileUpdate() {
        const profileData = {
            first_name: document.getElementById('firstName').value,
            last_name: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zip: document.getElementById('zip').value
        };

        try {
            const { error } = await this.supabase
                .from('profiles')
                .upsert({
                    id: this.currentUser.id,
                    ...profileData
                });

            if (error) throw error;

            this.userProfile = { ...this.userProfile, ...profileData };
            this.ui.showMessage('Profile updated successfully!', 'success');
            this.ui.closeModal('profileModal');
            this.updateUI();

        } catch (error) {
            this.ui.showMessage(error.message, 'error');
        }
    }

    async handleChildProfile() {
        const childId = document.getElementById('childId').value;
        const isEditing = childId !== '';

        const childData = {
            first_name: document.getElementById('childFirstName').value,
            last_name: document.getElementById('childLastName').value,
            birthdate: document.getElementById('childDob').value,
            interests: Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(cb => cb.value),
            special_needs_list: Array.from(document.querySelectorAll('input[name="accommodations"]:checked')).map(cb => cb.value),
            special_needs: document.getElementById('medicalNotes').value,
            emergency_contact: document.getElementById('emergencyContactName').value,
            emergency_contact_phone: document.getElementById('emergencyContactPhone').value,
            parent_id: this.currentUser.id
        };

        try {
            let result;
            if (isEditing) {
                result = await this.supabase
                    .from('child_profiles')
                    .update(childData)
                    .eq('id', childId);
            } else {
                result = await this.supabase
                    .from('child_profiles')
                    .insert(childData);
            }

            if (result.error) throw result.error;

            await this.loadChildren();
            this.ui.showMessage(`Child profile ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
            this.ui.closeModal('childProfileModal');
            this.updateChildSelector();
            this.updateAutoFilterButtons();

        } catch (error) {
            this.ui.showMessage(error.message, 'error');
        }
    }

    async loadUserData() {
        try {
            // Load user profile
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            this.userProfile = profile;

            // Load children if parent
            if (this.currentUser.user_metadata?.user_type === 'parent') {
                await this.loadChildren();
            }

            this.updateUI();

        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadChildren() {
        try {
            const { data: children } = await this.supabase
                .from('child_profiles')
                .select('*')
                .eq('parent_id', this.currentUser.id);

            this.children = children || [];
            this.updateChildSelector();
            this.updateAutoFilterButtons();

        } catch (error) {
            console.error('Error loading children:', error);
        }
    }

    updateChildSelector() {
        const selector = document.getElementById('childSelector');
        if (!selector) return;

        // Clear existing options except "All Children"
        selector.innerHTML = '<option value="">All Children</option>';

        this.children.forEach(child => {
            const option = document.createElement('option');
            option.value = child.id;
            option.textContent = `${child.first_name} ${child.last_name}`;
            selector.appendChild(option);
        });
    }

    updateAutoFilterButtons() {
        const container = document.getElementById('childFilterButtons');
        const autoFilterDiv = document.getElementById('autoFilterButtons');

        if (!container || !autoFilterDiv) return;

        container.innerHTML = '';

        if (this.children.length > 0) {
            this.children.forEach(child => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'child-filter-btn';
                button.textContent = `${child.first_name}'s Preferences`;
                button.onclick = () => this.applyChildFilters(child);
                container.appendChild(button);
            });
            autoFilterDiv.style.display = 'block';
        } else {
            autoFilterDiv.style.display = 'none';
        }
    }

    applyChildFilters(child) {
        // Set age range based on child's age
        const age = this.calculateAge(child.birthdate);
        const ageSelect = document.getElementById('ageRange');
        if (age >= 3 && age <= 5) ageSelect.value = '3-5';
        else if (age >= 6 && age <= 8) ageSelect.value = '6-8';
        else if (age >= 9 && age <= 12) ageSelect.value = '9-12';
        else if (age >= 13 && age <= 16) ageSelect.value = '13-16';

        // Set interests
        document.querySelectorAll('.interest-grid input[type="checkbox"]').forEach(cb => {
            cb.checked = child.interests?.includes(cb.value) || false;
        });

        // Set accommodations
        document.querySelectorAll('.accommodation-grid input[type="checkbox"]').forEach(cb => {
            cb.checked = child.special_needs_list?.includes(cb.value) || false;
        });

        // Select this child
        document.getElementById('childSelector').value = child.id;

        // Highlight the active button
        document.querySelectorAll('.child-filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        this.ui.showMessage(`Applied ${child.first_name}'s preferences to search filters`, 'success');
    }

    calculateAge(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    }

    handleChildSelection(childId) {
        if (childId) {
            const child = this.children.find(c => c.id === childId);
            if (child) {
                this.applyChildFilters(child);
            }
        }
    }

    updateUI() {
        const navButtons = document.getElementById('navButtons');
        const searchTitle = document.getElementById('searchTitle');
        const heroButtons = document.getElementById('heroButtons');

        // Update navigation if elements exist
        if (navButtons && this.currentUser) {
            const userType = this.currentUser.user_metadata?.user_type;
            const dashboardLink = userType === 'admin' ? 'camp-dashboard.html' : 'profile.html';
            const dashboardText = userType === 'admin' ? '🏕️ Dashboard' : '👤 Profile';

            navButtons.innerHTML = `
                <span style="color: white; margin-right: 1rem;">Welcome, ${this.userProfile?.first_name || this.currentUser.email}!</span>
                <a href="${dashboardLink}" class="btn btn-outline">${dashboardText}</a>
                <a href="calendar.html" class="btn btn-outline">📅 Calendar</a>
                <button class="btn btn-primary" onclick="kidToCamp.logout()">Sign Out</button>
            `;
        }

        // Update search title based on user type
        if (searchTitle && this.currentUser?.user_metadata?.user_type === 'parent') {
            searchTitle.textContent = '🎯 Find Perfect Camps for Your Children';
        } else if (searchTitle) {
            searchTitle.textContent = '🗓️ Search Camps by Date';
        }

        // Update hero buttons based on login status and user type
        this.updateHeroButtons();

        // Update enhanced filters visibility
        const enhancedFilters = document.getElementById('enhancedFilters');
        const advancedToggle = document.getElementById('advancedToggle');

        if (advancedToggle && this.currentUser?.user_metadata?.user_type === 'parent') {
            advancedToggle.textContent = '🎯 Smart Filters';
            if (this.children.length > 0) {
                advancedToggle.style.display = 'block';
            }
        } else if (advancedToggle) {
            advancedToggle.textContent = '🎯 Advanced Filters';
        }
    }

    // UPDATED: Hero content based on user type
    updateHeroButtons() {
        const heroButtons = document.getElementById('heroButtons');
        if (!heroButtons) return;

        if (this.currentUser) {
            // User is logged in - show personalized content based on user type
            const userType = this.currentUser.user_metadata?.user_type;
            const userName = this.userProfile?.first_name || this.currentUser.email.split('@')[0];

            if (userType === 'parent') {
                heroButtons.innerHTML = `
                    <div class="user-card welcome-card">
                        <h3>👋 Welcome back, ${userName}!</h3>
                        <p>Ready to find amazing experiences for your children?</p>
                        <div class="card-features">
                            <div class="feature">✅ ${this.children.length} child profile${this.children.length !== 1 ? 's' : ''}</div>
                            <div class="feature">✅ Smart recommendations ready</div>
                            <div class="feature">✅ Quick booking with saved info</div>
                        </div>
                        <a href="/profile.html" class="btn btn-outline">Manage Children</a>
                    </div>

                    <div class="user-card dashboard-card">
                        <h3>📅 Your Dashboard</h3>
                        <p>View your bookings and upcoming camp adventures</p>
                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <a href="/calendar.html" class="btn btn-outline">📅 Calendar</a>
                            <a href="/bookings.html" class="btn btn-outline">📋 Bookings</a>
                        </div>
                    </div>
                `;
            } else if (userType === 'admin') {
                heroButtons.innerHTML = `
                    <div class="user-card admin-card">
                        <h3>🏕️ Camp Owner Dashboard</h3>
                        <p>Manage your camps and connect with families</p>
                        <div class="card-features">
                            <div class="feature">✅ List and manage camps</div>
                            <div class="feature">✅ View bookings and inquiries</div>
                            <div class="feature">✅ Connect with families</div>
                        </div>
                        <a href="/camp-dashboard.html" class="btn btn-outline">Manage Camps</a>
                    </div>

                    <div class="user-card">
                        <h3>📊 Analytics & Reports</h3>
                        <p>Track your camp performance and bookings</p>
                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <a href="/camp-dashboard.html" class="btn btn-outline">📊 Dashboard</a>
                            <a href="/bookings.html" class="btn btn-outline">📋 Bookings</a>
                        </div>
                    </div>
                `;
            }
        } else {
            // User is NOT logged in - show original signup cards
            heroButtons.innerHTML = `
                <div class="user-card">
                    <h3>👨‍👩‍👧‍👦 For Parents</h3>
                    <p>Create child profiles, get personalized recommendations, and book with auto-filled forms</p>
                    <div class="card-features">
                        <div class="feature">✅ Multiple child profiles</div>
                        <div class="feature">✅ Interest-based matching</div>
                        <div class="feature">✅ Auto-filled registration forms</div>
                    </div>
                    <button class="btn" onclick="kidToCamp.ui.openModal('signupModal', 'parent')">Find Camps</button>
                </div>

                <div class="user-card">
                    <h3>🏕️ For Camp Owners</h3>
                    <p>Promote your camp and connect with families in your community</p>
                    <button class="btn" onclick="kidToCamp.ui.openModal('signupModal', 'admin')">List Your Camp</button>
                </div>
            `;
        }
    }

    async logout() {
        try {
            await this.supabase.auth.signOut();

            // Always redirect to home after logout
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    clearSearchData() {
        // Clear search results
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('show');
        }

        // Clear child selector
        const childSelector = document.getElementById('childSelector');
        if (childSelector) {
            childSelector.innerHTML = '<option value="">All Children</option>';
        }

        // Hide enhanced filters
        const enhancedFilters = document.getElementById('enhancedFilters');
        if (enhancedFilters) {
            enhancedFilters.style.display = 'none';
        }

        // Hide auto filter buttons
        const autoFilterDiv = document.getElementById('autoFilterButtons');
        if (autoFilterDiv) {
            autoFilterDiv.style.display = 'none';
        }
    }

    resetSearchForm() {
        // Reset all form inputs
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        const location = document.getElementById('location');
        const ageRange = document.getElementById('ageRange');
        const priceRange = document.getElementById('priceRange');

        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';
        if (location) location.value = '';
        if (ageRange) ageRange.value = '';
        if (priceRange) priceRange.value = '';

        // Uncheck all interest and accommodation checkboxes
        document.querySelectorAll('.interest-grid input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        document.querySelectorAll('.accommodation-grid input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Remove active state from child filter buttons
        document.querySelectorAll('.child-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
}

// UI Helper Methods (unchanged)
KidToCamp.prototype.ui = {
    openModal(modalId, userType = null) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.style.display = 'block';

        // Pre-fill user type if provided
        if (userType && modalId === 'signupModal') {
            document.getElementById('userType').value = userType;
        }

        // Pre-fill profile form if editing
        if (modalId === 'profileModal' && kidToCamp.userProfile) {
            const profile = kidToCamp.userProfile;
            document.getElementById('firstName').value = profile.first_name || '';
            document.getElementById('lastName').value = profile.last_name || '';
            document.getElementById('phone').value = profile.phone || '';
            document.getElementById('address').value = profile.address || '';
            document.getElementById('city').value = profile.city || '';
            document.getElementById('state').value = profile.state || 'NC';
            document.getElementById('zip').value = profile.zip || '';
        }

        // Reset child profile form
        if (modalId === 'childProfileModal') {
            document.getElementById('childProfileForm').reset();
            document.getElementById('childId').value = '';
            document.getElementById('childModalTitle').textContent = 'Add Child Profile';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    },

    showMessage(message, type = 'info') {
        // Create or get message container
        let container = document.getElementById('messageContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'messageContainer';
            container.className = 'message-container';
            document.body.appendChild(container);
        }

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;

        // Add to container (newest at top)
        container.insertBefore(messageDiv, container.firstChild);

        // Auto-remove after 4 seconds with animation
        setTimeout(() => {
            messageDiv.classList.add('message-exit');
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
                // Remove container if empty
                if (container.children.length === 0) {
                    container.remove();
                }
            }, 300); // Wait for animation
        }, 4000);

        // Limit to max 3 messages at once
        while (container.children.length > 3) {
            container.lastChild.remove();
        }
    },

    toggleAdvancedFilters() {
        const filters = document.getElementById('enhancedFilters');
        const toggle = document.getElementById('advancedToggle');

        if (filters.style.display === 'none') {
            filters.style.display = 'block';
            toggle.textContent = toggle.textContent.includes('Smart') ? '📤 Hide Smart Filters' : '📤 Hide Advanced';
        } else {
            filters.style.display = 'none';
            toggle.textContent = toggle.textContent.includes('Smart') ? '🎯 Smart Filters' : '🎯 Advanced Filters';
        }
    },

    toggleAllInterests(selectAll) {
        document.querySelectorAll('.interest-grid input[type="checkbox"]').forEach(cb => {
            cb.checked = selectAll;
        });
    },

    toggleAllAccommodations(selectAll) {
        document.querySelectorAll('.accommodation-grid input[type="checkbox"]').forEach(cb => {
            cb.checked = selectAll;
        });
    }
};

// Search functionality (unchanged)
KidToCamp.prototype.search = {
    async execute() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const location = document.getElementById('location').value;
        const selectedChild = document.getElementById('childSelector').value;
        const ageRange = document.getElementById('ageRange').value;
        const priceRange = document.getElementById('priceRange').value;

        const interests = Array.from(document.querySelectorAll('.interest-grid input:checked')).map(cb => cb.value);
        const accommodations = Array.from(document.querySelectorAll('.accommodation-grid input:checked')).map(cb => cb.value);

        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '<div class="spinner"></div> Searching for camps...';
        resultsContainer.classList.add('show');

        try {
            // Build query
            let query = kidToCamp.supabase.from('camps').select('*');

            // Apply filters
            if (location) {
                query = query.eq('location', location);
            }

            if (ageRange) {
                const [minAge, maxAge] = ageRange.split('-').map(age => parseInt(age.replace('+', '')));
                query = query.gte('min_age', minAge);
                if (maxAge) {
                    query = query.lte('max_age', maxAge);
                }
            }

            if (interests.length > 0) {
                query = query.overlaps('interests', interests);
            }

            if (accommodations.length > 0) {
                query = query.overlaps('accommodations', accommodations);
            }

            const { data: camps, error } = await query;

            if (error) throw error;

            this.displayResults(camps, selectedChild);

        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = '<div class="error-message">Error searching camps. Please try again.</div>';
        }
    },

    displayResults(camps, selectedChildId = null) {
        const resultsContainer = document.getElementById('searchResults');

        if (!camps || camps.length === 0) {
            resultsContainer.innerHTML = '<div class="info-message">No camps found matching your criteria. Try adjusting your filters.</div>';
            return;
        }

        let selectedChild = null;
        if (selectedChildId) {
            selectedChild = kidToCamp.children.find(c => c.id === selectedChildId);
        }

        const resultsHTML = camps.map(camp => {
            let matchScore = 0;
            let matchReasons = [];

            // Calculate match score if child is selected
            if (selectedChild) {
                const childAge = kidToCamp.calculateAge(selectedChild.birthdate);

                // Age match
                if (childAge >= camp.min_age && childAge <= camp.max_age) {
                    matchScore += 30;
                    matchReasons.push('✅ Perfect age match');
                }

                // Interest match
                const interestMatches = selectedChild.interests?.filter(interest =>
                    camp.interests?.includes(interest)) || [];
                if (interestMatches.length > 0) {
                    matchScore += interestMatches.length * 15;
                    matchReasons.push(`✅ Matches ${interestMatches.length} interest(s)`);
                }

                // Accommodation match
                const accommodationMatches = selectedChild.special_needs_list?.filter(acc =>
                    camp.accommodations?.includes(acc)) || [];
                if (accommodationMatches.length > 0) {
                    matchScore += accommodationMatches.length * 20;
                    matchReasons.push(`✅ Provides needed accommodations`);
                }
            }

            const matchBadge = selectedChild ?
                `<div style="background: ${matchScore >= 50 ? '#4CAF50' : matchScore >= 30 ? '#FF9800' : '#f44336'}; 
                     color: white; padding: 0.5rem; border-radius: 8px; margin-bottom: 1rem; font-weight: bold;">
                    ${matchScore}% Match for ${selectedChild.first_name}
                    ${matchReasons.length > 0 ? '<br><small>' + matchReasons.join(', ') + '</small>' : ''}
                 </div>` : '';

            return `
                <div class="camp-card">
                    ${matchBadge}
                    <h4>${camp.name}</h4>
                    <p>${camp.description}</p>
                    <div class="camp-details">
                        <div class="camp-detail">📍 ${camp.location}</div>
                        <div class="camp-detail">👶 Ages ${camp.min_age}-${camp.max_age}</div>
                    </div>
                    <div class="camp-tags">
                        ${camp.interests?.map(interest => `<span class="tag">${interest}</span>`).join('') || ''}
                        ${camp.accommodations?.map(acc => `<span class="tag accommodation-tag">${acc}</span>`).join('') || ''}
                    </div>
                    <button class="btn btn-primary" onclick="alert('Visit the calendar page to book this camp!')">
                        View Schedules
                    </button>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = `
            <h3>Found ${camps.length} camps${selectedChild ? ` for ${selectedChild.first_name}` : ''}</h3>
            ${resultsHTML}
        `;
    }
};

// Initialize the app
let kidToCamp;
document.addEventListener('DOMContentLoaded', () => {
    kidToCamp = new KidToCamp();
});

// Make KidToCamp globally available for inline event handlers
window.KidToCamp = KidToCamp;

// Camp Carousel functionality (unchanged)
class CampCarousel {
    constructor() {
        this.camps = [];
        this.currentIndex = 0;
        this.carouselTrack = null;
        this.dotsContainer = null;
        this.autoAdvanceTimer = null;
        this.autoAdvanceDelay = 5000;
        this.isUserInteracting = false;
        this.init();
    }

    async init() {
        this.carouselTrack = document.getElementById('carouselTrack');
        this.dotsContainer = document.getElementById('carouselDots');

        if (!this.carouselTrack || !this.dotsContainer) return;

        await this.waitForKidToCamp();
        await this.loadCamps();
        this.renderCarousel();
        this.startAutoAdvance();
        this.setupNavigation();
    }

    async waitForKidToCamp() {
        let attempts = 0;
        while (!window.kidToCamp?.supabase && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
    }

    async loadCamps() {
        try {
            if (!window.kidToCamp?.supabase) {
                this.loadDemoCamps();
                return;
            }

            const { data: camps, error } = await window.kidToCamp.supabase
                .from('camps')
                .select('*')
                .limit(8);

            if (error) throw error;

            this.camps = camps || [];

            if (this.camps.length === 0) {
                this.loadDemoCamps();
            }

        } catch (error) {
            console.error('Error loading camps for carousel:', error);
            this.loadDemoCamps();
        }
    }

    loadDemoCamps() {
        this.camps = [
            {
                id: 1,
                name: "Adventure Quest Summer Camp",
                description: "Outdoor adventures, hiking, and nature exploration for young adventurers.",
                location: "Matthews, NC",
                min_age: 6,
                max_age: 12,
                interests: ["nature", "sports"],
                badge: "featured"
            },
            {
                id: 2,
                name: "Tech Innovators Academy",
                description: "Learn coding, robotics, and digital creativity in our state-of-the-art facility.",
                location: "Charlotte, NC",
                min_age: 8,
                max_age: 16,
                interests: ["stem", "academic"],
                badge: "new"
            },
            {
                id: 3,
                name: "Creative Arts Studio",
                description: "Painting, sculpting, and mixed media art for budding young artists.",
                location: "Huntersville, NC",
                min_age: 5,
                max_age: 14,
                interests: ["arts"],
                badge: "popular"
            }
        ];
    }

    renderCarousel() {
        if (!this.carouselTrack || this.camps.length === 0) return;

        this.carouselTrack.innerHTML = this.camps.map((camp, index) =>
            this.createCampCard(camp, index)
        ).join('');

        this.renderDots();
        this.showCamp(0);
    }

    renderDots() {
        this.dotsContainer.innerHTML = this.camps.map((_, index) =>
            `<button class="carousel-dot ${index === 0 ? 'active' : ''}" 
                     onclick="campCarousel.goToSlide(${index})" 
                     aria-label="Go to camp ${index + 1}"></button>`
        ).join('');
    }

    createCampCard(camp, index) {
        const interests = camp.interests?.slice(0, 3) || [];
        const badgeClass = camp.badge || 'featured';
        const badgeText = {
            'featured': '⭐ Featured',
            'new': '🆕 New',
            'popular': '🔥 Popular'
        }[badgeClass] || '⭐ Featured';

        return `
            <div class="carousel-camp-card" data-index="${index}" onclick="campCarousel.handleCampClick(${camp.id})">
                <div class="camp-card-content">
                    <div class="camp-badge ${badgeClass}">${badgeText}</div>
                    <h3>${camp.name}</h3>
                    <p class="camp-description">${camp.description}</p>
                    
                    <div class="camp-details-mini">
                        <div class="detail-mini">
                            <span class="detail-icon">📍</span>
                            <span>${camp.location}</span>
                        </div>
                        <div class="detail-mini">
                            <span class="detail-icon">👶</span>
                            <span>Ages ${camp.min_age}-${camp.max_age}</span>
                        </div>
                    </div>
                    
                    <div class="camp-tags">
                        ${interests.map(interest => `<span class="interest-tag">${interest}</span>`).join('')}
                    </div>
                    
                    <button class="camp-cta-btn" onclick="event.stopPropagation(); campCarousel.handleBookClick(${camp.id})">
                        Learn More
                    </button>
                </div>
            </div>
        `;
    }

    setupNavigation() {
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousSlide());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextSlide());
        }

        const carouselContainer = document.querySelector('.featured-camps-carousel');
        if (carouselContainer) {
            carouselContainer.addEventListener('mouseenter', () => this.pauseAutoAdvance());
            carouselContainer.addEventListener('mouseleave', () => this.resumeAutoAdvance());
        }
    }

    goToSlide(index) {
        this.isUserInteracting = true;
        this.showCamp(index);
        this.restartAutoAdvance();

        setTimeout(() => {
            this.isUserInteracting = false;
        }, 1000);
    }

    showCamp(index) {
        if (index < 0 || index >= this.camps.length) return;

        this.currentIndex = index;

        const cardWidth = 33.333;
        const offset = -(index * cardWidth) + cardWidth;

        this.carouselTrack.style.transform = `translateX(${offset}%)`;

        this.updateCardStates();
        this.updateDots();
    }

    updateCardStates() {
        const cards = document.querySelectorAll('.carousel-camp-card');

        cards.forEach((card, index) => {
            card.classList.remove('center', 'side');

            if (index === this.currentIndex) {
                card.classList.add('center');
            } else {
                card.classList.add('side');
            }
        });
    }

    updateDots() {
        document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentIndex);
        });
    }

    nextSlide() {
        const nextIndex = (this.currentIndex + 1) % this.camps.length;
        this.goToSlide(nextIndex);
    }

    previousSlide() {
        const prevIndex = (this.currentIndex - 1 + this.camps.length) % this.camps.length;
        this.goToSlide(prevIndex);
    }

    startAutoAdvance() {
        this.autoAdvanceTimer = setInterval(() => {
            if (!this.isUserInteracting) {
                this.nextSlide();
            }
        }, this.autoAdvanceDelay);
    }

    pauseAutoAdvance() {
        if (this.autoAdvanceTimer) {
            clearInterval(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
    }

    resumeAutoAdvance() {
        if (!this.autoAdvanceTimer) {
            this.startAutoAdvance();
        }
    }

    restartAutoAdvance() {
        this.pauseAutoAdvance();
        this.startAutoAdvance();
    }

    handleCampClick(campId) {
        this.pauseAutoAdvance();
        const camp = this.camps.find(c => c.id === campId);
        if (camp) {
            alert(`🏕️ ${camp.name}\n\n📍 ${camp.location}\n👶 Ages ${camp.min_age}-${camp.max_age}\n\nVisit our calendar page to see available dates and book!`);
        }
        this.resumeAutoAdvance();
    }

    handleBookClick(campId) {
        this.pauseAutoAdvance();
        window.location.href = '/calendar.html';
    }
}

// Initialize carousel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.campCarousel = new CampCarousel();
});

console.log('✅ Enhanced app.js with smart routing loaded');