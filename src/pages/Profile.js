import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaUserCircle, 
  FaStore, 
  FaHeart, 
  FaBell, 
  FaCog, 
  FaPencilAlt,
  FaEdit,
  FaStar,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaGlobe,
  FaClock,
  FaBox,
  FaFileAlt,
  FaCheckCircle,
  FaImage,
  FaUpload,
  FaInstagram,
  FaTiktok,
  FaFacebookF,
  FaShareAlt,
  FaPlus,
  FaTimes
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './Profile.css';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { VENDOR_CATEGORIES } from '../constants/categories';
import { generateSearchKeywords } from '../utils/searchUtils';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { geocodeAddress } from '../utils/geocodeAddress';

const VALID_CATEGORIES = [
  'Blank Vendor',
  'Fabric Vendor',
  'Hat Vendor',
  'Dye House',
  'Cut & Sew Manufacturer',
  'Screen Printer',
  'DTG Printer',
  'DTF Printer',
  'Embroidery',
  'Rhinestone Vendor',
  'Patch Vendor',
  '3PL Fullfilment',
  'Photo Studios',
  'Supplies & Hardware'
];

const BRAND_NICHES = [
  'Streetwear',
  'Activewear',
  'Luxury',
  'Sustainable Fashion',
  'Casual Wear',
  'Athleisure',
  'Vintage/Retro',
  'Contemporary',
  'Urban Fashion',
  'Minimalist',
  'Bohemian',
  'Workwear'
];

