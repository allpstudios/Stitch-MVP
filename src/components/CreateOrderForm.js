import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import './CreateOrderForm.css';

const CreateOrderForm = ({ onClose, conversationId }) => {
  const { user, userProfile } = useAuth();
  const [formData, setFormData] = useState({
    productType: '',
    quantity: '',
    budget: '',
    description: '',
    timeline: '',
    services: {}
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const orderData = {
        ...formData,
        vendorId: user.uid,
        vendorName: userProfile.companyName,
        conversationId,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), orderData);
      onClose();
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Order</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="order-form">
          <div className="form-group">
            <label>Product Type</label>
            <input
              type="text"
              name="productType"
              value={formData.productType}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Quantity</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Budget</label>
            <input
              type="number"
              name="budget"
              value={formData.budget}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Timeline</label>
            <input
              type="text"
              name="timeline"
              value={formData.timeline}
              onChange={handleChange}
              required
              placeholder="e.g., 2 weeks, 1 month"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="4"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Create Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrderForm; 