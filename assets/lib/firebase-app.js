// Firebase App SDK - Fallback implementation
// This is a simplified version for testing without actual Firebase

export function initializeApp(config) {
    console.log('Firebase app initialized with config:', config);
    return {
        name: 'default',
        options: config
    };
}

