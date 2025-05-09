import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './Profile.css'; // Make sure we're using the proper styling
import { VENDOR_CATEGORIES } from '../constants/categories';
import { geocodeAddress } from '../utils/geocodeAddress';

const ProfileEdit = () => {
  const { user, userProfile, setUserProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !userProfile)) {
      navigate('/profile');
    }
  }, [user, userProfile, loading, navigate]);

  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    userType: '',
    categories: [],
    bio: '',
    address: '',
    phoneNumber: '',
    website: '',
    moq: '',
    clients: ''
  });

  useEffect(() => {
    if (userProfile) {
      console.log('Initial userProfile:', userProfile);
      setFormData({
        companyName: userProfile.companyName || '',
        email: userProfile.email || '',
        userType: userProfile.userType || '',
        categories: userProfile.categories || [],
        bio: userProfile.bio || '',
        address: userProfile.address || '',
        phoneNumber: userProfile.phoneNumber || '',
        website: userProfile.website || '',
        moq: userProfile.moq || '',
        clients: userProfile.clients || ''
      });
    }
  }, [userProfile]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      // First get coordinates from the address
      const locationData = await geocodeAddress(formData.address);
      
      const vendorRef = doc(db, 'vendors', user.uid);
      const updatedData = {
        ...formData,
        location: {
          lat: locationData.lat,
          lng: locationData.lng,
          address: locationData.address
        },
        // Add fields needed for map display
        coordinates: {
          lat: locationData.lat,
          lng: locationData.lng
        },
        isActive: true,  // Flag to show on map
        updatedAt: new Date().toISOString()
      };

      console.log('Updating vendor profile:', updatedData);
      await updateDoc(vendorRef, updatedData);
      setUserProfile(updatedData);
      
      navigate('/profile');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCategoryChange = (category) => {
    setFormData(prevData => {
      const currentCategories = prevData.categories || [];
      const updatedCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category];
      
      return {
        ...prevData,
        categories: updatedCategories
      };
    });
  };

  return (
    <div className="profile-page" style={{ background: '#f8f9fa' }}>
      <div className="profile-section" style={{ marginBottom: '0' }}>
        <div className="section-header">
          <h2>Edit Profile</h2>
        </div>
        
        <div className="profile-content">
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Business Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={(e) => setFormData({...formData, website: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Business Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Categories *</label>
              {VENDOR_CATEGORIES.map(category => (
                <div key={category} className="category-checkbox">
                  <input
                    type="checkbox"
                    id={category}
                    checked={formData.categories?.includes(category)}
                    onChange={() => handleCategoryChange(category)}
                  />
                  <label htmlFor={category}>{category} *</label>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>Minimum Order Quantity (MOQ) *</label>
              <input
                type="text"
                name="moq"
                value={formData.moq}
                onChange={(e) => setFormData({...formData, moq: e.target.value})}
                className="form-input"
                placeholder="Enter minimum order quantity"
              />
            </div>

            <div className="form-group">
              <label>Notable Clients *</label>
              <textarea
                name="clients"
                value={formData.clients}
                onChange={(e) => setFormData({...formData, clients: e.target.value})}
                className="form-input"
                rows="3"
                placeholder="List your notable clients"
              />
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="form-input"
                rows="4"
                placeholder="Tell us about your business"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="button-group">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="save-button"
              >
                {formLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit; 