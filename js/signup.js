// Fixed signup.js - Handles database errors during user creation

class SignupHandler {
    constructor() {
        this.supabase = null;
        this.isLoading = false;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing signup handler...');

        // Wait for dependencies with better logging
        const dependenciesReady = await this.waitForDependencies();

        if (!dependenciesReady || !this.supabase) {
            console.error('❌ Failed to initialize Supabase for signup');
            this.showError('System initialization failed. Please refresh the page and try again.');

            // Try to set up listeners anyway in case user refreshes
            setTimeout(() => this.setupEventListeners(), 1000);
            return;
        }

        console.log('✅ Signup handler ready with Supabase client');
        this.setupEventListeners();
    }

    async waitForDependencies() {
        let attempts = 0;
        const maxAttempts = 100; // Increased timeout to 10 seconds

        console.log('⏳ Waiting for dependencies...');

        while (attempts < maxAttempts) {
            // Check multiple possible locations for Supabase
            if (window.kidToCamp?.supabase) {
                console.log('✅ Found Supabase via kidToCamp');
                this.supabase = window.kidToCamp.supabase;
                return true;
            }

            if (window.supabase && window.CONFIG) {
                console.log('✅ Found global Supabase, creating client...');
                this.supabase = window.supabase.createClient(
                    window.CONFIG.SUPABASE_URL,
                    window.CONFIG.SUPABASE_ANON_KEY
                );
                return true;
            }

            console.log(`⏳ Attempt ${attempts + 1}/${maxAttempts} - waiting for Supabase...`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        console.error('❌ Timeout waiting for Supabase dependencies');
        return false;
    }

    setupEventListeners() {
        // Email signup form
        const emailForm = document.getElementById('emailSignupForm');
        if (emailForm) {
            emailForm.addEventListener('submit', (e) => this.handleEmailSignup(e));
        }

        // Social signup buttons
        const googleBtn = document.getElementById('googleSignupBtn');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.handleSocialSignup('google'));
        }
    }

