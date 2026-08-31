import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('Firebase Admin initialized successfully.');
    } else {
      console.warn('FIREBASE_SERVICE_ACCOUNT_KEY is missing. Admin SDK not initialized.');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

export const adminAuth = getApps().length > 0 ? getAuth() : null;
export const adminDb = getApps().length > 0 ? getFirestore() : null;
