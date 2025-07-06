// Main application logic
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

            // Set up auth listener
            this.supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN') {
                    this.currentUser = session.user;
                    this.loadUserData();
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

            // Redirect to profile if no profile exists
            setTimeout(async () => {
                await this.loadUserData();
                if (!this.userProfile) {
                    window.location.href = 'profile.html';
                }
            }, 1000);

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

        // Only update if elements exist (we're on the main page)
        if (!navButtons) return;

        if (this.currentUser) {
            // Update navigation for logged-in user
            // Updated navigation for logged-in user
            navButtons.innerHTML = `
            <span style="color: white; margin-right: 1rem;">Welcome, ${this.userProfile?.first_name || this.currentUser.email}!</span>
            <a href="calendar.html" class="btn btn-outline">📅 Calendar</a>
            <a href="profile.html" class="btn btn-outline">👤 Profile</a>
            <button class="btn btn-primary" onclick="kidToCamp.logout()">Sign Out</button>
        `;

            // Update search title based on user type (only if it exists)
            if (searchTitle && this.currentUser.user_metadata?.user_type === 'parent') {
                searchTitle.textContent = '🎯 Find Perfect Camps for Your Children';
            }

        } else {
            // Reset to default for non-logged-in users
            navButtons.innerHTML = `
            <a href="#" class="btn btn-outline" onclick="kidToCamp.ui.openModal('loginModal')">Sign In</a>
            <a href="#" class="btn btn-primary" onclick="kidToCamp.ui.openModal('signupModal')">Get Started</a>
        `;

            if (searchTitle) {
                searchTitle.textContent = '🗓️ Search Camps by Date';
            }
        }

        // Update enhanced filters visibility (only if elements exist)
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

    async logout() {
        try {
            await this.supabase.auth.signOut();

            // Redirect to home page if we're on profile page
            if (window.location.pathname.includes('profile.html')) {
                window.location.href = 'index.html';
            } else {
                // Clear all search data and reset page
                this.clearSearchData();
                this.resetSearchForm();
            }

        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    // Add these methods to KidToCamp class

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

// UI Helper Methods
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

// Search functionality
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

            if (priceRange && priceRange !== '500+') {
                const [minPrice, maxPrice] = priceRange.split('-').map(price => parseInt(price));
                query = query.gte('price', minPrice).lte('price', maxPrice);
            } else if (priceRange === '500+') {
                query = query.gte('price', 500);
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
                        <div class="camp-detail">💰 ${camp.price}</div>
                        <div class="camp-detail">📅 ${camp.duration} days</div>
                    </div>
                    <div class="camp-tags">
                        ${camp.interests?.map(interest => `<span class="tag">${interest}</span>`).join('') || ''}
                        ${camp.accommodations?.map(acc => `<span class="tag accommodation-tag">${acc}</span>`).join('') || ''}
                    </div>
                    <button class="btn btn-primary" onclick="alert('Booking functionality coming soon!')">
                        Book Now
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

// Debug and fix for both calendar and main pages
console.log('🔧 app.js finished executing');
console.log('🔧 kidToCamp created:', !!window.kidToCamp);
console.log('🔧 CONFIG available:', !!window.CONFIG);

// Create CONFIG if it doesn't exist (for non-calendar pages)
if (!window.CONFIG) {
    console.log('🔧 CONFIG missing, creating it...');
    window.CONFIG = {
        supabase: {
            url: 'https://jjrvkntowkmdfbejlnwk.supabase.co',
            key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcnZrbnRvd2ttZGZiZWpsbndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNjc5OTgsImV4cCI6MjA2NTc0Mzk5OH0.Ng0lYJAki_FeJK2_fAR5w95SZJ-7-BHzpkMbNm4uKuM'
        },
        app: {
            name: 'Kid To Camp',
            version: '1.0.0'
        }
    };
    console.log('🔧 CONFIG created');
}

// Force create kidToCamp if it doesn't exist
if (typeof kidToCamp === 'undefined' || !kidToCamp) {
    console.log('🔧 Creating kidToCamp...');
    try {
        kidToCamp = new KidToCamp();
        window.kidToCamp = kidToCamp;
        console.log('🔧 kidToCamp created successfully:', !!window.kidToCamp);
    } catch (error) {
        console.error('🔧 Error creating kidToCamp:', error);
    }
} else {
    window.kidToCamp = kidToCamp;
    console.log('🔧 kidToCamp already exists, assigned to window');
}
