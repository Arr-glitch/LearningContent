// Firebase Auth SDK - Fallback implementation
// This is a simplified version for testing without actual Firebase

export function getAuth(app) {
    console.log('Auth initialized');
    return {
        app: app,
        currentUser: null,
        type: 'auth'
    };
}

export async function signInWithEmailAndPassword(auth, email, password) {
    console.log('Sign in attempt:', email);
    // Simulate successful login for testing
    const user = {
        uid: 'test-user-' + Date.now(),
        email: email,
        emailVerified: true
    };
    
    // Trigger auth state change
    setTimeout(() => {
        if (window.authStateCallback) {
            window.authStateCallback(user);
        }
    }, 100);
    
    return { user };
}

export async function createUserWithEmailAndPassword(auth, email, password) {
    console.log('Create user attempt:', email);
    // Simulate successful registration for testing
    const user = {
        uid: 'test-user-' + Date.now(),
        email: email,
        emailVerified: false
    };
    
    // Trigger auth state change
    setTimeout(() => {
        if (window.authStateCallback) {
            window.authStateCallback(user);
        }
    }, 100);
    
    return { user };
}

export async function signOut(auth) {
    console.log('Sign out');
    // Trigger auth state change
    setTimeout(() => {
        if (window.authStateCallback) {
            window.authStateCallback(null);
        }
    }, 100);
    
    return Promise.resolve();
}

export function onAuthStateChanged(auth, callback) {
    console.log('Auth state listener registered');
    window.authStateCallback = callback;
    
    // Simulate no user initially
    setTimeout(() => {
        callback(null);
    }, 100);
    
    // Return unsubscribe function
    return () => {
        window.authStateCallback = null;
    };
}

