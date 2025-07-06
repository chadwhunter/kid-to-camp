// js/login.js - Login Form Handler

class LoginHandler {
    constructor() {
        this.supabase = null;
        this.isLoading = false;
        this.init();
    }

    async init() {
        console.log('Initializing login handler...');

        // Wait for Supabase client to be ready
        await this.waitForSupabase();

        if (!this.supabase) {
            console.error('Supabase not available for login');
            this.showError('Authentication service not available. Please refresh the page.');
            return;
        }

        console.log('✅ Login handler ready');
        this.setupEventListeners();

        // Check if user is already logged in
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

        console.error('Supabase client not available after waiting');
    }

    async checkExistingAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.error('Error checking existing session:', error);
                return;
            }

            if (session && session.user) {
                console.log('User already logged in, redirecting...');
                this.redirectAfterLogin();
            }
        } catch (error) {
            console.error('Auth check error:', error);
        }
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }

        // Listen for auth state changes
        if (this.supabase) {
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed in login:', event);

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

    async handleLogin() {
        if (this.isLoading) return;

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validate inputs
        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        this.setLoading(true);
        this.clearMessages();

        try {
            console.log('Attempting login for:', email);

            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Login error:', error);
                this.showError(this.getErrorMessage(error));
                this.setLoading(false);
                return;
            }

            console.log('✅ Login successful:', data.user.email);
            this.showSuccess('Login successful! Redirecting...');

            // Small delay before redirect to show success message
            setTimeout(() => {
                this.redirectAfterLogin();
            }, 1000);

        } catch (error) {
            console.error('Login failed:', error);
            this.showError('Login failed. Please try again.');
            this.setLoading(false);
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
                console.error('Password reset error:', error);
                this.showError('Failed to send reset email. Please try again.');
                return;
            }

            this.showSuccess(`Password reset email sent to ${email}. Please check your inbox.`);

        } catch (error) {
            console.error('Password reset failed:', error);
            this.showError('Failed to send reset email. Please try again.');
        }
    }

    redirectAfterLogin() {
        // Redirect to intended page or default to profile
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect') || '/profile.html';

        console.log('Redirecting to:', redirectTo);
        window.location.href = redirectTo;
    }

    setLoading(loading) {
        this.isLoading = loading;

        const loginBtn = document.getElementById('loginBtn');
        const loginForm = document.getElementById('loginForm');
        const loginLoading = document.getElementById('loginLoading');

        if (loading) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing In...';
            loginForm.style.opacity = '0.7';
            if (loginLoading) loginLoading.style.display = 'block';
        } else {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
            loginForm.style.opacity = '1';
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
    // Small delay to ensure Supabase is ready
    setTimeout(() => {
        console.log('Initializing login handler...');
        window.loginHandler = new LoginHandler();
    }, 100);
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginHandler;
}