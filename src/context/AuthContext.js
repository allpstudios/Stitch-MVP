import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext(null);

const ADMIN_EMAIL = 'info@allpstudios.com';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchUserProfile = async (uid) => {
    try {
      console.log('Fetching profile for UID:', uid);
      
      // Try vendors collection
      const vendorDoc = await getDoc(doc(db, 'vendors', uid));
      console.log('Vendor doc exists:', vendorDoc.exists());
      
      if (vendorDoc.exists()) {
        const vendorData = vendorDoc.data();
        console.log('Found vendor data:', vendorData);
        setUserProfile({ ...vendorData, uid, userType: 'vendor' });
        return;
      }
      
      // Try brands collection
      const brandDoc = await getDoc(doc(db, 'brands', uid));
      console.log('Brand doc exists:', brandDoc.exists());
      
      if (brandDoc.exists()) {
        const brandData = brandDoc.data();
        console.log('Found brand data:', brandData);
        setUserProfile({ ...brandData, uid, userType: 'brand' });
        return;
      }
      
      console.log('No profile found in either collection');
      setUserProfile(null);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user?.uid);
      
      if (user) {
        setUser(user);
        // Set admin status based on email
        setIsAdmin(user.email === ADMIN_EMAIL);
        await fetchUserProfile(user.uid);
      } else {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signup = async (email, password, userType, companyName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create base user data
      const userData = {
        email,
        userType,
        companyName,
        uid: user.uid,
        createdAt: new Date().toISOString()
      };

      // Save to appropriate collection based on userType
      if (userType === 'vendor') {
        const vendorData = {
          ...userData,
          isActive: true,
          categories: [],
          location: {
            address: '',
            lat: null,
            lng: null
          },
          contactInfo: {
            phone: '',
            email: email,
            website: ''
          },
          description: '',
          moq: '',
          clients: ''
        };
        await setDoc(doc(db, 'vendors', user.uid), vendorData);
        setUserProfile({ ...vendorData, uid: user.uid, userType: 'vendor' });
      } else if (userType === 'brand') {
        const brandData = {
          ...userData,
          isActive: true,
          companyName: companyName,
          email: email,
          phoneNumber: '',
          website: '',
          bio: '',
          brandSize: '',
          socialMedia: {
            instagram: '',
            linkedin: ''
          },
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'brands', user.uid), brandData);
        setUserProfile({ ...brandData, uid: user.uid, userType: 'brand' });

        // Create automatic conversation with ALLP Studios for brands
        const ALLP_STUDIOS_ID = 'lwJ2Ja9jmEUZgV2yCvlCScZXlAR2';
        const conversationData = {
          participants: [user.uid, ALLP_STUDIOS_ID],
          participantNames: [companyName, 'ALLP STUDIOS'],
          lastMessage: 'Welcome to STITCH! Feel free to send us a message or quote request.',
          lastMessageAt: serverTimestamp(),
          type: 'inquiry',
          vendorId: ALLP_STUDIOS_ID,
          brandId: user.uid,
          unreadCount: {
            [ALLP_STUDIOS_ID]: 1,
            [user.uid]: 0
          }
        };

        // Create the conversation
        const conversationRef = await addDoc(collection(db, 'conversations'), conversationData);

        // Add welcome message
        await addDoc(collection(db, 'messages'), {
          conversationId: conversationRef.id,
          senderId: ALLP_STUDIOS_ID,
          senderName: 'ALLP STUDIOS',
          recipientId: user.uid,
          recipientName: companyName,
          content: 'Welcome to STITCH! We\'re excited to work with you. Feel free to send us a message or quote request anytime.',
          type: 'text',
          timestamp: serverTimestamp(),
          readBy: [ALLP_STUDIOS_ID]
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Set admin status based on email
      setIsAdmin(user.email === ADMIN_EMAIL);
      
      // Check vendors collection first
      let userDoc = await getDoc(doc(db, 'vendors', user.uid));
      if (!userDoc.exists()) {
        // If not in vendors, check brands collection
        userDoc = await getDoc(doc(db, 'brands', user.uid));
      }
      
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
  };

  // Add these methods to maintain compatibility with existing code
  const getUser = () => user;
  const getUserProfile = () => userProfile;

  const updateUserProfile = async (updatedData) => {
    if (!user) return;

    try {
      // Determine the correct collection based on user type
      const collectionName = updatedData.userType === 'brand' ? 'brands' : 'vendors';
      
      // Get reference to the correct document
      const userDocRef = doc(db, collectionName, user.uid);
      
      // Update the document
      await updateDoc(userDocRef, {
        ...updatedData,
        updatedAt: new Date().toISOString()
      });

      // Update the local state
      setUserProfile(prevProfile => ({
        ...prevProfile,
        ...updatedData
      }));

    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    setUserProfile: updateUserProfile,
    login,
    signup,
    logout,
    isAdmin,
    // Add isVendor property
    isVendor: userProfile?.userType === 'vendor',
    // Add these to maintain compatibility
    getUser,
    getUserProfile,
    currentUser: user, // For backward compatibility
    loading,
    refreshProfile: () => user && fetchUserProfile(user.uid)
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthProvider; 