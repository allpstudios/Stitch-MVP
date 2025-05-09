import React, { useState, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import './CreateOrder.css';
import { FaPlus, FaMinus, FaTimes, FaTrash } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { serverTimestamp } from 'firebase/firestore';
import { createMessageThread } from '../services/MessageService';

const CreateOrder = ({ onClose, vendorId, customerId, customerName, onSubmit }) => {
  const { createOrder } = useOrders();
  const { user, userProfile } = useAuth();
  const location = useLocation();
  const quoteData = location.state?.quoteData;
  const navigate = useNavigate();

  const initialFormData = {
    customer: {
      name: '',
      email: '',
      phone: '',
      company: '',
      id: ''
    },
    items: [
      {
        description: '',
        rate: 0,
        quantity: 1,
        amount: 0,
        taxable: false,
        details: ''
      }
    ],
    shipping: {
      address: {
        street: '',
        city: '',
        state: '',
        zip: ''
      },
      method: 'UPS Ground'
    },
    orderDetails: {
      serviceType: '',
      timeline: '',
      sizeBreakdown: {},
      attachedFiles: [],
      projectDescription: ''
    }
  };

  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (quoteData) {
      console.log('Processing quote data:', quoteData);
      
      const totalQuantity = Object.values(quoteData.sizeBreakdown || {})
        .reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);

      const lineItems = [{
        description: quoteData.serviceType || 'Custom Apparel Service',
        rate: 0,
        quantity: totalQuantity || quoteData.quantity || 1,
        amount: 0,
        taxable: false,
        details: `Project Timeline: ${quoteData.timeline || 'Not specified'}
Description: ${quoteData.description || ''}`
      }];

      if (quoteData.additionalServices) {
        Object.entries(quoteData.additionalServices).forEach(([service, selected]) => {
          if (selected) {
            lineItems.push({
              description: service,
              rate: 0,
              quantity: 1,
              amount: 0,
              taxable: false,
              details: 'Additional Service'
            });
          }
        });
      }

      setFormData(prev => ({
        ...prev,
        customer: {
          name: quoteData.brandName || '',
          email: quoteData.brandEmail || '',
          phone: quoteData.brandPhone || '',
          company: quoteData.brandName || '',
          id: quoteData.brandId || ''
        },
        items: lineItems,
        orderDetails: {
          serviceType: quoteData.serviceType || '',
          timeline: quoteData.timeline || '',
          sizeBreakdown: quoteData.sizeBreakdown || {},
          attachedFiles: [
            ...(quoteData.mockupFiles || []),
            ...(quoteData.sourceFiles || [])
          ],
          projectDescription: quoteData.description || ''
        },
        quoteReference: {
          brandId: quoteData.brandId,
          brandName: quoteData.brandName,
          originalQuote: quoteData
        }
      }));
    }
  }, [quoteData]);

  useEffect(() => {
    if (customerId && customerName) {
      setFormData(prev => ({
        ...prev,
        customer: {
          ...prev.customer,
          name: customerName,
          id: customerId
        }
      }));
    }
  }, [customerId, customerName]);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { description: '', rate: 0, quantity: 1, amount: 0, taxable: false, details: '' }
      ]
    });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItemAmount = (index) => {
    const newItems = [...formData.items];
    const item = newItems[index];
    item.amount = item.rate * item.quantity;
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'rate' || field === 'quantity') {
      newItems[index].amount = newItems[index].rate * newItems[index].quantity;
    }
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = (items) => {
    const subtotal = items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
    const tax = subtotal * 0.1; // 10% tax
    const shipping = 15; // Fixed shipping
    const total = subtotal + tax + shipping;
    return { subtotal, tax, shipping, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Prepare the order data
      const orderData = {
        vendorId,
        vendorName: userProfile?.companyName,
        customerId,
        customerName,
        orderNumber: Math.floor(100000 + Math.random() * 900000).toString(),
        items: formData.items,
        total: calculateTotals(formData.items).total,
        shipping: formData.shipping,
        customer: formData.customer,
        createdAt: serverTimestamp(),
        status: {
          payment: 'pending',
          fulfillment: 'unfulfilled'
        }
      };

      // Create the message thread with the order and wait for it to complete
      const threadId = await createMessageThread(orderData);
      console.log('Created message thread:', threadId);

      // Reset form state
      setFormData(initialFormData);
      setIsSubmitting(false);
      onClose();

      // Navigate to the messages page and wait for navigation to complete
      await navigate('/dashboard/messages', { 
        replace: true,
        state: { 
          selectedChat: threadId,
          openThread: true 
        }
      });

      // Dispatch the refresh event after a short delay to ensure components are mounted
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshMessages', { 
          detail: { 
            threadId,
            forceReload: true // Add this flag to force a full reload
          }
        }));
      }, 300); // Increased delay to ensure components are fully mounted

    } catch (error) {
      console.error('Error creating order:', error);
      setIsSubmitting(false);
      alert('Failed to create order. Please try again.');
    }
  };

  const renderSizeBreakdown = () => {
    if (!formData.orderDetails.sizeBreakdown || 
        Object.keys(formData.orderDetails.sizeBreakdown).length === 0) {
      return null;
    }

    return (
      <div className="form-section">
        <h3>Size Breakdown</h3>
        <div className="size-grid">
          {Object.entries(formData.orderDetails.sizeBreakdown)
            .filter(([_, quantity]) => parseInt(quantity) > 0)
            .map(([size, quantity]) => (
              <div key={size} className="size-item">
                <span className="size-label">{size}:</span>
                <span className="size-value">{quantity}</span>
              </div>
            ))}
        </div>
        <div className="size-total">
          Total Quantity: {Object.values(formData.orderDetails.sizeBreakdown)
            .reduce((sum, qty) => sum + (parseInt(qty) || 0), 0)}
        </div>
      </div>
    );
  };

  const renderAttachedFiles = () => {
    if (!formData.orderDetails.attachedFiles?.length) return null;

    return (
      <div className="form-section">
        <h3>Attached Files from Quote</h3>
        <div className="files-grid">
          {formData.orderDetails.attachedFiles.map((file, index) => (
            <div key={index} className="file-item">
              <div className="file-name">{file.name}</div>
              {file.type.startsWith('image/') && (
                <img src={file.url} alt={file.name} className="file-preview" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{quoteData ? 'Create Order from Quote' : 'Create New Order'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Client Information Section */}
          <div className="form-section">
            <h3>Client Information</h3>
            <div className="client-info">
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Client Name"
                  value={formData.customer.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    customer: { ...formData.customer, name: e.target.value }
                  })}
                  required
                />
                <input
                  type="text"
                  placeholder="Company Name"
                  value={formData.customer.company}
                  onChange={(e) => setFormData({
                    ...formData,
                    customer: { ...formData.customer, company: e.target.value }
                  })}
                />
              </div>
              <div className="input-group">
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.customer.email}
                  onChange={(e) => setFormData({
                    ...formData,
                    customer: { ...formData.customer, email: e.target.value }
                  })}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={formData.customer.phone}
                  onChange={(e) => setFormData({
                    ...formData,
                    customer: { ...formData.customer, phone: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Order Items Section */}
          <div className="form-section">
            <h3>Order Items</h3>
            <div className="invoice-table">
              <div className="table-header">
                <div>Description</div>
                <div>Rate</div>
                <div>QTY</div>
                <div>Amount</div>
                <div>Tax</div>
                <div></div>
              </div>
              {formData.items.map((item, index) => (
                <div key={index} className="table-row">
                  <div className="col-description">
                    <input
                      type="text"
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-rate">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={item.rate}
                      onChange={(e) => updateItem(index, 'rate', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-qty">
                    <input
                      type="number"
                      placeholder="0"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-amount">
                    ${calculateTotals(formData.items).subtotal.toFixed(2)}
                  </div>
                  <div className="col-tax">
                    <input
                      type="checkbox"
                      checked={item.taxable}
                      onChange={(e) => updateItem(index, 'taxable', e.target.checked)}
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="remove-item-btn"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="add-item"
            >
              <FaPlus /> Add Item
            </button>
          </div>

          {/* Shipping Information */}
          <div className="form-section">
            <h3>Shipping Information</h3>
            <div className="shipping-address">
              <input
                type="text"
                placeholder="Street Address"
                value={formData.shipping.address.street}
                onChange={(e) => setFormData({
                  ...formData,
                  shipping: {
                    ...formData.shipping,
                    address: { ...formData.shipping.address, street: e.target.value }
                  }
                })}
                required
              />
              <div className="address-row">
                <input
                  type="text"
                  placeholder="City"
                  value={formData.shipping.address.city}
                  onChange={(e) => setFormData({
                    ...formData,
                    shipping: {
                      ...formData.shipping,
                      address: { ...formData.shipping.address, city: e.target.value }
                    }
                  })}
                  required
                />
                <input
                  type="text"
                  placeholder="State"
                  value={formData.shipping.address.state}
                  onChange={(e) => setFormData({
                    ...formData,
                    shipping: {
                      ...formData.shipping,
                      address: { ...formData.shipping.address, state: e.target.value }
                    }
                  })}
                  required
                />
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={formData.shipping.address.zip}
                  onChange={(e) => setFormData({
                    ...formData,
                    shipping: {
                      ...formData.shipping,
                      address: { ...formData.shipping.address, zip: e.target.value }
                    }
                  })}
                  required
                />
              </div>
            </div>
          </div>

          {renderSizeBreakdown()}

          {renderAttachedFiles()}

          {/* Order Summary */}
          <div className="form-section">
            <h3>Order Summary</h3>
            <div className="order-summary">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>${calculateTotals(formData.items).subtotal.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Tax (8.75%)</span>
                <span>${calculateTotals(formData.items).tax.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <span>${calculateTotals(formData.items).shipping.toFixed(2)}</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>${calculateTotals(formData.items).total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn secondary">
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={isSubmitting}>
              Create Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrder; 