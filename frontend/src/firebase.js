/**
 * Firebase client SDK initializer for AXIOM dashboard.
 *
 * Uses Firebase JS SDK v11 (matches "firebase": "^11.0.2" in package.json).
 * All config values come from REACT_APP_FIREBASE_* environment variables.
 *
 * NOTE: These are CLIENT-side web app keys, NOT the server-side service account.
 * The backend uses firebase-admin with the service account JSON.
 *
 * RTDB listener pattern (use in components):
 *   import { database } from "../firebase";
 *   import { ref, onValue } from "firebase/database";
 *
 *   useEffect(() => {
 *     const decisionsRef = ref(database, "/decisions");
 *     const unsub = onValue(decisionsRef, (snap) => {
 *       const data = snap.val() || {};
 *       // filter by project_id, sort by timestamp desc, limit 50
 *     });
 *     return () => unsub();  // cleanup on unmount
 *   }, []);
 */

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize once — React's module system ensures this runs exactly once
const app = initializeApp(firebaseConfig);

/** Firebase Realtime Database — used for live decision log */
export const database = getDatabase(app);

/** Firestore — used for audit reports and constitutions */
export const db = getFirestore(app);

/** Cloud Storage - used for PDF audit report links */
export const storage = getStorage(app);

export default app;
