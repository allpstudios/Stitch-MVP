import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './QuoteRequestForm.css';

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

const QuoteRequestForm = ({ onClose, vendorName, vendorId }) => {
  const { user, userProfile } = useAuth();
  const [services, setServices] = useState([{ name: '', quantities: {} }]);
  const [deadline, setDeadline] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleServiceAdd = () => {
    setServices([...services, { name: '', quantities: {} }]);
  };

  const handleServiceRemove = (index) => {
    const newServices = services.filter((_, i) => i !== index);
    setServices(newServices);
  };

  const handleServiceChange = (index, value) => {
    const newServices = [...services];
    newServices[index].name = value;
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
      const quoteRequest = {
        // Brand information
        brandId: user.uid,
        brandName: userProfile.companyName,
        brandEmail: user.email,
        
        // Vendor information
        vendorId: vendorId,
        vendorName: vendorName,
        
        // Quote details
        services: services.map(service => ({
          name: service.name,
          quantities: service.quantities
        })),
        totalQuantity: parseInt(totalQuantity),
        deadline: deadline,
        additionalNotes: additionalNotes,
        
        // Status and timestamps
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'quoteRequests'), quoteRequest);
      onClose();
      alert('Quote request sent successfully!');
    } catch (error) {
      console.error('Error submitting quote request:', error);
      alert('Failed to submit quote request. Please try again.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>New Quote Request</h2>
          <h3>{vendorName}</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="services-section">
            <h3>Services Required</h3>
            {services.map((service, index) => (
              <div key={index} className="service-container">
                <div className="service-header">
                  <select
                    value={service.name}
                    onChange={(e) => handleServiceChange(index, e.target.value)}
                    required
                  >
                    <option value="">Select a service</option>
                    {SERVICES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => handleServiceRemove(index)}
                      className="remove-service-btn"
                    >
                      Remove
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
              + Add Another Service
            </button>
          </div>

          <div className="order-quantities">
            <h3>Order Quantities</h3>
            <div className="total-quantity">
              <label>Total Quantity Required</label>
              <input
                type="number"
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value)}
                placeholder="Enter total quantity needed"
                required
              />
            </div>

            <div className="size-breakdown">
              <label>Size Breakdown (if applicable)</label>
              <div className="size-grid">
                {SIZES.map((size) => (
                  <div key={size} className="size-input">
                    <label>{size}</label>
                    <input
                      type="number"
                      placeholder="0"
                      onChange={(e) => handleQuantityChange(0, size, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="deadline-section">
            <h3>Deadline (if applicable)</h3>
            <input
              type="date"
              className="deadline-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="additional-notes">
            <h3>Additional Notes</h3>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Add any additional details or requirements..."
              rows={4}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Submit Quote Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuoteRequestForm; 