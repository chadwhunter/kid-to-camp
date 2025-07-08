// js/login.js - ROCK SOLID VERSION - Simple and Reliable

class LoginHandler {
    constructor() {
        this.supabase = null;
        this.isLoading = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing rock-solid login handler...');

        // Wait for Supabase to be ready
        await this.waitForSupabase();

        if (!this.supabase) {
            console.error('❌ Supabase not available');
            this.showError('Authentication service unavailable. Please refresh the page.');
            return;
        }

        console.log('✅ Login handler ready');
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    async waitForSupabase() {
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            if (window.supabase && window.supabase.auth && typeof window.supabase.auth.getSession === 'function') {
                this.supabase = window.supabase;
                console.log('✅ Supabase client ready');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        console.error('❌ Timeout waiting for Supabase client');
    }

    async checkExistingAuth() {
        try {
            console.log('🔍 Checking for existing session...');
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.warn('⚠️ Session check error:', error.message);
                return;
            }

            if (session && session.user) {
                console.log('👤 Found existing session:', session.user.email);

                // Check if session is still valid
                const now = Math.floor(Date.now() / 1000);
                if (session.expires_at > now) {
                    console.log('✅ Session valid, redirecting...');
                    this.redirectAfterLogin();
                } else {
                    console.log('⏰ Session expired, refreshing...');
                    try {
                        await this.supabase.auth.refreshSession();
                        this.redirectAfterLogin();
                    } catch (refreshError) {
                        console.warn('⚠️ Session refresh failed:', refreshError);
                    }
                }
            } else {
                console.log('ℹ️ No existing session found');
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);
        }
    }

    setupEventListeners() {
        // Email/Password login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEmailLogin();
            });
        }

        // Forgot password link
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }

        // Social login buttons
        const googleBtn = document.getElementById('googleLoginBtn');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.handleSocialLogin('google'));
        }

        const facebookBtn = document.getElementById('facebookLoginBtn');
        if (facebookBtn) {
            facebookBtn.addEventListener('click', () => this.handleSocialLogin('facebook'));
        }

        // Auth state listener - SIMPLE VERSION
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log(`🔄 Auth event: ${event}`);

            if (event === 'SIGNED_IN' && session) {
                console.log('✅ Sign in successful:', session.user.email);
                this.showSuccess('Login successful! Redirecting...');

                // Small delay for user feedback, then redirect
                setTimeout(() => {
                    this.redirectAfterLogin();
                }, 1500);

            } else if (event === 'SIGNED_OUT') {
                console.log('👋 Sign out completed');
                this.clearMessages();
            }
        });
    }

    async handleEmailLogin() {
        if (this.isLoading) {
            console.log('⏳ Login already in progress');
            return;
        }

        const email = document.getElementById('email')?.value?.trim();
        const password = document.getElementById('password')?.value;

        // Basic validation
        if (!email || !password) {
            this.showError('Please enter both email and password');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        this.setLoading(true);
        this.clearMessages();
        this.retryCount = 0;

        await this.attemptLogin(email, password);
    }

    async attemptLogin(email, password) {
        try {
            console.log(`📧 Login attempt ${this.retryCount + 1} for: ${email}`);

            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('❌ Login error:', error);
                this.handleLoginError(error, email, password);
                return;
            }

            // Success
            console.log('✅ Login successful:', data.user.email);
            // Don't redirect here - let auth state change handler do it
            this.setLoading(false);

        } catch (error) {
            console.error('❌ Login exception:', error);
            this.handleLoginError(error, email, password);
        }
    }

    handleLoginError(error, email, password) {
        const errorMessage = error.message || 'Unknown error';

        // Handle specific error types
        if (errorMessage.includes('Invalid login credentials')) {
            this.showError('Invalid email or password. Please check your credentials.');
            this.setLoading(false);
        } else if (errorMessage.includes('Email not confirmed')) {
            this.showError('Please check your email and click the confirmation link before signing in.');
            this.setLoading(false);
        } else if (errorMessage.includes('Too many requests') || errorMessage.includes('rate limit')) {
            // Retry with exponential backoff
            if (this.retryCount < this.maxRetries) {
                const delay = Math.pow(2, this.retryCount) * 1000; // 1s, 2s, 4s
                this.retryCount++;
                console.log(`⏳ Rate limited, retrying in ${delay}ms... (attempt ${this.retryCount})`);

                setTimeout(() => {
                    this.attemptLogin(email, password);
                }, delay);
            } else {
                this.showError('Too many login attempts. Please wait a few minutes and try again.');
                this.setLoading(false);
            }
        } else {
            // Generic error
            this.showError(`Login failed: ${errorMessage}`);
            this.setLoading(false);
        }
    }

    async handleSocialLogin(provider) {
        if (this.isLoading) return;

        console.log(`🔐 Starting ${provider} login...`);
        this.setSocialLoading(provider, true);
        this.clearMessages();

        try {
            const redirectTo = `${window.location.origin}/login.html`;

            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: redirectTo
                }
            });

            if (error) {
                console.error(`❌ ${provider} login error:`, error);
                this.showError(`${provider} login failed: ${error.message}`);
                this.setSocialLoading(provider, false);
                return;
            }

            console.log(`✅ ${provider} OAuth initiated`);
            // User will be redirected, don't reset loading state

        } catch (error) {
            console.error(`❌ ${provider} login failed:`, error);
            this.showError(`${provider} login failed. Please try again.`);
            this.setSocialLoading(provider, false);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('email')?.value?.trim();

        if (!email) {
            this.showError('Please enter your email address first');
            document.getElementById('email')?.focus();
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        try {
            this.clearMessages();
            console.log('📧 Sending password reset to:', email);

            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`
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
        // Get redirect parameter from URL
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect') || '/profile.html';

        console.log('🔄 Redirecting to:', redirectTo);

        // Clean up URL parameters before redirecting
        if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        window.location.href = redirectTo;
    }

    setLoading(loading) {
        this.isLoading = loading;

        const loginBtn = document.getElementById('loginBtn');
        const loginForm = document.getElementById('loginForm');

        if (loading) {
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Signing In...';
            }
            if (loginForm) {
                loginForm.style.opacity = '0.7';
            }
        } else {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
            if (loginForm) {
                loginForm.style.opacity = '1';
            }
        }
    }

    setSocialLoading(provider, loading) {
        const btn = document.getElementById(`${provider}LoginBtn`);
        if (!btn) return;

        if (loading) {
            btn.disabled = true;
            const span = btn.querySelector('span');
            if (span) {
                btn.setAttribute('data-original-text', span.textContent);
                span.textContent = `Connecting...`;
            }
        } else {
            btn.disabled = false;
            const span = btn.querySelector('span');
            const originalText = btn.getAttribute('data-original-text');
            if (span && originalText) {
                span.textContent = originalText;
            }
        }
    }

    showError(message) {
        console.error('❌ Login Error:', message);
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        // Also show in console for debugging
        if (window.CONFIG?.app?.debug) {
            alert('Login Error: ' + message);
        }
    }

    showSuccess(message) {
        console.log('✅ Login Success:', message);
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
}

// Simple, reliable initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM ready, initializing login handler...');

    // Small delay to ensure all scripts are loaded
    setTimeout(() => {
        window.loginHandler = new LoginHandler();
    }, 200);
});

// Export for testing/debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginHandler;
}

// Global debugging helper
window.testLogin = async function (email = 'test@kidtocamp.com', password = 'testpass123') {
    console.log('🧪 Testing login with:', email);

    if (!window.loginHandler) {
        console.error('❌ Login handler not initialized');
        return false;
    }

    try {
        // Fill in the form fields
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        if (emailInput) emailInput.value = email;
        if (passwordInput) passwordInput.value = password;

        // Trigger login
        await window.loginHandler.handleEmailLogin();
        return true;
    } catch (error) {
        console.error('❌ Test login failed:', error);
        return false;
    }
};

console.log('✅ Rock-solid login handler loaded');
console.log('🧪 Use window.testLogin() to test login functionality');