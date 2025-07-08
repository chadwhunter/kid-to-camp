// js/config.js - ULTIMATE FIX with Comprehensive Error Handling
console.log('🔧 Loading enhanced config.js...');

// Prevent duplicate CONFIG declarations
if (typeof window.CONFIG === 'undefined') {
    const CONFIG = {
        supabase: {
            url: 'https://jjrvkntowkmdfbejlnwk.supabase.co',
            key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcnZrbnRvd2ttZGZiZWpsbndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNjc5OTgsImV4cCI6MjA2NTc0Mzk5OH0.Ng0lYJAki_FeJK2_fAR5w95SZJ-7-BHzpkMbNm4uKuM'
        },
        app: {
            name: 'Kid To Camp',
            version: '1.0.0',
            environment: window.location.hostname === 'localhost' ? 'development' : 'production',
            debug: window.location.hostname === 'localhost' || window.location.search.includes('debug=true')
        },
        auth: {
            redirectTo: window.location.origin + '/profile.html',
            detectSessionInUrl: true,
            persistSession: true,
            autoRefreshToken: true,
            sessionTimeout: 7 * 24 * 60 * 60 * 1000 // 7 days
        }
    };

    window.CONFIG = CONFIG;
    console.log('✅ CONFIG initialized:', CONFIG.app.environment);
} else {
    console.log('ℹ️ CONFIG already exists, skipping initialization');
}

// Enhanced Supabase initialization with retry logic
let initializationAttempts = 0;
const maxInitAttempts = 3;