const Profile = ({ hideNavigation }) => {
  const { user, userProfile, setUserProfile, loading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({
    companyName: userProfile?.companyName || '',
    email: user?.email || '',
    userType: userProfile?.userType || '',
    phoneNumber: userProfile?.phoneNumber || '',
    website: userProfile?.website || '',
    bio: userProfile?.bio || '',
    address: userProfile?.address || '',
    moq: userProfile?.moq || '',
    clients: userProfile?.clients || [],
    clientsList: userProfile?.clientsList || [],
    categories: userProfile?.categories || [],
    services: userProfile?.services || [],
    specializations: userProfile?.specializations || [],
    portfolio: userProfile?.portfolio || [],
    galleryImages: userProfile?.galleryImages || [],
    logo: userProfile?.logo || null,
    banner: userProfile?.banner || null,
    socialMedia: {
      instagram: userProfile?.socialMedia?.instagram || '',
      tiktok: userProfile?.socialMedia?.tiktok || '',
      facebook: userProfile?.socialMedia?.facebook || ''
    }
  });
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productData, setProductData] = useState({
    name: '',
    category: 'T-shirt',
    description: '',
    price: '',
    inventory: [
      { size: 'S', color: '', quantity: 0 },
      { size: 'M', color: '', quantity: 0 },
      { size: 'L', color: '', quantity: 0 },
      { size: 'XL', color: '', quantity: 0 }
    ],
    media: null
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [activeSection, setActiveSection] = useState('company');

  const handleEditToggle = (e) => {
    if (e) e.preventDefault();
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    
    // Prevent multiple simultaneous save operations
    if (isLoading) {
      console.log('Save operation already in progress, skipping...');
      return;
    }
    
    try {
      setIsLoading(true); // Add loading state
      
      // Debug logs
      console.log('Starting profile save...');
      console.log('Current auth state:', {
        isAuthenticated: !!user,
        uid: user?.uid,
        userType: userProfile?.userType,
        email: user?.email
      });
      console.log('Profile data to save:', profileData);
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      if (!userProfile) {
        throw new Error('No user profile found');
      }

      if (!userProfile.userType) {
        throw new Error('User type not specified in profile');
      }
      
      // Only get location data if address is provided
      let locationData = null;
      if (profileData.address) {
        locationData = await geocodeAddress(profileData.address);
      }
      
      // Process services to ensure they have all required fields
      const processedServices = profileData.services.map(service => ({
        name: service.name || '',
        image: service.image || null,
        moq: service.moq || '',
        leadTime: service.leadTime || ''
      }));
      
      console.log('Processed services data:', processedServices);
      
      // Extract service names and add them to categories
      const serviceCategories = processedServices
        .map(service => service.name)
        .filter(name => name && VENDOR_CATEGORIES.includes(name));

      // Combine existing categories with service categories, removing duplicates
      const updatedCategories = Array.from(new Set([
        ...(profileData.categories || []),
        ...serviceCategories
      ]));
      
      // Process portfolio items to ensure they have all required fields
      const processedPortfolio = profileData.portfolio.map(item => ({
        title: item.title || '',
        description: item.description || '',
        image: item.image || null
      }));
      
      console.log('Processed portfolio data:', processedPortfolio);
      
      // Process clients list to ensure they have all required fields
      const processedClientsList = profileData.clientsList.map(client => ({
        name: client.name || '',
        logo: client.logo || null
      }));
      
      console.log('Processed clients data:', processedClientsList);
      
      // Process gallery images to ensure they have all required fields
      const processedGalleryImages = profileData.galleryImages
        .filter(img => img.url && !img.isUploading) // Only include fully uploaded images
        .map(img => ({
          id: img.id,
          url: img.url
        }));
      
      console.log('Processed gallery data:', processedGalleryImages);
      
      // Prepare the update data
      const updateData = {
        ...profileData,
        services: processedServices, // Use the processed services
        categories: updatedCategories, // Use the updated categories that include service names
        portfolio: processedPortfolio, // Use the processed portfolio
        clientsList: processedClientsList, // Use the processed clients
        galleryImages: processedGalleryImages, // Use the processed gallery images
        uid: user.uid,  // Ensure UID is included
        email: user.email,  // Ensure email is included
        userType: userProfile.userType,  // Ensure userType is preserved
        updatedAt: new Date().toISOString()
      };

      // If we have location data, add it to the update
      if (locationData) {
        updateData.location = {
          address: profileData.address,
          lat: locationData.lat,
          lng: locationData.lng
        };
      }

      // Determine the correct collection based on user type
      console.log('Attempting to update document:', {
        collection: userProfile.userType === 'brand' ? 'brands' : 'vendors',
        docId: user.uid,
        updateData
      });
      
      if (userProfile.userType === 'brand') {
        // Update brand document
        const brandRef = doc(db, 'brands', user.uid);
        await updateDoc(brandRef, updateData);
        console.log('Brand document updated successfully');
      } else {
        // Update vendor document
        const vendorRef = doc(db, 'vendors', user.uid);
        await updateDoc(vendorRef, updateData);
        console.log('Vendor document updated successfully');
      }
      
      // Update both states with the same data
      setUserProfile(updateData);
      setProfileData(updateData);
      
      setIsEditing(false);
      setIsLoading(false); // Clear loading state
      alert('Profile updated successfully!');
      
      // Force reload the data from Firestore to ensure everything is synced
      const docRef = doc(db, userProfile.userType === 'brand' ? 'brands' : 'vendors', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const updatedData = docSnap.data();
        console.log('Refreshed profile data from Firestore:', updatedData);
        setUserProfile(updatedData);
        setProfileData(updatedData);
      }
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setIsLoading(false); // Clear loading state
      // More detailed error message
      let errorMessage = 'Failed to update profile: ';
      if (error.code === 'permission-denied') {
        errorMessage += 'You do not have permission to update this profile. Please ensure you are properly logged in.';
      } else if (error.code === 'not-found') {
        errorMessage += 'Profile document not found. Please try refreshing the page.';
      } else {
        errorMessage += error.message;
      }
      alert(errorMessage);
    }
  };

  const handleCategoryChange = (category) => {
    setProfileData(prev => {
      const updatedCategories = prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category];
      
      return {
        ...prev,
        categories: updatedCategories
      };
    });
  };

  const fetchVendorProducts = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const q = query(
        collection(db, 'products'), 
        where('vendorId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const productList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productList);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const productRef = collection(db, 'products');
      const newProduct = {
        ...productData,
        vendorId: user.uid,
        vendor: userProfile.companyName,
        price: parseFloat(productData.price),
        inventory: productData.inventory || [],
        createdAt: new Date().toISOString(),
        isActive: true
      };

      await addDoc(productRef, newProduct);
      setIsAddingProduct(false);
      setProductData({
        name: '',
        category: 'T-shirt',
        description: '',
        price: '',
        inventory: [
          { size: 'S', color: '', quantity: 0 },
          { size: 'M', color: '', quantity: 0 },
          { size: 'L', color: '', quantity: 0 },
          { size: 'XL', color: '', quantity: 0 }
        ],
        media: null
      });
      
      fetchVendorProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product. Please try again.');
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    try {
      const productRef = doc(db, 'products', editingProduct.id);
      await updateDoc(productRef, {
        ...productData,
        price: parseFloat(productData.price),
        updatedAt: new Date().toISOString()
      });
      
      setEditingProduct(null);
      setIsProductModalOpen(false);
      setProductData({
        name: '',
        category: 'T-shirt',
        description: '',
        price: '',
        inventory: [
          { size: 'S', color: '', quantity: 0 },
          { size: 'M', color: '', quantity: 0 },
          { size: 'L', color: '', quantity: 0 },
          { size: 'XL', color: '', quantity: 0 }
        ],
        media: null
      });
      
      fetchVendorProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product. Please try again.');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        fetchVendorProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Failed to delete product. Please try again.');
      }
    }
  };

  useEffect(() => {
    if (user && userProfile?.userType === 'vendor') {
      fetchVendorProducts();
    }
  }, [user, userProfile, fetchVendorProducts]);

  useEffect(() => {
    console.log('Current user profile:', userProfile);
  }, [userProfile]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (userProfile) {
      console.log('Setting initial profile data:', userProfile);
      // Ensure we copy all fields from userProfile
      setProfileData({
        ...userProfile,
        companyName: userProfile.companyName || '',
        email: userProfile.email || user?.email || '',
        userType: userProfile.userType || '',
        phoneNumber: userProfile.phoneNumber || '',
        website: userProfile.website || '',
        bio: userProfile.bio || '',
        address: userProfile.address || '',
        moq: userProfile.moq || '',
        clients: userProfile.clients || [],
        clientsList: userProfile.clientsList || [],
        categories: userProfile.categories || [],
        services: userProfile.services || [],
        specializations: userProfile.specializations || [],
        portfolio: userProfile.portfolio || [],
        galleryImages: userProfile.galleryImages || [],
        logo: userProfile.logo || null,
        banner: userProfile.banner || null,
        socialMedia: {
          instagram: userProfile.socialMedia?.instagram || '',
          tiktok: userProfile.socialMedia?.tiktok || '',
          facebook: userProfile.socialMedia?.facebook || ''
        }
      });
      
      // Clean up any blob URLs in portfolio data
      if (userProfile.portfolio && userProfile.portfolio.length > 0) {
        const portfolioHasBlobUrls = userProfile.portfolio.some(
          item => item.image && item.image.startsWith('blob:')
        );
        
        if (portfolioHasBlobUrls) {
          console.log('Found blob URLs in portfolio data, cleaning up...');
          const cleanedPortfolio = userProfile.portfolio.map(item => ({
            ...item,
            title: item.title || '',
            description: item.description || '',
            image: item.image && item.image.startsWith('blob:') ? null : item.image
          }));
          
          // Update the portfolio data with cleaned URLs
          setProfileData(prev => ({
            ...prev,
            portfolio: cleanedPortfolio
          }));
        }
      }
    }
  }, [userProfile, user]);

  const mockPortfolio = [
    { id: 1, title: 'Custom T-Shirt Collection', image: 'portfolio1.jpg' },
    { id: 2, title: 'Summer Line Production', image: 'portfolio2.jpg' },
    { id: 3, title: 'Embroidered Caps Series', image: 'portfolio3.jpg' }
  ];

  const mockReviews = [
    {
      id: 1,
      customerName: 'Sarah Johnson',
      rating: 5,
      comment: 'Excellent quality and fast turnaround time. Very professional service.',
      date: '2024-02-15'
    },
    {
      id: 2,
      customerName: 'Mike Chen',
      rating: 4,
      comment: 'Great communication and attention to detail.',
      date: '2024-02-10'
    }
  ];

  const handleLogoUpload = async (file) => {
    try {
      if (!file || !file.name) {
        console.error('Invalid file or missing file name');
        alert('Invalid file. Please try again with a different image.');
        return;
      }

      if (!userProfile || !userProfile.userType || !user) {
        console.error('Missing user profile data');
        alert('Error: Unable to upload logo. User profile data is missing.');
        return;
      }

      // Create a reference to the file in Firebase Storage with the correct path structure
      const storageRef = ref(storage, `${userProfile.userType}s/${user.uid}/logo/${file.name}`);
      
      // Create metadata to ensure content type is set
      const metadata = {
        contentType: file.type
      };
      
      // Upload the file with metadata
      await uploadBytes(storageRef, file, metadata);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update the document with the new logo URL based on user type
      const collectionRef = doc(db, `${userProfile.userType}s`, user.uid);
      await updateDoc(collectionRef, {
        logo: downloadURL
      });
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        logo: downloadURL
      }));
      
      console.log('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
    }
  };

  const handleLogoDelete = async () => {
    try {
      if (profileData.logo) {
        // Extract the file path from the URL
        const fileRef = ref(storage, profileData.logo);
        
        // Delete the file from Storage
        await deleteObject(fileRef);
        
        // Update the document to remove the logo URL based on user type
        const collectionRef = doc(db, `${userProfile.userType}s`, user.uid);
        await updateDoc(collectionRef, {
          logo: null
        });
        
        // Update local state
        setProfileData(prev => ({
          ...prev,
          logo: null
        }));
        
        console.log('Logo deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting logo:', error);
      alert('Failed to delete logo. Please try again.');
    }
  };

  const handleServiceImageUpload = async (serviceIndex, file) => {
    try {
      if (!userProfile || !userProfile.userType || !user) {
        console.error('Missing user profile data');
        alert('Error: Unable to upload image. User profile data is missing.');
        return null;
      }

      // Create a reference to the file in Firebase Storage with the path that matches our rules
      const storageRef = ref(storage, `vendors/${user.uid}/services/${serviceIndex}_${file.name}`);
      
      // Create metadata to ensure content type is set
      const metadata = {
        contentType: file.type
      };
      
      // Upload the file with metadata
      const uploadTask = await uploadBytes(storageRef, file, metadata);
      console.log('Upload successful:', uploadTask);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL obtained:', downloadURL);
      
      // Update local state
      const updatedServices = [...profileData.services];
      if (updatedServices[serviceIndex]) {
        updatedServices[serviceIndex] = {
          ...updatedServices[serviceIndex],
          image: downloadURL
        };
      }
      
      setProfileData(prev => ({
        ...prev,
        services: updatedServices
      }));
      
      console.log('Service image uploaded successfully');
      return downloadURL;
    } catch (error) {
      console.error('Error uploading service image:', error);
      alert('Failed to upload service image. Please try again.');
      return null;
    }
  };

  const handlePortfolioImageUpload = async (portfolioIndex, file) => {
    try {
      if (!userProfile || !userProfile.userType || !user) {
        console.error('Missing user profile data');
        alert('Error: Unable to upload image. User profile data is missing.');
        return null;
      }

      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `vendors/${user.uid}/portfolio/${portfolioIndex}_${file.name}`);
      
      // Create metadata to ensure content type is set
      const metadata = {
        contentType: file.type
      };
      
      // Upload the file with metadata
      const uploadTask = await uploadBytes(storageRef, file, metadata);
      console.log('Portfolio upload successful:', uploadTask);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Portfolio image URL obtained:', downloadURL);
      
      // Update local state
      const updatedPortfolio = [...profileData.portfolio];
      if (updatedPortfolio[portfolioIndex]) {
        updatedPortfolio[portfolioIndex] = {
          ...updatedPortfolio[portfolioIndex],
          image: downloadURL
        };
      }
      
      setProfileData(prev => ({
        ...prev,
        portfolio: updatedPortfolio
      }));
      
      console.log('Portfolio image uploaded successfully');
      return downloadURL;
    } catch (error) {
      console.error('Error uploading portfolio image:', error);
      alert('Failed to upload portfolio image. Please try again.');
      return null;
    }
  };

  const handlePortfolioImageDelete = async (portfolioIndex) => {
    try {
      const currentImage = profileData.portfolio[portfolioIndex]?.image;
      if (currentImage) {
        // Check if it's a Firebase Storage URL
        if (currentImage.includes('firebasestorage.googleapis.com')) {
          // Extract the file path from the URL
          const fileRef = ref(storage, currentImage);
          
          // Delete the file from Storage
          await deleteObject(fileRef);
          console.log('Portfolio image deleted from Firebase Storage');
        }
        
        // Update local state
        const updatedPortfolio = [...profileData.portfolio];
        updatedPortfolio[portfolioIndex] = { 
          ...updatedPortfolio[portfolioIndex], 
          image: null 
        };
        
        setProfileData(prev => ({
          ...prev,
          portfolio: updatedPortfolio
        }));
        
        console.log('Portfolio image deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting portfolio image:', error);
      alert('Failed to delete portfolio image. Please try again.');
    }
  };

  const handleGalleryImageUpload = async (file) => {
    try {
      if (!userProfile || !userProfile.userType || !user) {
        console.error('Missing user profile data');
        alert('Error: Unable to upload image. User profile data is missing.');
        return null;
      }

      // Generate a unique ID for the image
      const timestamp = new Date().getTime();
      const randomId = Math.random().toString(36).substring(2, 10);
      const imageId = `${timestamp}_${randomId}`;

      // Set loading state
      setProfileData(prev => ({
        ...prev,
        galleryImages: [
          ...prev.galleryImages,
          { id: imageId, url: null, isUploading: true }
        ]
      }));

      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `vendors/${user.uid}/gallery/${imageId}_${file.name}`);
      
      // Create metadata to ensure content type is set
      const metadata = {
        contentType: file.type
      };
      
      // Upload the file with metadata
      const uploadTask = await uploadBytes(storageRef, file, metadata);
      console.log('Gallery image upload successful:', uploadTask);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Gallery image URL obtained:', downloadURL);
      
      // Update local state with the download URL
      setProfileData(prev => {
        const updatedGallery = prev.galleryImages.map(img => 
          img.id === imageId 
            ? { id: imageId, url: downloadURL, isUploading: false } 
            : img
        );

        return {
          ...prev,
          galleryImages: updatedGallery
        };
      });
      
      console.log('Gallery image uploaded successfully');
      return downloadURL;
    } catch (error) {
      console.error('Error uploading gallery image:', error);
      
      // Remove the failed upload from the state
      setProfileData(prev => ({
        ...prev,
        galleryImages: prev.galleryImages.filter(img => 
          !(img.isUploading && img.url === null)
        )
      }));
      
      alert(`Failed to upload gallery image: ${error.message}. Please try again.`);
        return null;
    }
  };

  const handleGalleryImageDelete = async (imageId) => {
    try {
      const imageToDelete = profileData.galleryImages.find(img => img.id === imageId);
      if (imageToDelete?.url) {
        // Check if it's a Firebase Storage URL
        if (imageToDelete.url.includes('firebasestorage.googleapis.com')) {
          // Extract the file path from the URL
          const fileRef = ref(storage, imageToDelete.url);
          
          // Delete the file from Storage
          await deleteObject(fileRef);
          console.log('Gallery image deleted from Firebase Storage');
        }
        
        // Update local state
        setProfileData(prev => ({
          ...prev,
          galleryImages: prev.galleryImages.filter(img => img.id !== imageId)
        }));
        
        console.log('Gallery image deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting gallery image:', error);
      alert('Failed to delete gallery image. Please try again.');
    }
  };

  const handleClientLogoUpload = async (clientIndex, file) => {
    try {
      if (!userProfile || !userProfile.userType || !user) {
        console.error('Missing user profile data');
        alert('Error: Unable to upload image. User profile data is missing.');
        return null;
      }

      // Set loading state for this specific client logo
      const updatedClientsList = [...profileData.clientsList];
      if (updatedClientsList[clientIndex]) {
        updatedClientsList[clientIndex] = {
          ...updatedClientsList[clientIndex],
          isUploading: true
        };
        
        setProfileData(prev => ({
          ...prev,
          clientsList: updatedClientsList
        }));
      }

      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `vendors/${user.uid}/clients/${clientIndex}_${file.name}`);
      
      // Create metadata to ensure content type is set
      const metadata = {
        contentType: file.type
      };
      
      // Upload the file with metadata
      const uploadTask = await uploadBytes(storageRef, file, metadata);
      console.log('Client logo upload successful:', uploadTask);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Client logo URL obtained:', downloadURL);
      
      // Update local state with the download URL and clear loading state
      const finalClientsList = [...profileData.clientsList];
      if (finalClientsList[clientIndex]) {
        finalClientsList[clientIndex] = {
          ...finalClientsList[clientIndex],
          logo: downloadURL,
          isUploading: false
        };
      }
      
      setProfileData(prev => ({
        ...prev,
        clientsList: finalClientsList
      }));
      
      console.log('Client logo uploaded successfully');
      return downloadURL;
    } catch (error) {
      console.error('Error uploading client logo:', error);
      
      // Clear loading state on error
      const errorClientsList = [...profileData.clientsList];
      if (errorClientsList[clientIndex]) {
        errorClientsList[clientIndex] = {
          ...errorClientsList[clientIndex],
          isUploading: false
        };
        
        setProfileData(prev => ({
          ...prev,
          clientsList: errorClientsList
        }));
      }
      
      if (error.code === 'storage/unauthorized') {
        alert('Permission denied: You do not have access to upload client logos. The administrator has been notified.');
      } else {
        alert(`Failed to upload client logo: ${error.message}. Please try again.`);
      }
      return null;
    }
  };

  const handleClientLogoDelete = async (clientIndex) => {
    try {
      const currentLogo = profileData.clientsList[clientIndex]?.logo;
      if (currentLogo) {
        // Check if it's a Firebase Storage URL
        if (currentLogo.includes('firebasestorage.googleapis.com')) {
          // Extract the file path from the URL
          const fileRef = ref(storage, currentLogo);
          
          // Delete the file from Storage
          await deleteObject(fileRef);
          console.log('Client logo deleted from Firebase Storage');
        }
        
        // Update local state
        const updatedClientsList = [...profileData.clientsList];
        updatedClientsList[clientIndex] = { 
          ...updatedClientsList[clientIndex], 
          logo: null 
        };
        
        setProfileData(prev => ({
          ...prev,
          clientsList: updatedClientsList
        }));
        
        console.log('Client logo deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting client logo:', error);
      alert('Failed to delete client logo. Please try again.');
    }
  };

  const renderTabContent = () => {
    if (activeSection === 'services' && userProfile?.userType === 'vendor') {
      return renderServicesSection();
    } else if (activeSection === 'portfolio' && userProfile?.userType === 'vendor') {
      return renderPortfolioSection();
    } else if (activeSection === 'clients' && userProfile?.userType === 'vendor') {
      return renderClientsSection();
    } else {
      return renderCompanyInfoSection();
    }
  };

  const renderPortfolioSection = () => {
    if (userProfile.userType === 'brand') {
      return (
        <div className="content-section">
          <div className="alpha-feature-message">
            <h3>Portfolio Feature Coming Soon</h3>
            <p>The portfolio feature is not available during alpha testing for brand accounts. This feature will be enabled in a future update.</p>
          </div>
        </div>
      );
    }

    // Only show portfolio editing for vendors
    return (
      <div className="content-section">
        <h2>Portfolio</h2>
        
        {/* Gallery Section */}
        <div className="portfolio-section">
          <h3>Gallery</h3>
          <p className="section-description">
            Upload individual images to showcase your work in a collage format.
          </p>
          
        {isEditing && userProfile.userType === 'vendor' ? (
            <form id="profileForm" onSubmit={handleSaveProfile} className="profile-form">
              <div className="gallery-upload-container">
                <label className="gallery-upload-button">
                  <FaPlus /> Add Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleGalleryImageUpload(file);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              
              <div className="gallery-grid">
                {profileData.galleryImages.map((image) => (
                  <div key={image.id} className="gallery-item">
                    {image.isUploading ? (
                      <div className="gallery-item-loading">
                        <span className="loading-spinner"></span>
                      </div>
                    ) : (
                      <>
                        <img src={image.url} alt="Gallery" className="gallery-image" />
                        <button
                          type="button"
                          onClick={() => handleGalleryImageDelete(image.id)}
                          className="remove-gallery-image"
                        >
                          <FaTimes />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </form>
          ) : (
            <div className="gallery-grid">
              {profileData.galleryImages && profileData.galleryImages.length > 0 ? (
                profileData.galleryImages.map((image) => (
                  <div key={image.id} className="gallery-item">
                    <img src={image.url} alt="Gallery" className="gallery-image" />
                  </div>
                ))
              ) : (
                <div className="empty-gallery-message">
                  <p>No gallery images added yet. Click "Edit Profile" to add images to your gallery.</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Projects Section */}
        <div className="portfolio-section">
          <h3>Projects</h3>
          <p className="section-description">
            Create detailed projects with titles and descriptions.
          </p>
          
          {isEditing && userProfile.userType === 'vendor' ? (
            <form id="profileForm" onSubmit={handleSaveProfile} className="profile-form">
            <div className="portfolio-grid">
              {profileData.portfolio.map((item, index) => (
                <div key={index} className="portfolio-item">
                  <div className="form-group">
                    <label>Project Title</label>
                    <input
                      type="text"
                      value={item.title || ''}
                      onChange={(e) => {
                        const updatedPortfolio = [...profileData.portfolio];
                        updatedPortfolio[index] = { 
                          ...item, 
                          title: e.target.value 
                        };
                        setProfileData({ ...profileData, portfolio: updatedPortfolio });
                      }}
                      className="form-input"
                      placeholder="Enter project title"
                    />
                  </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={item.description || ''}
                        onChange={(e) => {
                          const updatedPortfolio = [...profileData.portfolio];
                          updatedPortfolio[index] = { 
                            ...item, 
                            description: e.target.value 
                          };
                          setProfileData({ ...profileData, portfolio: updatedPortfolio });
                        }}
                        className="form-input"
                        placeholder="Describe this project (e.g., 'Screen printed shirts for Lil Wayne')"
                        rows="3"
                    />
                  </div>
                  <div className="form-group">
                    <label>Image</label>
                    <div className="portfolio-image-container">
                      {item.image ? (
                        <div className="portfolio-image-preview">
                          <img 
                            src={item.image} 
                            alt={item.title} 
                            className="portfolio-preview-img"
                          />
                          <button
                            type="button"
                            onClick={() => {
                                handlePortfolioImageDelete(index);
                            }}
                            className="remove-image-button"
                          >
                            Remove Image
                          </button>
                        </div>
                      ) : (
                        <label className="portfolio-upload-area">
                          <FaUpload className="upload-icon" />
                          <span className="upload-text">Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                  handlePortfolioImageUpload(index, file);
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const updatedPortfolio = profileData.portfolio.filter((_, i) => i !== index);
                      setProfileData({ ...profileData, portfolio: updatedPortfolio });
                    }}
                    className="remove-portfolio-button"
                  >
                    Remove Project
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileData({
                  ...profileData,
                  portfolio: [
                    ...profileData.portfolio,
                      { title: '', description: '', image: null }
                  ]
                });
              }}
              className="add-portfolio-button"
            >
              Add New Project
            </button>
              <div className="button-group">
                <button type="button" onClick={handleEditToggle} className="cancel-button">
                  Cancel
                </button>
                <button type="submit" className="save-button">
                  {isLoading ? <span className="loading-spinner"></span> : 'Save Changes'}
                </button>
              </div>
          </form>
        ) : (
          <div className="portfolio-grid">
              {profileData.portfolio && profileData.portfolio.length > 0 ? (
                profileData.portfolio.map((item, index) => (
              <div key={index} className="portfolio-card">
                <div className="portfolio-image">
                  {item.image ? (
                    <img src={item.image} alt={item.title} />
                  ) : (
                    <FaImage className="placeholder-icon" />
                  )}
                </div>
                <div className="portfolio-info">
                  <h3>{item.title}</h3>
                      {item.description && <p>{item.description}</p>}
                </div>
              </div>
                ))
              ) : (
                <div className="empty-portfolio-message">
                  <p>No projects added yet. Click "Edit Profile" to add projects to your portfolio.</p>
          </div>
        )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderServicesSection = () => {
  return (
      <div className="content-section">
        <h2>Services & Capabilities</h2>
        {isEditing ? (
          <div className="editable-services">
            <h3>Edit Your Services</h3>
            <form id="profileForm" onSubmit={handleSaveProfile}>
              <div className="services-grid">
                {profileData.services && profileData.services.length > 0 ? (
                  profileData.services.map((service, index) => (
                    <div key={index} className="service-card editable">
                      <div className="service-image-container">
                        {service.image ? (
                          <div className="service-image-preview">
                            <img 
                              src={service.image} 
                              alt={service.name || 'Service'} 
                              className="service-preview-img" 
                            />
                        <button
                          type="button"
                              onClick={() => {
                                console.log('Removing image for service at index:', index);
                                const updatedServices = [...profileData.services];
                                updatedServices[index] = { ...service, image: null };
                                setProfileData({ ...profileData, services: updatedServices });
                              }}
                          className="remove-image-button"
                        >
                              Remove Image
                        </button>
                    </div>
                        ) : (
                          <label className="service-upload-area">
                      <FaUpload className="upload-icon" />
                            <span className="upload-text">Upload Service Image</span>
                      <input
                        type="file"
                        accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  console.log('Selected file for service:', file.name);
                                  handleServiceImageUpload(index, file);
                                }
                              }}
                        style={{ display: 'none' }}
                      />
                    </label>
                        )}
                </div>
                      <div className="form-group">
                        <label>Service Name</label>
                        <select
                          value={service.name || ''}
                          onChange={(e) => {
                            const updatedServices = [...profileData.services];
                            updatedServices[index] = { ...service, name: e.target.value };
                            setProfileData({ ...profileData, services: updatedServices });
                          }}
                          className="form-input"
                          required
                        >
                          <option value="">Select a service</option>
                          {VENDOR_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>MOQ</label>
                        <input
                          type="text"
                          value={service.moq || ''}
                          onChange={(e) => {
                            const updatedServices = [...profileData.services];
                            updatedServices[index] = { ...service, moq: e.target.value };
                            setProfileData({ ...profileData, services: updatedServices });
                          }}
                          className="form-input"
                          placeholder="e.g., 25 or 'NO MOQ'"
                        />
            </div>
                      <div className="form-group">
                        <label>Lead Time</label>
                  <input
                    type="text"
                          value={service.leadTime || ''}
                          onChange={(e) => {
                            const updatedServices = [...profileData.services];
                            updatedServices[index] = { ...service, leadTime: e.target.value };
                            setProfileData({ ...profileData, services: updatedServices });
                          }}
                          className="form-input"
                          placeholder="e.g., 7-10 Business Days"
                  />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          console.log('Removing service at index:', index);
                          const updatedServices = profileData.services.filter((_, i) => i !== index);
                          setProfileData({ ...profileData, services: updatedServices });
                        }}
                        className="remove-service-button"
                      >
                        Remove Service
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-services-message">
                    <p>No services added yet. Use the button below to add your first service.</p>
                    </div>
                  )}
              </div>
              <button
                type="button"
                onClick={() => {
                  console.log('Adding new service');
                  setProfileData({
                    ...profileData,
                    services: [
                      ...(profileData.services || []),
                      { 
                        name: '', 
                        image: null, 
                        moq: '', 
                        leadTime: '' 
                      }
                    ]
                  });
                }}
                className="add-service-button"
              >
                Add New Service
              </button>
            </form>
                </div>
              ) : (
          <div className="services-grid">
            {profileData.services && profileData.services.length > 0 ? (
              profileData.services.map((service, index) => (
                <div key={index} className="service-card">
                  {service.image ? (
                    <div className="service-image">
                      <img src={service.image} alt={service.name || 'Service'} />
                    </div>
                  ) : (
                    <div className="service-icon">
                      <FaBox />
                    </div>
                  )}
                  <h3>{service.name || 'Unnamed Service'}</h3>
                  <div className="service-details">
                    <span>MOQ: {service.moq || 'Contact for details'}</span>
                    <span>Lead Time: {service.leadTime || 'Contact for details'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-services-message">
                <p>No services have been added yet. Click "Edit Profile" to add your services.</p>
              </div>
            )}
          </div>
        )}
        <div className="capabilities-section">
          <h3>Specializations</h3>
          <div className="tags-container">
            {profileData.specializations && profileData.specializations.length > 0 ? (
              profileData.specializations.map((spec, index) => (
                <span key={index} className="tag">{spec}</span>
              ))
            ) : (
              <span className="empty-tag">No specializations added yet</span>
              )}
            </div>
          </div>
      </div>
    );
  };

  const renderClientsSection = () => {
    return (
      <div className="content-section">
        <h2>Our Clients</h2>
        {isEditing && userProfile.userType === 'vendor' ? (
          <form id="profileForm" onSubmit={handleSaveProfile} className="profile-form">
            <div className="clients-grid">
              {profileData.clientsList.map((client, index) => (
                <div key={index} className="client-item">
                  <div className="form-group">
                    <label>Client Name</label>
                    <input
                      type="text"
                      value={client.name || ''}
                      onChange={(e) => {
                        const updatedClientsList = [...profileData.clientsList];
                        updatedClientsList[index] = { 
                          ...client, 
                          name: e.target.value 
                        };
                        setProfileData({ ...profileData, clientsList: updatedClientsList });
                      }}
                      className="form-input"
                      placeholder="Enter client name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Client Logo (optional)</label>
                    <div className="client-logo-container">
                      {client.logo ? (
                        <div className="client-logo-preview">
                          <img 
                            src={client.logo} 
                            alt={client.name} 
                            className="client-logo-img"
                          />
            <button 
                            type="button"
                            onClick={() => {
                              handleClientLogoDelete(index);
                            }}
                            className="remove-image-button"
                          >
                            Remove Logo
            </button>
                        </div>
                      ) : client.isUploading ? (
                        <div className="client-upload-area loading">
                          <span className="loading-spinner"></span>
                          <span className="upload-text">Uploading...</span>
                        </div>
                      ) : (
                        <label className="client-upload-area">
                          <FaUpload className="upload-icon" />
                          <span className="upload-text">Upload Logo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                handleClientLogoUpload(index, file);
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
              <button 
                    type="button"
                    onClick={() => {
                      const updatedClientsList = profileData.clientsList.filter((_, i) => i !== index);
                      setProfileData({ ...profileData, clientsList: updatedClientsList });
                    }}
                    className="remove-client-button"
                  >
                    Remove Client
              </button>
                </div>
              ))}
            </div>
              <button 
              type="button"
              onClick={() => {
                setProfileData({
                  ...profileData,
                  clientsList: [
                    ...profileData.clientsList,
                    { name: '', logo: null }
                  ]
                });
              }}
              className="add-client-button"
            >
              Add New Client
              </button>
            <div className="button-group">
              <button type="button" onClick={handleEditToggle} className="cancel-button">
                Cancel
              </button>
              <button type="submit" className="save-button">
                {isLoading ? <span className="loading-spinner"></span> : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {profileData.clientsList && profileData.clientsList.length > 0 ? (
              <div className="clients-display-grid">
                {profileData.clientsList.map((client, index) => (
                  <div key={index} className="client-card">
                    {client.logo ? (
                      <div className="client-logo">
                        <img src={client.logo} alt={client.name} />
                      </div>
                    ) : (
                      <div className="client-icon">
                        <FaStore />
                      </div>
                    )}
                    <div className="client-info">
                      <h3>{client.name}</h3>
          </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-clients-message">
                <p>No clients have been added yet. Click "Edit Profile" to add your clients.</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderCompanyInfoSection = () => {
    return (
              <div className="content-section">
                {isEditing ? (
                  <form id="profileForm" onSubmit={handleSaveProfile} className="profile-form">
                    <div className="form-section">
                      <h3>Basic Information</h3>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Location</label>
                          <input
                            type="text"
                            value={profileData.address}
                            onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                            className="form-input"
                            placeholder="Enter business address"
                          />
                        </div>
                        <div className="form-group">
                          <label>Phone Number</label>
                          <input
                            type="tel"
                            value={profileData.phoneNumber}
                            onChange={(e) => setProfileData({...profileData, phoneNumber: e.target.value})}
                            className="form-input"
                            placeholder="Enter phone number"
                          />
                        </div>
                        <div className="form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            value={profileData.email}
                            onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                            className="form-input"
                            placeholder="Enter email"
                          />
                        </div>
                        <div className="form-group">
                          <label>Website</label>
                          <input
                            type="url"
                            value={profileData.website}
                            onChange={(e) => setProfileData({...profileData, website: e.target.value})}
                            className="form-input"
                            placeholder="Enter website URL"
                          />
                        </div>
                        <div className="form-group">
                          <label>Niche</label>
                          <select
                            value={profileData.niche || ''}
                            onChange={(e) => setProfileData({...profileData, niche: e.target.value})}
                            className="form-input"
                          >
                            <option value="">Select a niche</option>
                            {BRAND_NICHES.map((niche) => (
                              <option key={niche} value={niche}>
                                {niche}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <h3>Social Media</h3>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Instagram</label>
                          <input
                            type="text"
                            value={profileData.socialMedia.instagram}
                            onChange={(e) => setProfileData({
                              ...profileData,
                              socialMedia: {
                                ...profileData.socialMedia,
                                instagram: e.target.value
                              }
                            })}
                            className="form-input"
                            placeholder="Enter Instagram handle"
                          />
                        </div>
                        <div className="form-group">
                          <label>TikTok</label>
                          <input
                            type="text"
                            value={profileData.socialMedia.tiktok}
                            onChange={(e) => setProfileData({
                              ...profileData,
                              socialMedia: {
                                ...profileData.socialMedia,
                                tiktok: e.target.value
                              }
                            })}
                            className="form-input"
                            placeholder="Enter TikTok handle"
                          />
                        </div>
                        <div className="form-group">
                          <label>Facebook</label>
                          <input
                            type="text"
                            value={profileData.socialMedia.facebook}
                            onChange={(e) => setProfileData({
                              ...profileData,
                              socialMedia: {
                                ...profileData.socialMedia,
                                facebook: e.target.value
                              }
                            })}
                            className="form-input"
                            placeholder="Enter Facebook page URL"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <h3>About Us</h3>
                      <div className="form-group">
                        <textarea
                          value={profileData.bio}
                          onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                          className="form-input"
                          rows="4"
                          placeholder="Tell us about your brand..."
                        />
                      </div>
                    </div>

                    <div className="button-group">
                      <button type="button" onClick={handleEditToggle} className="cancel-button">
                        Cancel
                      </button>
                      <button type="submit" className="save-button">
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h2>Overview</h2>
                    <div className="info-grid">
                      <div className="info-card">
                        <FaMapMarkerAlt />
                        <h3>Location</h3>
                        <p>{userProfile?.address || 'Add your address'}</p>
                      </div>
                      <div className="info-card">
                        <FaPhone />
                        <h3>Contact</h3>
                        <p>{userProfile?.phoneNumber || 'Add phone number'}</p>
                      </div>
                      <div className="info-card">
                        <FaGlobe />
                        <h3>Website</h3>
                        <p style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%'
                        }}>
                          <a 
                            href={userProfile?.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                    {userProfile?.website || 'Add website URL'}
                          </a>
                        </p>
                      </div>
                        <div className="info-card">
                <FaEnvelope />
                <h3>Email</h3>
                <p>{userProfile?.email || 'Add email'}</p>
                        </div>
                    </div>

                    <div className="company-description">
                      <h3>About Us</h3>
                      <p>{userProfile?.bio || 'Add a description of your company and services...'}</p>
                    </div>
                  </>
                )}
              </div>
    );
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user || !userProfile) {
    return <div className="error">No profile data found</div>;
  }

  return (
    <div className="dashboard">
      {!hideNavigation && (
        <div className="dashboard-sidebar">
          <div className="sidebar-menu">
            <button
              className={`menu-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <FaUserCircle /> Profile
            </button>
            <button
              className={`menu-item ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => setActiveTab('products')}
            >
              <FaStore /> Products
            </button>
            <button
              className={`menu-item ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              <FaHeart /> Favorites
            </button>
            <div className="menu-divider"></div>
            <button 
              className={`menu-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <FaBell /> Notifications
            </button>
            <button
              className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <FaCog /> Settings
            </button>
                </div>
              </div>
            )}

      <div className="dashboard-main">
        <div className="profile-container">
          {/* Company Information Section */}
          <div className="profile-header">
            <div className="profile-cover">
              {profileData.banner && <img src={profileData.banner} alt="Profile Banner" className="banner-image" />}
              
              <div className="company-logo">
                <div className="logo-edit">
                  {profileData.logo ? (
                    <div className="logo-preview">
                                  <img 
                        src={profileData.logo} 
                        alt="" 
                        className="logo-image"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                  />
                      {isEditing && (
                                  <button
                                    type="button"
                          onClick={handleLogoDelete}
                                    className="remove-image-button"
                                  >
                          Remove Logo
                                  </button>
                      )}
                                </div>
                  ) : isEditing ? (
                    <label className="logo-upload">
                                  <FaUpload className="upload-icon" />
                      <span className="upload-text">Upload Logo</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                            handleLogoUpload(file);
                                      }
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                </label>
                  ) : null}
                            </div>
                          </div>
                        </div>
            <div className="profile-quick-info">
              {isEditing ? (
                <div className="quick-info-edit">
                  <input
                    type="text"
                    value={profileData.companyName}
                    onChange={(e) => setProfileData({...profileData, companyName: e.target.value})}
                    className="company-name-input"
                    placeholder="Enter Company Name"
                  />
                  {userProfile?.userType === 'vendor' && (
                    <div className="rating-badge">
                      <FaStar /> 4.8 (24 reviews)
                    </div>
                          )}
                        </div>
              ) : (
                <>
                  <h1>{profileData?.companyName || 'Company Name'}</h1>
                  {userProfile?.userType === 'vendor' && (
                    <div className="rating-badge">
                      <FaStar /> 4.8 (24 reviews)
                    </div>
                  )}

                  {/* Contact Icons - Moved under company name */}
                  <div className="contact-icons-row">
                    {profileData.address && (
                      <a 
                        href={`https://maps.google.com/?q=${encodeURIComponent(profileData.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contact-icon"
                      >
                        <FaMapMarkerAlt />
                        <span className="contact-tooltip">{profileData.address}</span>
                      </a>
                    )}
                    {profileData.phoneNumber && (
                      <a 
                        href={`tel:${profileData.phoneNumber}`}
                        className="contact-icon"
                      >
                        <FaPhone />
                        <span className="contact-tooltip">{profileData.phoneNumber}</span>
                      </a>
                    )}
                    {profileData.website && (
                      <a 
                        href={profileData.website.startsWith('http') ? profileData.website : `https://${profileData.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contact-icon"
                      >
                        <FaGlobe />
                        <span className="contact-tooltip">{profileData.website}</span>
                      </a>
                    )}
                    {/* Social media icon - added force display */}
                    <a 
                      href={
                        profileData.socialMedia?.instagram 
                          ? `https://instagram.com/${profileData.socialMedia.instagram}` 
                          : profileData.socialMedia?.tiktok 
                            ? `https://tiktok.com/@${profileData.socialMedia.tiktok}` 
                            : profileData.socialMedia?.facebook || "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-icon social-icon"
                      onClick={(e) => {
                        if (!profileData.socialMedia?.instagram && !profileData.socialMedia?.tiktok && !profileData.socialMedia?.facebook) {
                          e.preventDefault();
                          alert("No social media links have been added yet. Edit profile to add social media.");
                        }
                      }}
                    >
                      <FaShareAlt />
                      <span className="contact-tooltip">Social Media</span>
                    </a>
                  </div>
                </>
              )}
              {isEditing ? (
                <button type="submit" form="profileForm" className="edit-profile-btn">
                  {isLoading ? (
                    <span className="loading-spinner"></span>
                ) : (
                  <>
                      <FaEdit /> Save Profile
                    </>
                  )}
                </button>
              ) : (
                <button className="edit-profile-btn" onClick={handleEditToggle}>
                  <FaEdit /> Edit Profile
                </button>
              )}
                              </div>
                        </div>

          {/* Profile Navigation */}
          <div className="profile-nav">
            <button 
              className={activeSection === 'company' ? 'active' : ''} 
              onClick={() => setActiveSection('company')}
            >
              Overview
                          </button>
            {userProfile?.userType === 'vendor' && (
              <button 
                className={activeSection === 'services' ? 'active' : ''} 
                onClick={() => setActiveSection('services')}
              >
                Services
                          </button>
            )}
            {userProfile?.userType === 'vendor' && (
              <button 
                className={activeSection === 'portfolio' ? 'active' : ''} 
                onClick={() => setActiveSection('portfolio')}
              >
                Portfolio
              </button>
            )}
            {userProfile?.userType === 'vendor' && (
              <button 
                className={activeSection === 'clients' ? 'active' : ''} 
                onClick={() => setActiveSection('clients')}
              >
                Our Clients
              </button>
            )}
            {userProfile?.userType === 'vendor' && (
              <button 
                className={activeSection === 'reviews' ? 'active' : ''} 
                onClick={() => setActiveSection('reviews')}
              >
                Reviews
              </button>
            )}
          </div>

          {/* Main Content Area */}
          <div className="profile-content">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 

<style jsx>{`
  .company-logo {
    position: relative;
    width: 150px;
    height: 150px;
    border-radius: 12px;
    overflow: hidden;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 20px auto;
    border: 3px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .logo-edit {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .logo-preview {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .logo-preview .remove-image-button {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    padding: 8px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.3s;
    opacity: 0;
  }

  .logo-preview:hover .remove-image-button {
    opacity: 1;
  }

  .logo-upload {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: #ffffff;
    transition: background 0.3s;
  }

  .logo-upload:hover {
    background: #f0f0f0;
  }

  .upload-icon {
    font-size: 24px;
    color: #666;
    margin-bottom: 8px;
  }

  .upload-text {
    font-size: 14px;
    color: #666;
    text-align: center;
  }

  .logo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
  }

  .logo-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-upload-container {
    width: 100%;
    margin-top: 8px;
  }

  .portfolio-upload-area {
    width: 100%;
    height: 200px;
    border: 2px dashed #ccc;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: #f8f9fa;
    transition: all 0.3s ease;
  }

  .portfolio-upload-area:hover {
    border-color: #666;
    background: #f0f0f0;
  }

  .portfolio-upload-area .upload-icon {
    font-size: 32px;
    color: #666;
    margin-bottom: 12px;
  }

  .portfolio-upload-area .upload-text {
    font-size: 16px;
    color: #666;
    text-align: center;
  }

  .portfolio-image-preview {
    width: 100%;
    height: 300px;
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: white;
    padding: 16px;
  }

  .portfolio-image-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .portfolio-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
    margin-top: 24px;
  }

  .portfolio-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    height: 400px; /* Fixed height for consistent cards */
    display: flex;
    flex-direction: column;
  }

  .portfolio-image {
    flex: 1;
    position: relative;
    background: #f5f5f5;
    overflow: hidden;
    min-height: 0; /* Allow image to scale within container */
  }

  .portfolio-image img {
    width: 100%;
    height: 100%;
    object-fit: contain; /* Changed from cover to contain */
    position: absolute;
    top: 0;
    left: 0;
    padding: 16px; /* Add some padding around the image */
    background: white;
  }

  .portfolio-info {
    padding: 1rem;
    background: white;
    border-top: 1px solid #eee;
  }

  .portfolio-info h3 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    color: #333;
  }
  
  .portfolio-info p {
    margin: 0;
    font-size: 0.9rem;
    color: #666;
  }

  .add-portfolio-card {
    border: 2px dashed #ddd;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px; /* Match the height of portfolio cards */
    cursor: pointer;
    transition: all 0.3s ease;
    background: #f8f9fa;
  }

  .add-portfolio-card:hover {
    border-color: #999;
    background: #f0f0f0;
  }

  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin: 2rem 0;
    padding: 1rem;
  }

  .service-card {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .service-icon {
    width: 100px;
    height: 100px;
    background: linear-gradient(135deg, #FF69B4, #9B5DE5);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
    box-shadow: 0 4px 15px rgba(155, 93, 229, 0.3);
  }

  .service-icon svg {
    font-size: 2.5rem;
    color: white;
  }

  .service-card h3 {
    margin: 0 0 1rem;
    color: white !important;
    font-size: 1.5rem;
    font-weight: 600;
    background: linear-gradient(45deg, #FF69B4, #9B5DE5);
    border-radius: 12px;
    padding: 0.7rem;
    box-shadow: 0 2px 6px rgba(155, 93, 229, 0.3);
  }

  .service-card p {
    color: #666;
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .service-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: #666;
    font-size: 0.9rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
    width: 100%;
  }

  .service-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  }

  .service-details span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #555;
    font-weight: 500;
  }

  .capabilities-section {
    margin-top: 3rem;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1rem;
  }

  .tag {
    background: #f0f0f0;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    color: #666;
  }

  .dashboard {
    display: flex;
    min-height: 100vh;
    background: #f8f9fa;
  }

  .dashboard-sidebar {
    width: 250px;
    background: white;
    padding: 2rem 1rem;
    border-right: 1px solid #eee;
  }

  .dashboard-main {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
  }

  /* Remove notification counter styles */
  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    color: #666;
    text-decoration: none;
    transition: all 0.3s ease;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }

  .menu-item:hover {
    background: #f0f0f0;
    color: #333;
  }

  .menu-item.active {
    background: #9B5DE5;
    color: white;
  }

  .menu-divider {
    height: 1px;
    background: #eee;
    margin: 1rem 0;
  }
`}</style> 