// js/login.js - Complete Login Handler with Multi-Provider OAuth

class LoginHandler {
    constructor() {
        this.supabase = null;
        this.isLoading = false;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing enhanced login handler...');
        await this.waitForSupabase();

        if (!this.supabase) {
            console.error('❌ Supabase not available for login');
            this.showError('Authentication service not available. Please refresh the page.');
            return;
        }

        console.log('✅ Enhanced login handler ready');
        this.setupEventListeners();
        this.checkExistingAuth();
        this.handleOAuthCallback();
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

    async handleOAuthCallback() {
        // Check if we're returning from OAuth
        const { data, error } = await this.supabase.auth.getSession();

        if (error) {
            console.error('❌ OAuth callback error:', error);
            this.showError('Authentication failed. Please try again.');
            return;
        }

        if (data.session) {
            console.log('✅ OAuth login successful');

            // Extract user data from session
            const user = data.session.user;
            console.log('👤 User data:', user);

            // Check if we got enhanced profile data
            if (user.user_metadata) {
                console.log('📊 Enhanced profile data available:', user.user_metadata);
                await this.processEnhancedUserData(user);
            }

            this.showSuccess('Login successful! Redirecting...');
            setTimeout(() => {
                this.redirectAfterLogin();
            }, 1000);
        }
    }

    async processEnhancedUserData(user) {
        // This will automatically populate user profile with OAuth data
        const profileData = {
            email: user.email,
            first_name: user.user_metadata.given_name || user.user_metadata.name?.split(' ')[0],
            last_name: user.user_metadata.family_name || user.user_metadata.name?.split(' ').slice(1).join(' '),
            phone: user.user_metadata.phone_number,
            profile_picture: user.user_metadata.picture || user.user_metadata.avatar_url,
            // Address data (if available from Google)
            address: user.user_metadata.address?.street_address,
            city: user.user_metadata.address?.locality,
            state: user.user_metadata.address?.region,
            zip: user.user_metadata.address?.postal_code,
        };

        console.log('🔄 Auto-populating profile with OAuth data:', profileData);

        try {
            // Create or update profile
            const { error } = await this.supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    ...profileData,
                    user_type: 'parent', // Default for OAuth users
                    oauth_provider: user.app_metadata.provider
                });

            if (error) {
                console.warn('⚠️ Could not auto-populate profile:', error);
            } else {
                console.log('✅ Profile auto-populated from OAuth data');
            }
        } catch (error) {
            console.warn('⚠️ Profile auto-population failed:', error);
        }
    }

    setupEventListeners() {
        // Form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEmailLogin();
            });
        }

        // Forgot password
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }

        // Social login buttons
        this.setupSocialButtons();

        // Auth state listener
        if (this.supabase) {
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('🔄 Auth state changed:', event);

                if (event === 'SIGNED_IN' && session) {
                    console.log('✅ Login successful, redirecting...');
                    this.showSuccess('Login successful! Redirecting...');
                    setTimeout(() => {
                        this.redirectAfterLogin();
                    }, 1000);
                }
            });
        }
    }

    setupSocialButtons() {
        // Google login
        const googleBtn = document.getElementById('googleLoginBtn');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.handleSocialLogin('google'));
        }

        // Facebook login
        const facebookBtn = document.getElementById('facebookLoginBtn');
        if (facebookBtn) {
            facebookBtn.addEventListener('click', () => this.handleSocialLogin('facebook'));
        }

        // GitHub login
        const githubBtn = document.getElementById('githubLoginBtn');
        if (githubBtn) {
            githubBtn.addEventListener('click', () => this.handleSocialLogin('github'));
        }
    }

    async handleSocialLogin(provider) {
        if (this.isLoading) return;

        console.log(`🔐 Starting ${provider} OAuth login...`);
        this.setSocialLoading(provider, true);
        this.clearMessages();

        try {
            const options = this.getProviderOptions(provider);

            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: provider,
                options: options
            });

            if (error) {
                console.error(`❌ ${provider} login error:`, error);
                this.showError(`${provider} login failed. Please try again.`);
                this.setSocialLoading(provider, false);
                return;
            }

            console.log(`✅ ${provider} OAuth initiated`);
            // Don't set loading to false - user is being redirected

        } catch (error) {
            console.error(`❌ ${provider} login failed:`, error);
            this.showError(`${provider} login failed. Please try again.`);
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
                        // Enhanced scopes for additional user data
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

            case 'github':
                return {
                    ...baseOptions,
                    queryParams: {
                        scope: 'user:email,read:user'
                    }
                };

            default:
                return baseOptions;
        }
    }

    async handleEmailLogin() {
        if (this.isLoading) return;

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        this.setEmailLoading(true);
        this.clearMessages();

        try {
            console.log('📧 Attempting email/password login for:', email);

            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('❌ Email login error:', error);
                this.showError(this.getErrorMessage(error));
                this.setEmailLoading(false);
                return;
            }

            console.log('✅ Email login successful:', data.user.email);
            this.showSuccess('Login successful! Redirecting...');

            setTimeout(() => {
                this.redirectAfterLogin();
            }, 1000);

        } catch (error) {
            console.error('❌ Email login failed:', error);
            this.showError('Login failed. Please try again.');
            this.setEmailLoading(false);
        }
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
                this.redirectAfterLogin();
            }
        } catch (error) {
            console.error('❌ Auth check error:', error);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('email').value.trim();

        if (!email) {
            alert('Please enter your email address first, then click "Forgot Password"');
            document.getElementById('email').focus();
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/reset-password.html'
            });

            if (error) {
                console.error('❌ Password reset error:', error);
                this.showError('Failed to send reset email. Please try again.');
                return;
            }

            this.showSuccess(`Password reset email sent to ${email}. Please check your inbox.`);

        } catch (error) {
            console.error('❌ Password reset failed:', error);
            this.showError('Failed to send reset email. Please try again.');
        }
    }

    redirectAfterLogin() {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect');

        // If there's a specific redirect, use it
        if (redirectTo) {
            console.log('🔄 Redirecting to specified URL:', redirectTo);
            window.location.href = decodeURIComponent(redirectTo);
            return;
        }

        // Otherwise, check user type and redirect appropriately
        this.supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && session.user) {
                const userType = session.user.user_metadata?.user_type;

                if (userType === 'admin') {
                    console.log('🔄 Redirecting camp owner to portal');
                    window.location.href = '/camp-owner-portal.html';
                } else {
                    console.log('🔄 Redirecting parent to profile');
                    window.location.href = '/profile.html';
                }
            } else {
                // Fallback
                window.location.href = '/profile.html';
            }
        });
    }

    setSocialLoading(provider, loading) {
        this.isLoading = loading;
        const btn = document.getElementById(`${provider}LoginBtn`);

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
        const loginBtn = document.getElementById('loginBtn');
        const loginForm = document.getElementById('loginForm');
        const loginLoading = document.getElementById('loginLoading');

        if (loading) {
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Signing In...';
            }
            if (loginForm) loginForm.style.opacity = '0.7';
            if (loginLoading) loginLoading.style.display = 'block';
        } else {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In with Email';
            }
            if (loginForm) loginForm.style.opacity = '1';
            if (loginLoading) loginLoading.style.display = 'none';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        const successDiv = document.getElementById('loginSuccess');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }
    }

    clearMessages() {
        const errorDiv = document.getElementById('loginError');
        const successDiv = document.getElementById('loginSuccess');

        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    getErrorMessage(error) {
        switch (error.message) {
            case 'Invalid login credentials':
                return 'Invalid email or password. Please check your credentials and try again.';
            case 'Email not confirmed':
                return 'Please check your email and click the confirmation link before signing in.';
            case 'Too many requests':
                return 'Too many login attempts. Please wait a moment and try again.';
            default:
                return error.message || 'Login failed. Please try again.';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('🚀 Initializing login handler...');
        window.loginHandler = new LoginHandler();
    }, 100);
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginHandler;
}