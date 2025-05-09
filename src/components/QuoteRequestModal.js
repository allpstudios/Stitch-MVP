import React, { useState, useEffect } from 'react';
import Portal from './Portal';
import { useAuth } from '../context/AuthContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { FaUpload, FaPlus, FaMinus, FaSearch } from 'react-icons/fa';
import './QuoteRequestModal.css';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const SERVICES = [
  'Screen printing',
  'DTG printing',
  'DTF printing',
  'Embroidery',
  'Cut and Sew Manufacturing',
  'Custom Patches',
  'Custom Rhinestone',
  'Garment Dye',
  'Sampling',
  'Pattern Making',
  'Custom Labels'
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const QuoteRequestModal = ({ onClose, onSubmit, vendorName, initialData, isEditing }) => {
  const { userProfile } = useAuth();
  const [services, setServices] = useState([{ service: initialData?.service || '', quantities: {} }]);
  const [deadline, setDeadline] = useState(null);
  const [additionalInfo, setAdditionalInfo] = useState(initialData?.description || '');
  const [mockupFiles, setMockupFiles] = useState([]);
  const [sourceFiles, setSourceFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [deliveryMethod, setDeliveryMethod] = useState('shipping');
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(vendorName ? { companyName: vendorName } : null);
  const [isSearching, setIsSearching] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Add vendor search functionality
  useEffect(() => {
    const searchVendors = async () => {
      // Show all vendors if input is focused but empty, or filter by search term if provided
      if (isInputFocused || searchTerm) {
        setIsSearching(true);
        try {
          // Fetch all vendors without query filters
          const vendorsRef = collection(db, 'vendors');
          const vendorsSnapshot = await getDocs(vendorsRef);
          
          // Process vendors similar to Map component
          const vendorsList = vendorsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              uid: doc.id,
              companyName: data.companyName || data.vendorName,
              profileImage: data.logo || '',
              categories: data.categories || [],
              location: data.location || { address: data.address },
              phoneNumber: data.phoneNumber,
              email: data.email,
              website: data.website,
              moq: data.moq,
              clients: data.clients,
              description: data.description || data.bio || data.notes,
            };
          });

          // Only filter vendors if there's a search term
          const filteredVendors = searchTerm ? vendorsList.filter(vendor => 
            vendor.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vendor.categories?.some(category => 
              category.toLowerCase().includes(searchTerm.toLowerCase())
            ) ||
            vendor.location?.address?.toLowerCase().includes(searchTerm.toLowerCase())
          ) : vendorsList;

          console.log('Found vendors:', filteredVendors);
          setSearchResults(filteredVendors);
        } catch (error) {
          console.error('Error searching vendors:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const debounceTimer = setTimeout(searchVendors, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, isInputFocused]);

  const handleServiceAdd = () => {
    setServices([...services, { service: '', quantities: {} }]);
  };

  const handleServiceRemove = (index) => {
    const newServices = services.filter((_, i) => i !== index);
    setServices(newServices);
  };

  const handleServiceChange = (index, value) => {
    const newServices = [...services];
    newServices[index].service = value;
    setServices(newServices);
  };

  const handleQuantityChange = (index, size, value) => {
    const newServices = [...services];
    newServices[index].quantities[size] = value;
    setServices(newServices);
  };

  const handleFileChange = (e, fileType) => {
    const files = Array.from(e.target.files);
    if (fileType === 'mockup') {
      setMockupFiles([...mockupFiles, ...files]);
    } else {
      setSourceFiles([...sourceFiles, ...files]);
    }
  };

  const handleFileRemove = (index, fileType) => {
    if (fileType === 'mockup') {
      setMockupFiles(mockupFiles.filter((_, i) => i !== index));
    } else {
      setSourceFiles(sourceFiles.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Upload files first
      const storage = getStorage();
      const uploadFile = async (file, index, type) => {
        const fileRef = ref(storage, `quotes/${userProfile.uid}/${Date.now()}-${file.name}`);
        
        try {
          const snapshot = await uploadBytes(fileRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          
          // Update progress
          setUploadProgress(prev => ({
            ...prev,
            [`${type}-${index}`]: 100
          }));

          return {
            name: file.name,
            downloadURL: downloadURL,
            type: file.type,
            size: file.size
          };
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          throw error;
        }
      };

      // Upload all files concurrently
      const mockupUploads = await Promise.all(
        mockupFiles.map((file, index) => uploadFile(file, index, 'mockup'))
      );

      const sourceUploads = await Promise.all(
        sourceFiles.map((file, index) => uploadFile(file, index, 'source'))
      );

      // Calculate total quantity
      const totalQuantity = Object.values(services[0].quantities)
        .reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);

      const quoteData = {
        type: 'quote',
        quoteDetails: {
          serviceRequired: services[0].service,
          quantity: totalQuantity,
          timeline: deadline ? `Needed by: ${deadline.toLocaleDateString()}` : 'Standard Turnaround Time',
          projectDescription: additionalInfo,
          quantities: {
            XS: services[0].quantities.XS || "0",
            S: services[0].quantities.S || "0",
            M: services[0].quantities.M || "0",
            L: services[0].quantities.L || "0",
            XL: services[0].quantities.XL || "0",
            "2XL": services[0].quantities['2XL'] || "0",
            "3XL": services[0].quantities['3XL'] || "0"
          },
          mockupFiles: mockupUploads,
          sourceFiles: sourceUploads,
          date: new Date().toISOString(),
          status: 'pending',
          deliveryMethod,
          shippingAddress: deliveryMethod === 'shipping' ? shippingAddress : null
        },
      };

      // Add selected vendor information if available
      if (selectedVendor) {
        quoteData.selectedVendor = {
          id: selectedVendor.id,
          companyName: selectedVendor.companyName
        };
      }

      await onSubmit(quoteData);
      onClose();
    } catch (error) {
      console.error('Error submitting quote:', error);
      alert('Failed to submit quote request');
    }
  };

  // Add this to show upload progress
  const renderUploadProgress = (files, type) => {
    return files.map((file, index) => {
      const progress = uploadProgress[`${type}-${index}`] || 0;
      return (
        <div key={`${type}-${index}`} className="file-upload-progress">
          <span>{file.name}</span>
          <div className="progress-bar">
            <div 
              className="progress" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      );
    });
  };

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="quote-modal enhanced" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{isEditing ? 'Edit Quote Request' : 'New Quote Request'}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          {/* Brand Information Header */}
          <div className="brand-info-header">
            <h3>{userProfile?.companyName}</h3>
            <p>{userProfile?.shippingAddress}</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Vendor Selection Section */}
            {!vendorName && (
              <div className="vendor-search-section">
                <div className="search-container">
                  <input
                    type="text"
                    className="vendor-search-input"
                    placeholder="Search vendors or click to see all..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => {
                      // Small delay to allow for vendor selection click
                      setTimeout(() => setIsInputFocused(false), 200);
                    }}
                  />
                  {isSearching && <div className="searching-indicator">Searching...</div>}
                </div>
                {searchResults.length > 0 && (
                  <div className="vendor-results">
                    {searchResults.map((vendor) => (
                      <div
                        key={vendor.id}
                        className="vendor-result-item"
                        onClick={() => {
                          setSelectedVendor(vendor);
                          setSearchTerm('');
                          setSearchResults([]);
                        }}
                      >
                        <div className="vendor-info">
                          <strong>{vendor.companyName}</strong>
                          {vendor.location?.address && (
                            <span className="vendor-location">{vendor.location.address}</span>
                          )}
                          {vendor.categories && vendor.categories.length > 0 && (
                            <span className="vendor-categories">
                              {vendor.categories.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedVendor && (
              <div className="selected-vendor">
                <h5>Selected Vendor</h5>
                <div className="vendor-details">
                  <p><strong>Company:</strong> {selectedVendor.companyName}</p>
                  {selectedVendor.location?.address && (
                    <p><strong>Location:</strong> {selectedVendor.location.address}</p>
                  )}
                  {selectedVendor.categories && selectedVendor.categories.length > 0 && (
                    <p><strong>Services:</strong> {selectedVendor.categories.join(', ')}</p>
                  )}
                  {selectedVendor.description && (
                    <p><strong>Description:</strong> {selectedVendor.description}</p>
                  )}
                </div>
              </div>
            )}

            {/* Services Section */}
            <div className="services-section">
              <h4>Services Required</h4>
              {services.map((service, index) => (
                <div key={index} className="service-container">
                  <div className="service-header">
                    <select
                      value={service.service}
                      onChange={(e) => handleServiceChange(index, e.target.value)}
                      required
                    >
                      <option value="">Select a service</option>
                      {SERVICES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="other">Other (specify)</option>
                    </select>
                    {services.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleServiceRemove(index)}
                        className="remove-service-btn"
                      >
                        <FaMinus />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={handleServiceAdd}
                className="add-service-btn"
              >
                <FaPlus /> Add Another Service
              </button>
            </div>

            {/* Order Quantities Section */}
            <div className="order-quantities-section">
              {/* Size Breakdown */}
              <div className="size-breakdown-section">
                <h5>Size Breakdown</h5>
                <div className="sizes-grid">
                  {SIZES.map((size) => (
                    <div key={size} className="size-input">
                      <label>{size}</label>
                      <input
                        type="number"
                        min="0"
                        value={services[0].quantities[size] || ''}
                        onChange={(e) => handleQuantityChange(0, size, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Quantity Field */}
              <div className="total-quantity">
                <label>Total Quantity Required</label>
                <input
                  type="number"
                  min="0"
                  value={services[0].totalQuantity || ''}
                  onChange={(e) => {
                    const newServices = [...services];
                    newServices[0].totalQuantity = e.target.value;
                    setServices(newServices);
                  }}
                  placeholder="Enter total quantity needed"
                />
              </div>
            </div>

            {/* Deadline Section */}
            <div className="form-group">
              <label>Deadline (if applicable)</label>
              <DatePicker
                selected={deadline}
                onChange={(date) => setDeadline(date)}
                minDate={new Date()}
                placeholderText="Select deadline"
                className="form-input"
              />
            </div>

            {/* File Upload Section */}
            <div className="file-upload-section">
              <div className="upload-group">
                <h4>Mockup Files</h4>
                <div className="file-upload">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileChange(e, 'mockup')}
                    accept="image/*,.pdf,.ai,.psd"
                  />
                  <FaUpload /> Drop files or click to upload
                </div>
                {mockupFiles.length > 0 && (
                  <div className="file-list">
                    {renderUploadProgress(mockupFiles, 'mockup')}
                  </div>
                )}
              </div>

              <div className="upload-group">
                <h4>Source Files</h4>
                <div className="file-upload">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileChange(e, 'source')}
                    accept="image/*,.pdf,.ai,.psd"
                  />
                  <FaUpload /> Drop files or click to upload
                </div>
                {sourceFiles.length > 0 && (
                  <div className="file-list">
                    {renderUploadProgress(sourceFiles, 'source')}
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Section */}
            <div className="shipping-section">
              <h4>Delivery Method</h4>
              <div className="delivery-options">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="shipping"
                    checked={deliveryMethod === 'shipping'}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                  />
                  <span>Shipping</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="pickup"
                    checked={deliveryMethod === 'pickup'}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                  />
                  <span>Pickup in LA</span>
                </label>
              </div>

              {/* Show shipping address form only if shipping is selected */}
              {deliveryMethod === 'shipping' && (
                <div className="shipping-address">
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Street Address"
                      value={shippingAddress.street}
                      onChange={(e) => setShippingAddress(prev => ({...prev, street: e.target.value}))}
                    />
                  </div>
                  <div className="address-row">
                    <div className="form-group">
                      <input
                        type="text"
                        placeholder="City"
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress(prev => ({...prev, city: e.target.value}))}
                      />
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        placeholder="State"
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({...prev, state: e.target.value}))}
                      />
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        placeholder="ZIP Code"
                        value={shippingAddress.zip}
                        onChange={(e) => setShippingAddress(prev => ({...prev, zip: e.target.value}))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Information */}
            <div className="form-group">
              <label>Additional Information</label>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Add any additional details about your project..."
                rows="4"
                className="form-input"
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="submit-btn">
                {isEditing ? 'Update Quote Request' : 'Send Quote Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default QuoteRequestModal; 