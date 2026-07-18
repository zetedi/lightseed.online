import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// Validate required environment variables
const requiredEnvVars: string[] = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
];

requiredEnvVars.forEach((varName: string) => {
  if (!(import.meta.env as ImportMetaEnv)[varName]) {
    throw new Error(`${varName} is not defined in .env`);
  }
});

const firebaseConfig = {
  apiKey: (import.meta.env as ImportMetaEnv).VITE_FIREBASE_API_KEY as string,
  authDomain: (import.meta.env as ImportMetaEnv).VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: (import.meta.env as ImportMetaEnv).VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: (import.meta.env as ImportMetaEnv).VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: (import.meta.env as ImportMetaEnv).VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: (import.meta.env as ImportMetaEnv).VITE_FIREBASE_APP_ID as string,
  measurementId: (import.meta.env as ImportMetaEnv).VITE_FIREBASE_MEASUREMENT_ID as string,
};

const app = initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);