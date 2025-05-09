import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyACtzkLFQOAS2kZVAKsBzKwFsnFZCoC9wk",
  authDomain: "stitch-mvp-f7f29.firebaseapp.com",
  projectId: "stitch-mvp-f7f29",
  storageBucket: "stitch-mvp-f7f29.firebasestorage.app",
  messagingSenderId: "560155326957",
  appId: "1:560155326957:web:48f98bff022212198c4fe4",
  measurementId: "G-4WTN953XRC"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export initialized services
export { db, auth, storage }; 