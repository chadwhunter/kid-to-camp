// js/config.js - Fixed Configuration with Proper Supabase Initialization

// Configuration object
const CONFIG = {
    supabase: {
        url: 'https://jjrvkntowkmdfbejlnwk.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcnZrbnRvd2ttZGZiZWpsbndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNjc5OTgsImV4cCI6MjA2NTc0Mzk5OH0.Ng0lYJAki_FeJK2_fAR5w95SZJ-7-BHzpkMbNm4uKuM'
    },
    app: {
        name: 'Kid To Camp',
        version: '1.0.0'
    }
};

// Function to initialize Supabase client
function initializeSupabase() {
    try {
        // Check if Supabase library is loaded
        if (typeof supabase === 'undefined' || !window.supabase) {
            console.error('Supabase library not loaded! Make sure to include the Supabase script tag.');
            return null;
        }

        console.log('Initializing Supabase client...');

        // Create Supabase client instance
        const client = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.key, {
            auth: {
                persistSession: false, // Don't persist sessions across browser restarts
                detectSessionInUrl: true,
                flowType: 'pkce'
            }
        });

        // Replace the library with the initialized client
        window.supabase = client;

        console.log('✅ Supabase client initialized successfully');
        console.log('Client has auth methods:', !!(client.auth && client.auth.signOut));

        return client;

    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
        return null;
    }
}

// Initialize when script loads
if (typeof supabase !== 'undefined' && window.supabase) {
    initializeSupabase();
} else {
    // Wait for Supabase library to load
    console.log('Waiting for Supabase library to load...');

    let attempts = 0;
    const maxAttempts = 50;

    const waitForSupabase = setInterval(() => {
        attempts++;

        if (typeof supabase !== 'undefined' && window.supabase) {
            clearInterval(waitForSupabase);
            initializeSupabase();
        } else if (attempts >= maxAttempts) {
            clearInterval(waitForSupabase);
            console.error('❌ Supabase library failed to load after', maxAttempts * 100, 'ms');
        }
    }, 100);
}

// Session management
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Setting up session management...');

    // Wait for Supabase client to be ready
    let attempts = 0;
    while ((!window.supabase || !window.supabase.auth) && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!window.supabase || !window.supabase.auth) {
        console.error('❌ Supabase client not ready for session management');
        return;
    }

    console.log('✅ Supabase client ready, setting up session timeout...');

    // Session timeout configuration
    const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
    const lastActivity = localStorage.getItem('last_activity');
    const now = Date.now();

    if (lastActivity) {
        const timeSinceLastActivity = now - parseInt(lastActivity);

        if (timeSinceLastActivity > SESSION_TIMEOUT) {
            console.log('⏰ Session expired due to inactivity, logging out...');
            try {
                await window.supabase.auth.signOut();
                localStorage.removeItem('last_activity');
            } catch (error) {
                console.error('Error during auto-logout:', error);
            }
        }
    }

    // Update activity timestamp
    localStorage.setItem('last_activity', now.toString());

    // Track user activity
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
        document.addEventListener(event, () => {
            localStorage.setItem('last_activity', Date.now().toString());
        }, { passive: true });
    });

    console.log('✅ Session management setup complete');
});

// Export CONFIG for other scripts
window.CONFIG = CONFIG;