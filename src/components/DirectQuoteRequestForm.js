import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { FaPlus, FaMinus, FaUpload } from 'react-icons/fa';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
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

const DirectQuoteRequestForm = ({ onClose, vendorId, conversationId }) => {
  const { user, userProfile } = useAuth();
  const [services, setServices] = useState([{ service: '', quantities: {} }]);
  const [deadline, setDeadline] = useState(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [mockupFiles, setMockupFiles] = useState([]);
  const [sourceFiles, setSourceFiles] = useState([]);

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

  const handleQuantityChange = (serviceIndex, size, value) => {
    const newServices = [...services];
    newServices[serviceIndex].quantities[size] = parseInt(value) || 0;
    setServices(newServices);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // First create the quote request
      const quoteRequest = {
        brandId: user.uid,
        brandName: userProfile.companyName,
        brandEmail: userProfile.email,
        brandPhone: userProfile.phoneNumber,
        vendorId: vendorId,
        conversationId: conversationId,
        services: services,
        deadline: deadline,
        additionalInfo: additionalInfo,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        type: 'direct'
      };

      // Create a batch for atomic operations
      const batch = writeBatch(db);

      // Add the quote request
      const quoteRef = doc(collection(db, 'quoteRequests'));
      batch.set(quoteRef, quoteRequest);

      // Create a message about the quote in the conversation
      const messageRef = doc(collection(db, 'messages'));
      batch.set(messageRef, {
        conversationId: conversationId,
        senderId: user.uid,
        senderName: userProfile.companyName,
        recipientId: vendorId,
        type: 'quote',
        content: 'Sent a quote request',
        quoteId: quoteRef.id, // Reference to the quote
        services: services,
        timestamp: serverTimestamp(),
        readBy: [user.uid]
      });

      // Update the conversation's last message
      const conversationRef = doc(db, 'conversations', conversationId);
      batch.update(conversationRef, {
        lastMessage: 'Sent a quote request',
        lastMessageAt: serverTimestamp()
      });

      // Commit all operations
      await batch.commit();
      onClose();
      alert('Quote request sent successfully!');
    } catch (error) {
      console.error('Error submitting quote request:', error);
      alert('Failed to submit quote request. Please try again.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request a Quote</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="quote-request-form">
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

                {/* Size Breakdown */}
                <div className="size-breakdown">
                  <h5>Size Breakdown</h5>
                  <div className="sizes-grid">
                    {SIZES.map((size) => (
                      <div key={size} className="size-input">
                        <label>{size}</label>
                        <input
                          type="number"
                          min="0"
                          value={service.quantities[size] || ''}
                          onChange={(e) => handleQuantityChange(index, size, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
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

          {/* Deadline Section */}
          <div className="deadline-section">
            <h4>Deadline</h4>
            <DatePicker
              selected={deadline}
              onChange={(date) => setDeadline(date)}
              minDate={new Date()}
              placeholderText="Select deadline (if applicable)"
              className="deadline-picker"
            />
          </div>

          {/* File Upload Section */}
          <div className="file-upload-section">
            <h4>Project Files</h4>
            <div className="upload-container">
              <div className="upload-group">
                <label>Mockups / Tech Packs</label>
                <div className="file-upload">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setMockupFiles(Array.from(e.target.files))}
                  />
                  <FaUpload /> Upload Files
                </div>
                {mockupFiles.length > 0 && (
                  <div className="file-list">
                    {mockupFiles.map((file, index) => (
                      <div key={index} className="file-item">{file.name}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="upload-group">
                <label>Source Files</label>
                <div className="file-upload">
                  <input
                    type="file"
                    multiple
                    accept=".ai,.psd,.png,.pdf"
                    onChange={(e) => setSourceFiles(Array.from(e.target.files))}
                  />
                  <FaUpload /> Upload Files
                </div>
                {sourceFiles.length > 0 && (
                  <div className="file-list">
                    {sourceFiles.map((file, index) => (
                      <div key={index} className="file-item">{file.name}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="additional-info-section">
            <h4>Additional Information</h4>
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Add any additional details about your project..."
              rows="4"
            />
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-btn" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-btn"
            >
              Send Quote Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DirectQuoteRequestForm; 