async function initializeSupabaseWithRetry() {
    while (initializationAttempts < maxInitAttempts) {
        initializationAttempts++;
        console.log(`🔄 Supabase initialization attempt ${initializationAttempts}/${maxInitAttempts}`);

        try {
            const client = await initializeSupabase();
            if (client) {
                console.log('✅ Supabase initialization successful');
                return client;
            }
        } catch (error) {
            console.error(`❌ Initialization attempt ${initializationAttempts} failed:`, error);
        }

        if (initializationAttempts < maxInitAttempts) {
            console.log('⏳ Retrying in 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.error('❌ Supabase initialization failed after all attempts');
    return null;
}

function initializeSupabase() {
    return new Promise((resolve, reject) => {
        try {
            // Check if Supabase library is loaded
            if (typeof supabase === 'undefined') {
                throw new Error('Supabase library not loaded! Include script tag first.');
            }

            // Prevent multiple initializations
            if (window.supabase && window.supabase.auth && typeof window.supabase.auth.getSession === 'function') {
                console.log('ℹ️ Supabase client already initialized');
                resolve(window.supabase);
                return;
            }

            console.log('🚀 Creating new Supabase client...');

            // Enhanced client configuration
            const clientConfig = {
                auth: {
                    // Session persistence settings
                    persistSession: true,
                    detectSessionInUrl: true,
                    flowType: 'pkce',
                    autoRefreshToken: true,

                    // Storage configuration
                    storage: window.localStorage,
                    storageKey: 'sb-jjrvkntowkmdfbejlnwk-auth-token',

                    // Debug mode
                    debug: window.CONFIG.app.debug,

                    // Enhanced security
                    hashStrategy: 'pkce'
                },
                global: {
                    headers: {
                        'X-Client-Info': `${window.CONFIG.app.name}-${window.CONFIG.app.version}`,
                        'X-Client-Environment': window.CONFIG.app.environment
                    }
                },
                db: {
                    schema: 'public'
                },
                realtime: {
                    params: {
                        eventsPerSecond: 2
                    }
                }
            };

            // Create the client
            const supabaseClient = supabase.createClient(
                window.CONFIG.supabase.url,
                window.CONFIG.supabase.key,
                clientConfig
            );

            // Verify client is working
            if (!supabaseClient.auth || typeof supabaseClient.auth.getSession !== 'function') {
                throw new Error('Supabase client created but auth methods not available');
            }

            // Set up auth state change listener with error handling
            supabaseClient.auth.onAuthStateChange((event, session) => {
                console.log(`🔄 Auth state change: ${event}`);

                if (window.CONFIG.app.debug) {
                    console.log('Session details:', session ? {
                        userId: session.user.id,
                        email: session.user.email,
                        expiresAt: new Date(session.expires_at * 1000)
                    } : 'No session');
                }

                // Handle specific events
                switch (event) {
                    case 'SIGNED_IN':
                        console.log('✅ User signed in:', session.user.email);
                        updateActivityTimestamp();
                        break;
                    case 'SIGNED_OUT':
                        console.log('👋 User signed out');
                        clearActivityTimestamp();
                        break;
                    case 'TOKEN_REFRESHED':
                        console.log('🔄 Token refreshed');
                        updateActivityTimestamp();
                        break;
                    case 'USER_UPDATED':
                        console.log('👤 User updated');
                        break;
                    case 'PASSWORD_RECOVERY':
                        console.log('🔑 Password recovery initiated');
                        break;
                }
            });

            // Test the client immediately
            supabaseClient.auth.getSession()
                .then(({ data, error }) => {
                    if (error) {
                        console.warn('⚠️ Initial session check failed:', error.message);
                    } else {
                        console.log('✅ Initial session check successful');
                        if (data.session) {
                            console.log('📋 Found existing session for:', data.session.user.email);
                        }
                    }
                })
                .catch(error => {
                    console.error('❌ Session check error:', error);
                });

            // Store globally
            window.supabase = supabaseClient;

            console.log('✅ Supabase client created and configured successfully');
            resolve(supabaseClient);

        } catch (error) {
            console.error('❌ Supabase initialization error:', error);
            reject(error);
        }
    });
}

// Activity tracking functions
function updateActivityTimestamp() {
    try {
        localStorage.setItem('last_activity', Date.now().toString());
        if (window.CONFIG.app.debug) {
            console.log('📱 Activity timestamp updated');
        }
    } catch (error) {
        console.warn('⚠️ Could not update activity timestamp:', error);
    }
}

function clearActivityTimestamp() {
    try {
        localStorage.removeItem('last_activity');
        if (window.CONFIG.app.debug) {
            console.log('🗑️ Activity timestamp cleared');
        }
    } catch (error) {
        console.warn('⚠️ Could not clear activity timestamp:', error);
    }
}

// Enhanced session management
async function setupSessionManagement() {
    console.log('🔧 Setting up enhanced session management...');

    // Wait for Supabase to be ready
    let attempts = 0;
    while ((!window.supabase || !window.supabase.auth) && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
    }

    if (!window.supabase || !window.supabase.auth) {
        console.error('❌ Session management setup failed - Supabase not ready');
        return;
    }

    try {
        // Check for existing session with better error handling
        const { data: { session }, error } = await window.supabase.auth.getSession();

        if (error) {
            console.error('❌ Error checking existing session:', error);
            // Don't sign out on session check errors - might be temporary network issue
        } else if (session) {
            console.log('✅ Found existing session for:', session.user.email);

            // Validate session age and expiry
            const now = Math.floor(Date.now() / 1000);
            const sessionAge = now - session.user.created_at;
            const timeUntilExpiry = session.expires_at - now;

            console.log(`📊 Session info: ${Math.floor(timeUntilExpiry / 60)} minutes until expiry`);

            // If session expires soon (< 5 minutes), refresh it
            if (timeUntilExpiry < 300) {
                console.log('🔄 Session expiring soon, refreshing...');
                try {
                    await window.supabase.auth.refreshSession();
                    console.log('✅ Session refreshed successfully');
                } catch (refreshError) {
                    console.error('❌ Session refresh failed:', refreshError);
                }
            }
        } else {
            console.log('ℹ️ No existing session found');
        }

        // Check for extended inactivity
        const lastActivity = localStorage.getItem('last_activity');
        if (lastActivity && session) {
            const timeSinceActivity = Date.now() - parseInt(lastActivity);
            const sessionTimeout = window.CONFIG.auth.sessionTimeout;

            if (timeSinceActivity > sessionTimeout) {
                console.log('⏰ Extended inactivity detected, signing out...');
                await window.supabase.auth.signOut();
                clearActivityTimestamp();
            }
        }

        // Update activity timestamp
        updateActivityTimestamp();

        // Set up throttled activity tracking
        let activityTimeout;
        const trackActivity = () => {
            clearTimeout(activityTimeout);
            activityTimeout = setTimeout(updateActivityTimestamp, 5000); // Update at most every 5 seconds
        };

        // Track meaningful user interactions
        ['click', 'keypress', 'scroll', 'mousemove', 'touchstart'].forEach(event => {
            document.addEventListener(event, trackActivity, { passive: true });
        });

        // Set up periodic session validation (every 5 minutes)
        setInterval(async () => {
            try {
                const { data: { session }, error } = await window.supabase.auth.getSession();
                if (session && !error) {
                    const timeUntilExpiry = session.expires_at - Math.floor(Date.now() / 1000);
                    if (timeUntilExpiry < 300) { // < 5 minutes
                        await window.supabase.auth.refreshSession();
                        console.log('🔄 Automatic session refresh completed');
                    }
                }
            } catch (error) {
                console.warn('⚠️ Periodic session check failed:', error);
            }
        }, 5 * 60 * 1000); // Every 5 minutes

        console.log('✅ Enhanced session management setup complete');

    } catch (error) {
        console.error('❌ Session management setup error:', error);
    }
}

// Initialize based on library availability
if (typeof supabase !== 'undefined') {
    console.log('📚 Supabase library available, initializing...');
    initializeSupabaseWithRetry();
} else {
    console.log('⏳ Waiting for Supabase library...');

    let waitAttempts = 0;
    const maxWaitAttempts = 50;

    const waitInterval = setInterval(() => {
        waitAttempts++;

        if (typeof supabase !== 'undefined') {
            clearInterval(waitInterval);
            console.log('📚 Supabase library loaded, initializing...');
            initializeSupabaseWithRetry();
        } else if (waitAttempts >= maxWaitAttempts) {
            clearInterval(waitInterval);
            console.error('❌ Supabase library failed to load after', maxWaitAttempts * 100, 'ms');
            console.error('❌ Make sure to include: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
        }
    }, 100);
}

// DOM ready handler for session management
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSessionManagement);
} else {
    setupSessionManagement();
}

// Global helper functions for debugging
window.checkAuthStatus = async function () {
    if (!window.supabase?.auth) {
        return {
            authenticated: false,
            user: null,
            error: 'Supabase not initialized',
            client: false
        };
    }

    try {
        const { data: { session }, error } = await window.supabase.auth.getSession();
        const { data: { user }, error: userError } = await window.supabase.auth.getUser();

        return {
            authenticated: !!session,
            user: session?.user || null,
            session: session,
            userFromServer: user,
            sessionError: error,
            userError: userError,
            client: true
        };
    } catch (error) {
        return {
            authenticated: false,
            user: null,
            error: error.message,
            client: true
        };
    }
};

window.debugAuth = async function () {
    console.log('🔍 COMPREHENSIVE AUTH DEBUG:');
    console.log('================================');

    // Basic client info
    console.log('Supabase client exists:', !!window.supabase);
    console.log('Auth methods available:', !!window.supabase?.auth);
    console.log('Config:', window.CONFIG);

    // Storage info
    const authKeys = Object.keys(localStorage).filter(key => key.includes('auth'));
    console.log('LocalStorage auth keys:', authKeys);
    authKeys.forEach(key => {
        try {
            const value = localStorage.getItem(key);
            console.log(`  ${key}:`, value?.substring(0, 50) + '...');
        } catch (e) {
            console.log(`  ${key}: <error reading>`);
        }
    });

    // Current auth status
    if (window.supabase?.auth) {
        try {
            const status = await window.checkAuthStatus();
            console.log('Auth Status:', status);

            // Additional session details
            if (status.session) {
                console.log('Session Details:', {
                    userId: status.session.user.id,
                    email: status.session.user.email,
                    expiresAt: new Date(status.session.expires_at * 1000),
                    provider: status.session.user.app_metadata.provider,
                    userMetadata: status.session.user.user_metadata
                });
            }

        } catch (error) {
            console.log('Auth status check failed:', error);
        }
    }

    // Test database connectivity
    if (window.supabase) {
        try {
            const { data, error } = await window.supabase.from('profiles').select('count(*)', { count: 'exact', head: true });
            console.log('Database connectivity:', error ? `Error: ${error.message}` : 'Connected');
        } catch (error) {
            console.log('Database test failed:', error.message);
        }
    }

    console.log('================================');
};

// Quick fix function for common auth issues
window.fixAuth = async function () {
    console.log('🔧 Running auth fix...');

    try {
        // Clear potentially corrupted storage
        const authKeys = Object.keys(localStorage).filter(key => key.includes('auth'));
        console.log(`Clearing ${authKeys.length} auth storage keys...`);
        authKeys.forEach(key => localStorage.removeItem(key));

        // Force re-initialize Supabase
        console.log('Re-initializing Supabase...');
        await initializeSupabaseWithRetry();

        // Check if fix worked
        const status = await window.checkAuthStatus();
        console.log('Fix result:', status.client ? 'Client restored' : 'Client still broken');

        return status.client;

    } catch (error) {
        console.error('Fix failed:', error);
        return false;
    }
};

console.log('✅ Enhanced config.js loaded successfully');
console.log('🔧 Available debug functions: window.checkAuthStatus(), window.debugAuth(), window.fixAuth()');