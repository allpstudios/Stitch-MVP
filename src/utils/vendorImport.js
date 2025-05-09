import { db, auth } from '../firebase';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { generateSearchKeywords } from './searchUtils';
import { geocodeAddress } from './geocodeAddress';

const generateTempPassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
};

export const validateVendorData = (vendorData) => {
  const requiredFields = ['companyName', 'email', 'phoneNumber', 'address'];
  const missingFields = requiredFields.filter(field => !vendorData[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(vendorData.email)) {
    throw new Error('Invalid email format');
  }

  return true;
};

export const importVendors = async (csvData) => {
  const results = {
    successful: [],
    failed: []
  };

  for (const vendorData of csvData) {
    try {
      // Validate vendor data
      validateVendorData(vendorData);

      // Check if vendor email already exists
      const vendorsRef = collection(db, 'vendors');
      const q = query(vendorsRef, where('email', '==', vendorData.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error('Vendor with this email already exists');
      }

      // Generate temporary password
      const tempPassword = generateTempPassword();

      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, vendorData.email, tempPassword);
      const uid = userCredential.user.uid;

      // Get coordinates from address
      const locationData = await geocodeAddress(vendorData.address);

      // Prepare vendor document
      const vendorDoc = {
        uid,
        email: vendorData.email,
        userType: 'vendor',
        companyName: vendorData.companyName,
        phoneNumber: vendorData.phoneNumber,
        website: vendorData.website || '',
        bio: vendorData.bio || '',
        address: vendorData.address,
        location: {
          address: vendorData.address,
          lat: locationData.lat,
          lng: locationData.lng
        },
        moq: vendorData.moq || '',
        clients: vendorData.clients || '',
        categories: vendorData.categories ? vendorData.categories.split(',').map(c => c.trim()) : [],
        services: vendorData.services ? vendorData.services.split(',').map(s => s.trim()) : [],
        specializations: vendorData.specializations ? vendorData.specializations.split(',').map(s => s.trim()) : [],
        socialMedia: {
          instagram: vendorData.instagram || '',
          tiktok: vendorData.tiktok || '',
          facebook: vendorData.facebook || ''
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        searchKeywords: generateSearchKeywords(vendorData.companyName)
      };

      // Save vendor document
      await setDoc(doc(db, 'vendors', uid), vendorDoc);

      results.successful.push({
        companyName: vendorData.companyName,
        email: vendorData.email,
        tempPassword
      });
    } catch (error) {
      results.failed.push({
        companyName: vendorData.companyName || 'Unknown',
        email: vendorData.email || 'Unknown',
        error: error.message
      });
    }
  }

  return results;
}; 