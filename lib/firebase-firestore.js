// Firebase Firestore SDK - Fallback implementation
// This is a simplified version for testing without actual Firebase

export function getFirestore(app) {
    console.log('Firestore initialized');
    return {
        app: app,
        type: 'firestore'
    };
}

export function collection(db, path) {
    console.log('Collection reference:', path);
    return {
        path: path,
        type: 'collection'
    };
}

export function doc(db, path, id) {
    console.log('Document reference:', path, id);
    return {
        path: path,
        id: id,
        type: 'document'
    };
}

export async function getDocs(collectionRef) {
    console.log('Getting documents from:', collectionRef.path);
    // Return empty result for testing
    return {
        docs: [],
        empty: true,
        size: 0
    };
}

export async function getDoc(docRef) {
    console.log('Getting document:', docRef.path, docRef.id);
    return {
        exists: () => false,
        data: () => null,
        id: docRef.id
    };
}

export async function setDoc(docRef, data) {
    console.log('Setting document:', docRef.path, docRef.id, data);
    return Promise.resolve();
}

export async function updateDoc(docRef, data) {
    console.log('Updating document:', docRef.path, docRef.id, data);
    return Promise.resolve();
}

export function increment(value) {
    return {
        type: 'increment',
        value: value
    };
}

export function query(collectionRef, ...constraints) {
    return {
        ...collectionRef,
        constraints: constraints
    };
}

export function orderBy(field, direction = 'asc') {
    return {
        type: 'orderBy',
        field: field,
        direction: direction
    };
}