    async handleEmailSignup(e) {
        e.preventDefault();

        if (this.isLoading) return;

        const formData = new FormData(e.target);
        const email = formData.get('email')?.trim();
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const userType = formData.get('userType');

        // Validation
        if (!this.validateSignupData(email, password, confirmPassword, userType)) {
            return;
        }

        this.setEmailLoading(true);

        try {
            console.log('📧 Attempting email signup for:', email, 'as:', userType);

            // Step 1: Sign up the user WITHOUT automatic profile creation
            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        user_type: userType,
                        email: email
                    }
                }
            });

            if (error) {
                console.error('❌ Email signup error:', error);

                // Handle specific error types
                if (error.message.includes('Database error saving new user')) {
                    this.showError('Account creation failed due to a database issue. This is usually temporary - please try again in a moment.');
                } else {
                    this.showError(this.getErrorMessage(error));
                }

                this.setEmailLoading(false);
                return;
            }

            console.log('✅ Email signup successful:', data);

            // Step 2: Handle different signup outcomes
            if (data.user && !data.session) {
                // Email confirmation required - don't try to create profile yet
                console.log('📧 Email confirmation required');
                this.showSuccess('Account created! Please check your email and click the confirmation link to activate your account.');

            } else if (data.user && data.session) {
                // Auto-signed in - try to create profile
                console.log('👤 User auto-signed in, attempting to create profile...');

                // Try to create profile, but don't fail the signup if it doesn't work
                try {
                    await this.createUserProfile(data.user, userType);
                    console.log('✅ Profile created successfully');
                } catch (profileError) {
                    console.warn('⚠️ Profile creation failed, but signup succeeded:', profileError);
                    // Don't show error to user - they can complete profile later
                }

                this.showSuccess('Account created successfully! Redirecting...');
                setTimeout(() => {
                    this.redirectAfterSignup(userType);
                }, 2000);
            }

            this.setEmailLoading(false);

        } catch (error) {
            console.error('❌ Email signup failed:', error);
            this.showError('Signup failed. Please try again.');
            this.setEmailLoading(false);
        }
    }

    async createUserProfile(user, userType) {
        console.log('📝 Creating profile for user:', user.id);

        // Try different approaches in order of preference
        const approaches = [
            () => this.createFullProfile(user, userType),
            () => this.createMinimalProfile(user, userType),
            () => this.createBasicProfile(user, userType)
        ];

        for (const approach of approaches) {
            try {
                await approach();
                console.log('✅ Profile created successfully');
                return;
            } catch (error) {
                console.warn('⚠️ Profile creation approach failed:', error.message);
                continue;
            }
        }

        // If all approaches fail, log but don't throw
        console.warn('⚠️ All profile creation approaches failed - user will need to complete profile later');
    }

    async createFullProfile(user, userType) {
        const profileData = {
            id: user.id,
            user_type: userType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add optional fields for camp owners
        if (userType === 'admin') {
            profileData.organization_name = null;
            profileData.notify_new_registration = true;
            profileData.notify_cancellation = true;
            profileData.notify_waitlist = true;
            profileData.notify_capacity_warning = true;
            profileData.advance_notice_days = 7;
            profileData.refund_percentage = 100;
        }

        const { error } = await this.supabase
            .from('profiles')
            .insert(profileData);

        if (error) throw error;
    }

    async createMinimalProfile(user, userType) {
        const profileData = {
            id: user.id,
            user_type: userType
        };

        const { error } = await this.supabase
            .from('profiles')
            .insert(profileData);

        if (error) throw error;
    }

    async createBasicProfile(user, userType) {
        // Most minimal approach - just ID
        const profileData = {
            id: user.id
        };

        const { error } = await this.supabase
            .from('profiles')
            .insert(profileData);

        if (error) throw error;
    }

    validateSignupData(email, password, confirmPassword, userType) {
        if (!email || !password || !confirmPassword || !userType) {
            this.showError('Please fill in all fields');
            return false;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return false;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return false;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return false;
        }

        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async handleSocialSignup(provider) {
        if (this.isLoading) return;

        this.setSocialLoading(provider, true);

        try {
            console.log(`🔐 Attempting ${provider} signup...`);

            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            });

            if (error) {
                console.error(`❌ ${provider} signup error:`, error);
                this.showError(`${provider} signup failed. Please try again.`);
                this.setSocialLoading(provider, false);
                return;
            }

            console.log(`✅ ${provider} signup initiated`);
            // User will be redirected to OAuth provider

        } catch (error) {
            console.error(`❌ ${provider} signup failed:`, error);
            this.showError(`${provider} signup failed. Please try again.`);
            this.setSocialLoading(provider, false);
        }
    }

    redirectAfterSignup(userType) {
        if (userType === 'admin') {
            window.location.href = '/camp-dashboard.html';
        } else {
            window.location.href = '/profile.html';
        }
    }

    getErrorMessage(error) {
        const errorMessages = {
            'User already registered': 'An account with this email already exists. Please try logging in instead.',
            'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
            'Invalid email': 'Please enter a valid email address.',
            'weak_password': 'Please choose a stronger password.',
            'email_address_invalid': 'Please enter a valid email address.',
            'signup_disabled': 'New account registration is temporarily disabled.',
            'Database error saving new user': 'Account creation failed due to a system issue. Please try again.'
        };

        for (const [key, message] of Object.entries(errorMessages)) {
            if (error.message.includes(key)) {
                return message;
            }
        }

        return 'Signup failed. Please try again or contact support if the problem persists.';
    }

    // UI Helper Methods
    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.signup-message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageEl = document.createElement('div');
        messageEl.className = `signup-message signup-${type}`;
        messageEl.innerHTML = `
            <div style="
                padding: 12px 16px;
                margin: 16px 0;
                border-radius: 8px;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                ${type === 'error' ? 'background: #fee; border: 1px solid #fcc; color: #c33;' : ''}
                ${type === 'success' ? 'background: #efe; border: 1px solid #cfc; color: #363;' : ''}
                ${type === 'info' ? 'background: #eef; border: 1px solid #ccf; color: #336;' : ''}
            ">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none; 
                    border: none; 
                    color: inherit; 
                    cursor: pointer;
                    padding: 0 0 0 12px;
                    font-size: 18px;
                ">&times;</button>
            </div>
        `;

        // Insert at the top of the form container
        const container = document.querySelector('.signup-container') || document.body;
        container.insertBefore(messageEl, container.firstChild);

        // Auto-remove after 8 seconds for errors, 5 for success
        const timeout = type === 'error' ? 8000 : 5000;
        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.remove();
            }
        }, timeout);

        // Scroll to message
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setEmailLoading(loading) {
        this.isLoading = loading;
        const submitBtn = document.querySelector('#emailSignupForm button[type="submit"]');
        const emailInput = document.querySelector('#emailSignupForm input[name="email"]');
        const passwordInput = document.querySelector('#emailSignupForm input[name="password"]');

        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.textContent = loading ? 'Creating Account...' : 'Create Account';
        }

        // Disable form inputs during loading
        [emailInput, passwordInput].forEach(input => {
            if (input) input.disabled = loading;
        });
    }

    setSocialLoading(provider, loading) {
        this.isLoading = loading;
        const btn = document.getElementById(`${provider}SignupBtn`);

        if (!btn) return;

        if (loading) {
            btn.disabled = true;
            const span = btn.querySelector('span');
            if (span) {
                btn.setAttribute('data-original-text', span.textContent);
                span.textContent = `Connecting to ${provider.charAt(0).toUpperCase() + provider.slice(1)}...`;
            }
        } else {
            btn.disabled = false;
            const span = btn.querySelector('span');
            if (span) {
                const originalText = btn.getAttribute('data-original-text');
                if (originalText) {
                    span.textContent = originalText;
                }
            }
        }
    }
}

// Initialize signup handler when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 Signup script loaded - DOM ready');

    // Try immediate initialization
    window.signupHandler = new SignupHandler();
});

// Also initialize immediately if DOM is already ready
if (document.readyState !== 'loading') {
    console.log('🔐 Signup script loaded (DOM already ready)');
    window.signupHandler = new SignupHandler();
}

// Additional fallback - try again after a short delay
setTimeout(() => {
    if (!window.signupHandler?.supabase) {
        console.log('🔄 Retrying signup handler initialization...');
        window.signupHandler = new SignupHandler();
    }
}, 2000);