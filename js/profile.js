// Profile page specific functionality
class ProfilePage {
    constructor() {
        this.isEditing = false;
        this.editingChildId = null;
    }



    async init() {
        // Wait for authentication to be fully initialized
        if (!kidToCamp || !kidToCamp.supabase) {
            // KidToCamp not initialized yet, wait a bit
            setTimeout(() => this.init(), 100);
            return;
        }

        // Check for existing session
        const { data: { session } } = await kidToCamp.supabase.auth.getSession();

        if (!session) {
            // No session, redirect to home
            window.location.href = 'index.html';
            return;
        }

        // Set current user if not already set
        if (!kidToCamp.currentUser) {
            kidToCamp.currentUser = session.user;
        }

        // Load and display user data
        await kidToCamp.loadUserData();
        this.displayProfile();
        this.displayChildren();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Profile form submission
        document.getElementById('profileForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProfileUpdate();
        });

        // Child form submission
        document.getElementById('childProfileForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleChildProfile();
        });
    }

    displayProfile() {
        const profile = kidToCamp.userProfile;
        const user = kidToCamp.currentUser;

        // Display profile information
        document.getElementById('currentEmail').textContent = kidToCamp.currentUser?.email || 'Not set';
        document.getElementById('displayName').textContent =
            profile?.first_name && profile?.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : profile?.first_name || 'Not set';

        document.getElementById('displayEmail').textContent = user?.email || 'Not set';
        document.getElementById('displayPhone').textContent = profile?.phone || 'Not set';
        document.getElementById('displayAddress').textContent = profile?.address || 'Not set';
        document.getElementById('displayCity').textContent = profile?.city || 'Not set';
        document.getElementById('displayState').textContent = profile?.state || 'Not set';
        document.getElementById('displayZip').textContent = profile?.zip || 'Not set';

        // Pre-fill edit form if profile exists
        if (profile) {
            document.getElementById('firstName').value = profile.first_name || '';
            document.getElementById('lastName').value = profile.last_name || '';
            document.getElementById('phone').value = profile.phone || '';
            document.getElementById('address').value = profile.address || '';
            document.getElementById('city').value = profile.city || '';
            document.getElementById('state').value = profile.state || 'NC';
            document.getElementById('zip').value = profile.zip || '';
        }
    }

    displayChildren() {
        const container = document.getElementById('childrenList');

        if (!kidToCamp.children || kidToCamp.children.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
                <h3>No children added yet</h3>
                <p>Add your first child to get personalized camp recommendations!</p>
                <button class="btn btn-primary" onclick="profilePage.showAddChild()">Add Your First Child</button>
            </div>
        `;
            return;
        }

        const childrenHTML = kidToCamp.children.map(child => {
            const age = kidToCamp.calculateAge(child.birthdate);
            const interests = child.interests?.join(', ') || 'None specified';
            const accommodations = child.special_needs_list?.join(', ') || 'None needed';

            return `
            <div class="child-card">
                <div class="child-header">
                    <h3>${child.first_name || ''} ${child.last_name || ''}</h3>
                    <div class="child-actions">
                        <button class="btn btn-small btn-outline" onclick="profilePage.editChild('${child.id}')">
                            Edit
                        </button>
                        <button class="btn btn-small btn-danger" onclick="profilePage.deleteChild('${child.id}', '${child.first_name || 'this child'}')">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="child-details">
                    <div class="child-detail">
                        <strong>Age:</strong> ${age} years old
                    </div>
                    <div class="child-detail">
                        <strong>Birth Date:</strong> ${new Date(child.birthdate).toLocaleDateString()}
                    </div>
                    <div class="child-detail">
                        <strong>Interests:</strong> ${interests}
                    </div>
                    <div class="child-detail">
                        <strong>Accommodations:</strong> ${accommodations}
                    </div>
                    ${child.special_needs ? `
                        <div class="child-detail">
                            <strong>Medical Notes:</strong> ${child.special_needs}
                        </div>
                    ` : ''}
                    ${child.emergency_contact ? `
                        <div class="child-detail">
                            <strong>Emergency Contact:</strong> ${child.emergency_contact}${child.emergency_contact_phone ? ` (${child.emergency_contact_phone})` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('');

        container.innerHTML = childrenHTML;
    }
    async handleProfileUpdate() {
        const profileData = {
            user_type: kidToCamp.currentUser.user_metadata?.user_type || 'parent',
            first_name: document.getElementById('firstName').value,
            last_name: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zip: document.getElementById('zip').value
        };

        try {
            const { error } = await kidToCamp.supabase
                .from('profiles')
                .upsert({
                    id: kidToCamp.currentUser.id,
                    ...profileData
                });

            if (error) throw error;

            kidToCamp.userProfile = { ...kidToCamp.userProfile, ...profileData };
            kidToCamp.ui.showMessage('Profile updated successfully!', 'success');
            this.displayProfile();
            this.toggleProfileEdit();

        } catch (error) {
            kidToCamp.ui.showMessage(error.message, 'error');
        }
    }

    // Add this method to ProfilePage class
    async changeEmail() {
        const newEmailInput = document.getElementById('newEmail');
        const newEmail = newEmailInput.value.trim();
        const currentEmail = kidToCamp.currentUser.email;

        if (!newEmail) {
            kidToCamp.ui.showMessage('Please enter a new email address.', 'error');
            return;
        }

        if (newEmail === currentEmail) {
            kidToCamp.ui.showMessage('This is already your current email address.', 'error');
            return;
        }

        try {
            const { error } = await kidToCamp.supabase.auth.updateUser({
                email: newEmail
            });

            if (error) throw error;

            kidToCamp.ui.showMessage('Verification emails sent! Check both email addresses to confirm the change.', 'success');
            newEmailInput.value = ''; // Clear the input

        } catch (error) {
            kidToCamp.ui.showMessage(error.message, 'error');
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
            parent_id: kidToCamp.currentUser.id
        };

        try {
            let result;
            if (isEditing) {
                result = await kidToCamp.supabase
                    .from('child_profiles')
                    .update(childData)
                    .eq('id', childId);
            } else {
                result = await kidToCamp.supabase
                    .from('child_profiles')
                    .insert(childData);
            }

            if (result.error) throw result.error;

            await kidToCamp.loadChildren();
            kidToCamp.ui.showMessage(`Child profile ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
            this.displayChildren();
            this.cancelAddChild();

        } catch (error) {
            kidToCamp.ui.showMessage(error.message, 'error');
        }
    }

    editChild(childId) {
        const child = kidToCamp.children.find(c => c.id === childId);
        if (!child) return;

        // Fill form with child data
        document.getElementById('childId').value = child.id;
        document.getElementById('childFirstName').value = child.first_name || '';
        document.getElementById('childLastName').value = child.last_name || '';
        document.getElementById('childDob').value = child.birthdate || '';
        document.getElementById('medicalNotes').value = child.special_needs || '';
        document.getElementById('emergencyContactName').value = child.emergency_contact || '';
        document.getElementById('emergencyContactPhone').value = child.emergency_contact_phone || '';

        // Set interests
        document.querySelectorAll('input[name="interests"]').forEach(cb => {
            cb.checked = child.interests?.includes(cb.value) || false;
        });

        // Set accommodations
        document.querySelectorAll('input[name="accommodations"]').forEach(cb => {
            cb.checked = child.special_needs_list?.includes(cb.value) || false;
        });

        // Show form
        document.getElementById('childFormTitle').textContent = `Edit ${child.first_name}'s Profile`;
        document.getElementById('addChildForm').style.display = 'block';
        document.getElementById('addChildForm').scrollIntoView({ behavior: 'smooth' });
    }

    async deleteChild(childId, childName) {
        if (!confirm(`Are you sure you want to delete ${childName}'s profile? This cannot be undone.`)) {
            return;
        }

        try {
            const { error } = await kidToCamp.supabase
                .from('child_profiles')
                .delete()
                .eq('id', childId);

            if (error) throw error;

            await kidToCamp.loadChildren();
            kidToCamp.ui.showMessage(`${childName}'s profile has been deleted.`, 'success');
            this.displayChildren();

        } catch (error) {
            kidToCamp.ui.showMessage(error.message, 'error');
        }
    }

    toggleProfileEdit() {
        const display = document.getElementById('profileDisplay');
        const edit = document.getElementById('profileEdit');
        const btn = document.getElementById('editProfileBtn');

        if (this.isEditing) {
            display.style.display = 'block';
            edit.style.display = 'none';
            btn.textContent = 'Edit Profile';
            this.isEditing = false;
        } else {
            display.style.display = 'none';
            edit.style.display = 'block';
            btn.textContent = 'Cancel Edit';
            this.isEditing = true;
        }
    }

    cancelProfileEdit() {
        this.displayProfile(); // Reset form values
        this.toggleProfileEdit();
    }

    showAddChild() {
        // Reset form
        document.getElementById('childProfileForm').reset();
        document.getElementById('childId').value = '';
        document.getElementById('childFormTitle').textContent = 'Add New Child';

        // Show form
        document.getElementById('addChildForm').style.display = 'block';
        document.getElementById('addChildForm').scrollIntoView({ behavior: 'smooth' });
    }

    cancelAddChild() {
        document.getElementById('addChildForm').style.display = 'none';
        document.getElementById('childProfileForm').reset();
        document.getElementById('childId').value = '';
    }
}

// Initialize profile page when DOM is loaded
let profilePage;

// Wait for both DOM and KidToCamp to be ready
const initProfilePage = async () => {
    // Wait for KidToCamp to be initialized
    if (!window.kidToCamp) {
        setTimeout(initProfilePage, 100);
        return;
    }

    profilePage = new ProfilePage();
    await profilePage.init();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
    initProfilePage();
}

// Make profile UI methods globally available for onclick handlers
window.kidToCamp = window.kidToCamp || {};
window.kidToCamp.ui = window.kidToCamp.ui || {};

// Add profile-specific UI methods
window.kidToCamp.ui.toggleProfileEdit = () => profilePage?.toggleProfileEdit();
window.kidToCamp.ui.cancelProfileEdit = () => profilePage?.cancelProfileEdit();
window.kidToCamp.ui.showAddChild = () => profilePage?.showAddChild();
window.kidToCamp.ui.cancelAddChild = () => profilePage?.cancelAddChild();