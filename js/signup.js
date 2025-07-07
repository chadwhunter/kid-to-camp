// js/signup.js - Complete Signup Page Handler

class SignupHandler {
    constructor() {
        this.supabase = null;
        this.isLoading = false;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing signup handler...');
        await this.waitForSupabase();

        if (!this.supabase) {
            console.error('❌ Supabase not available for signup');
            this.showError('Authentication service not available. Please refresh the page.');
            return;
        }

        console.log('✅ Signup handler ready');
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    async waitForSupabase() {
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
        console.error('❌ Supabase client not available after waiting');
    }

    async checkExistingAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.error('❌ Error checking existing session:', error);
                return;
            }

            if (session && session.user) {
                console.log('👤 User already logged in, redirecting...');
                const userType = session.user.user_metadata?.user_type;
                if (userType === 'admin') {
                    window.location.href = '/camp-owner-portal.html';
                } else {
                    window.location.href = '/profile.html';
                }
            }
        } catch (error) {
            console.error('❌ Auth check error:', error);
        }
    }

    setupEventListeners() {
        // Form submission
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEmailSignup();
            });
        }

        // Social signup buttons (reuse social login methods)
        this.setupSocialButtons();

        // Enhanced auth state listener
        this.setupAuthListener();
    }

    setupSocialButtons() {
        // Google signup
        const googleBtn = document.getElementById('googleSignupBtn');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.handleSocialSignup('google'));
        }

        // Facebook signup
        const facebookBtn = document.getElementById('facebookSignupBtn');
        if (facebookBtn) {
            facebookBtn.addEventListener('click', () => this.handleSocialSignup('facebook'));
        }
    }

    setupAuthListener() {
        if (!this.supabase || !this.supabase.auth) {
            console.warn('⚠️ Cannot setup auth listener - Supabase not ready');
            return;
        }

        this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔄 Auth state changed:', event);

            if (event === 'SIGNED_UP' || (event === 'SIGNED_IN' && session)) {
                console.log('✅ Signup/signin successful');

                // Check user type and redirect appropriately
                const userType = session.user.user_metadata?.user_type;

                this.showSuccess('Account ready! Redirecting...');

                setTimeout(() => {
                    if (userType === 'admin') {
                        window.location.href = '/camp-owner-portal.html';
                    } else {
                        window.location.href = '/profile.html';
                    }
                }, 2000);
            }
        });
    }

    async handleSocialSignup(provider) {
        if (this.isLoading) return;

        console.log(`🔐 Starting ${provider} OAuth signup...`);
        this.setSocialLoading(provider, true);
        this.clearMessages();

        try {
            const options = this.getProviderOptions(provider);

            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: provider,
                options: options
            });

            if (error) {
                console.error(`❌ ${provider} signup error:`, error);
                this.showError(`${provider} signup failed. Please try again.`);
                this.setSocialLoading(provider, false);
                return;
            }

            console.log(`✅ ${provider} OAuth initiated`);
            // Don't set loading to false - user is being redirected

        } catch (error) {
            console.error(`❌ ${provider} signup failed:`, error);
            this.showError(`${provider} signup failed. Please try again.`);
            this.setSocialLoading(provider, false);
        }
    }

    getProviderOptions(provider) {
        const baseOptions = {
            redirectTo: window.location.origin + '/auth/callback',
        };

        switch (provider) {
            case 'google':
                return {
                    ...baseOptions,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                        scope: [
                            'openid',
                            'email',
                            'profile',
                            'https://www.googleapis.com/auth/user.addresses.read',
                            'https://www.googleapis.com/auth/user.birthday.read',
                            'https://www.googleapis.com/auth/user.phonenumbers.read',
                            'https://www.googleapis.com/auth/calendar.readonly'
                        ].join(' ')
                    },
                };

            case 'facebook':
                return {
                    ...baseOptions,
                    queryParams: {
                        scope: 'email,public_profile,user_location'
                    }
                };

            default:
                return baseOptions;
        }
    }

    async handleEmailSignup() {
        if (this.isLoading) return;

        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const userType = document.getElementById('userType').value;

        // Validation
        if (!email || !password || !confirmPassword || !userType) {
            this.showError('Please fill in all fields');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        this.setEmailLoading(true);
        this.clearMessages();

        try {
            console.log('📧 Attempting email signup for:', email, 'as:', userType);

            // Step 1: Sign up the user
            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        user_type: userType,
                        email: email // Include email in metadata
                    }
                }
            });

            if (error) {
                console.error('❌ Email signup error:', error);
                this.showError(this.getErrorMessage(error));
                this.setEmailLoading(false);
                return;
            }

            console.log('✅ Email signup successful:', data);

            // Step 2: Create profile entry if user was created
            if (data.user && data.session) {
                console.log('👤 Creating profile for new user');
                await this.createUserProfile(data.user, userType);
            }

            if (data.user && !data.session) {
                // Email confirmation required
                this.showSuccess('Account created! Please check your email and click the confirmation link to activate your account.');
            } else {
                // Auto-signed in, redirect based on user type
                this.showSuccess('Account created successfully! Redirecting...');
                setTimeout(() => {
                    if (userType === 'admin') {
                        window.location.href = '/camp-owner-portal.html';
                    } else {
                        window.location.href = '/profile.html';
                    }
                }, 2000);
            }

            this.setEmailLoading(false);

        } catch (error) {
            console.error('❌ Email signup failed:', error);
            this.showError('Signup failed. Please try again.');
            this.setEmailLoading(false);
        }
    }

    // New method to create user profile
    async createUserProfile(user, userType) {
        try {
            console.log('📝 Creating profile for user:', user.id);

            const profileData = {
                id: user.id,
                email: user.email,
                user_type: userType,
                created_at: new Date().toISOString()
            };

            // For camp owners, add some default organization fields
            if (userType === 'admin') {
                profileData.organization_name = null; // Will be filled in later
                profileData.notify_new_registration = true;
                profileData.notify_cancellation = true;
                profileData.notify_waitlist = true;
                profileData.notify_capacity_warning = true;
                profileData.advance_notice_days = 7;
                profileData.refund_percentage = 100;
            }

            const { error: profileError } = await this.supabase
                .from('profiles')
                .insert(profileData);

            if (profileError) {
                console.error('⚠️ Error creating profile:', profileError);
                // Don't fail the signup process, profile can be created later
            } else {
                console.log('✅ Profile created successfully');
            }

        } catch (error) {
            console.error('⚠️ Profile creation failed:', error);
            // Don't fail the signup process
        }
    }

    setSocialLoading(provider, loading) {
        this.isLoading = loading;
        const btn = document.getElementById(`${provider}SignupBtn`);

        if (!btn) return;

        if (loading) {
            btn.disabled = true;
            const originalText = btn.querySelector('span').textContent;
            btn.querySelector('span').textContent = `Connecting to ${provider.charAt(0).toUpperCase() + provider.slice(1)}...`;
            btn.setAttribute('data-original-text', originalText);
        } else {
            btn.disabled = false;
            const originalText = btn.getAttribute('data-original-text');
            if (originalText) {
                btn.querySelector('span').textContent = originalText;
            }
        }
    }

    setEmailLoading(loading) {
        this.isLoading = loading;
        const signupBtn = document.getElementById('signupBtn');
        const signupForm = document.getElementById('signupForm');
        const signupLoading = document.getElementById('signupLoading');

        if (loading) {
            if (signupBtn) {
                signupBtn.disabled = true;
                signupBtn.textContent = 'Creating Account...';
            }
            if (signupForm) signupForm.style.opacity = '0.7';
            if (signupLoading) signupLoading.style.display = 'block';
        } else {
            if (signupBtn) {
                signupBtn.disabled = false;
                signupBtn.textContent = 'Create Account';
            }
            if (signupForm) signupForm.style.opacity = '1';
            if (signupLoading) signupLoading.style.display = 'none';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('signupError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        const successDiv = document.getElementById('signupSuccess');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }
    }

    clearMessages() {
        const errorDiv = document.getElementById('signupError');
        const successDiv = document.getElementById('signupSuccess');

        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    getErrorMessage(error) {
        console.log('🔍 Error details:', error);

        switch (error.message) {
            case 'User already registered':
                return 'An account with this email already exists. Please sign in instead.';
            case 'Password should be at least 6 characters':
                return 'Password must be at least 6 characters long.';
            case 'Invalid email':
                return 'Please enter a valid email address.';
            case 'Signup disabled':
                return 'Account creation is currently disabled. Please contact support.';
            default:
                return error.message || 'Signup failed. Please try again.';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('🚀 Initializing signup handler...');
        window.signupHandler = new SignupHandler();
    }, 100);
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SignupHandler;
}