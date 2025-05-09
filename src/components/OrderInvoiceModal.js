import React, { useState, useEffect } from 'react';
import Portal from './Portal';
import './OrderInvoiceModal.css';
import { FaTimes, FaCreditCard, FaEdit, FaSave, FaPlus, FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { simulatePaymentAndCreateOverview } from '../services/MessageService';
import PaymentForm from './PaymentForm';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

const OrderInvoiceModal = ({ order, onClose }) => {
  const { userProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  
  // Initialize editedOrder state with empty values first
  const [editedOrder, setEditedOrder] = useState({
    id: null,
    vendorId: null,
    customerId: null,
    orderNumber: null,
    items: [],
    totals: {
      subtotal: 0,
      tax: 0,
      shipping: 0,
      total: 0
    },
    shipping: {
      method: 'UPS Ground',
      address: {},
      cost: 0
    },
    customer: {},
    status: {}
  });

  // Update editedOrder when order prop changes
  useEffect(() => {
    if (order) {
      setEditedOrder({
        id: order.id,
        vendorId: order.vendorId,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        items: order.items || [],
        totals: {
          subtotal: order.totals?.subtotal || 0,
          tax: order.totals?.tax || 0,
          shipping: order.totals?.shipping || 0,
          total: order.totals?.total || 0
        },
        shipping: {
          method: order.shipping?.method || 'UPS Ground',
          address: order.shipping?.address || {},
          cost: order.shipping?.cost || 0
        },
        customer: order.customer || {},
        status: order.status || {}
      });
    }
  }, [order]);

  // Get status text and class
  const getStatusInfo = (status) => {
    if (!status) return { text: 'Unknown', className: 'unknown' };
    
    const fulfillment = status.fulfillment?.toLowerCase() || 'unfulfilled';
    const payment = status.payment?.toLowerCase() || 'pending';
    
    return {
      fulfillment: {
        text: fulfillment.charAt(0).toUpperCase() + fulfillment.slice(1),
        className: fulfillment
      },
      payment: {
        text: payment.charAt(0).toUpperCase() + payment.slice(1),
        className: payment
      }
    };
  };

  const statusInfo = getStatusInfo(order.status);
  const isVendor = userProfile?.userType === 'vendor';

  // Ensure these objects exist with default values
  const customer = order.customer || {};
  const shipping = order.shipping || {};
  const address = shipping.address || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const totals = {
    subtotal: order.totals?.subtotal || 0,
    tax: order.totals?.tax || 0,
    shipping: order.totals?.shipping || 0,
    total: order.totals?.total || 0
  };

  const handleEditInvoice = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedOrder(order);
    setIsEditing(false);
  };

  const handleSaveInvoice = async () => {
    try {
      setLoading(true);
      
      console.log('Starting save process...');
      console.log('Order ID:', editedOrder.id);
      console.log('Current user:', userProfile);
      
      if (!editedOrder.id) {
        throw new Error('Order ID is missing');
      }

      if (!editedOrder.vendorId) {
        throw new Error('Vendor ID is missing');
      }

      // Validate that current user is the vendor
      if (userProfile.uid !== editedOrder.vendorId) {
        throw new Error('Unauthorized to edit this order');
      }

      const orderRef = doc(db, 'orders', editedOrder.id);
      
      const updateData = {
        items: editedOrder.items.map(item => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          amount: Number(item.amount) || 0
        })),
        totals: {
          subtotal: Number(editedOrder.totals.subtotal) || 0,
          tax: Number(editedOrder.totals.tax) || 0,
          shipping: Number(editedOrder.totals.shipping) || 0,
          total: Number(editedOrder.totals.total) || 0
        },
        lastUpdated: new Date(),
        lastUpdatedBy: userProfile.uid,
        // Preserve other important fields
        vendorId: editedOrder.vendorId,
        customerId: editedOrder.customerId,
        orderNumber: editedOrder.orderNumber,
        status: editedOrder.status
      };

      console.log('Attempting to update order with:', updateData);
      
      await updateDoc(orderRef, updateData);
      console.log('Order updated successfully');
      
      // Update local state with the new data
      onClose(); // Close the modal after successful save
      
      setIsEditing(false);
      setLoading(false);
      
      alert('Order updated successfully');
    } catch (error) {
      console.error('Error saving order:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      setLoading(false);
      alert(`Error saving order: ${error.message}`);
    }
  };

  const updateItemField = (index, field, value) => {
    const updatedItems = [...editedOrder.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
      amount: field === 'rate' || field === 'quantity' 
        ? (value || 0) * (field === 'rate' ? updatedItems[index].quantity : updatedItems[index].rate)
        : updatedItems[index].amount
    };

    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const tax = subtotal * 0.0875; // Example tax rate of 8.75%
    const shipping = editedOrder.totals?.shipping || 0;

    setEditedOrder(prev => ({
      ...prev,
      items: updatedItems,
      totals: {
        subtotal,
        tax,
        shipping,
        total: subtotal + tax + shipping
      }
    }));
  };

  const addNewItem = () => {
    setEditedOrder(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0
        }
      ]
    }));
  };

  const removeItem = (index) => {
    const updatedItems = editedOrder.items.filter((_, i) => i !== index);
    const subtotal = updatedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const tax = subtotal * 0.0875;
    const shipping = editedOrder.totals?.shipping || 0;

    setEditedOrder(prev => ({
      ...prev,
      items: updatedItems,
      totals: {
        subtotal,
        tax,
        shipping,
        total: subtotal + tax + shipping
      }
    }));
  };

  const renderEditableItems = () => (
    <div className="items-section">
      <table className="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th className="quantity-col">QTY</th>
            <th className="rate-col">Rate</th>
            <th className="amount-col">Amount</th>
            <th className="action-col"></th>
          </tr>
        </thead>
        <tbody>
          {editedOrder.items.map((item, index) => (
            <tr key={index}>
              <td>
                <div className="item-description">
                  <p>{item.description || item.name}</p>
                  <small>{item.details}</small>
                </div>
              </td>
              <td className="quantity-col">
                <input
                  type="number"
                  value={item.quantity || 0}
                  onChange={(e) => updateItemField(index, 'quantity', parseFloat(e.target.value))}
                  className="edit-input quantity"
                  min="1"
                />
              </td>
              <td className="rate-col">
                <input
                  type="number"
                  value={item.rate || 0}
                  onChange={(e) => updateItemField(index, 'rate', parseFloat(e.target.value))}
                  className="edit-input rate"
                  min="0"
                  step="0.01"
                />
              </td>
              <td className="amount-col">${(item.amount || 0).toFixed(2)}</td>
              <td className="action-col">
                <button 
                  className="remove-item-btn"
                  onClick={() => removeItem(index)}
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="add-item-btn" onClick={addNewItem}>
        <FaPlus /> Add Item
      </button>
    </div>
  );

  const handleTestPayment = async () => {
    try {
      await simulatePaymentAndCreateOverview({
        ...order,
        conversationId: order.conversationId,
        senderId: order.vendorId,
        orderDetails: {
          ...order,
          status: {
            payment: 'pending',
            fulfillment: 'unfulfilled'
          }
        }
      });
      onClose();
    } catch (error) {
      console.error('Error processing test payment:', error);
      alert('Error processing payment simulation');
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = async (paymentIntent) => {
    try {
      if (!order.conversationId) {
        console.error('No conversation ID found in order:', order);
        throw new Error('Missing conversation ID. Please try again or contact support.');
      }

      // Create the order update payload
      const orderUpdate = {
        id: order.messageId,
        conversationId: order.conversationId,
        senderId: userProfile.uid,
        messageType: 'order_update',
        orderDetails: {
          ...order,
          status: {
            payment: 'paid',
            fulfillment: 'unfulfilled'
          },
          paymentDetails: {
            id: paymentIntent.id,
            amount: order.totals.total,
            status: 'succeeded',
            customerId: userProfile.uid,
            vendorId: order.vendorId,
            createdAt: new Date().toISOString(),
            paidAt: new Date().toISOString()
          }
        }
      };

      console.log('Sending order update:', orderUpdate);
      
      // Update order through message system which has proper permissions
      await simulatePaymentAndCreateOverview(orderUpdate);

      // Add payment event to timeline
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('orderNumber', '==', order.orderNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const orderDoc = querySnapshot.docs[0];
        const orderId = orderDoc.id;
        
        console.log('Found order document:', orderId);
        
        // Update the order's payment status and details
        const orderUpdateData = {
          'status.payment': 'paid',
          paidAt: serverTimestamp(),
          lastUpdate: serverTimestamp(),
          paymentDetails: {
            id: paymentIntent.id,
            amount: order.totals.total,
            status: 'succeeded',
            customerId: userProfile.uid,
            vendorId: order.vendorId,
            createdAt: serverTimestamp(),
            paidAt: serverTimestamp()
          }
        };

        console.log('Updating order with data:', orderUpdateData);
        
        // Update the order document
        await updateDoc(doc(db, 'orders', orderId), orderUpdateData);

        // Add payment event
        const eventData = {
          description: `Payment received - $${order.totals.total.toFixed(2)}`,
          timestamp: serverTimestamp(),
          type: 'payment',
          createdBy: userProfile.uid,
          paymentDetails: {
            id: paymentIntent.id,
            amount: order.totals.total,
            status: 'succeeded'
          }
        };

        await addDoc(collection(db, 'orders', orderId, 'events'), eventData);
        
        console.log('Successfully updated order and added payment event');
      } else {
        console.error('Could not find order document with orderNumber:', order.orderNumber);
      }
      
      // Close modal and show success message
      onClose();
      alert('Payment successful! Your order has been paid.');
    } catch (error) {
      console.error('Error updating order after payment:', error);
      
      // Show a more specific error message
      const errorMessage = error.message.includes('conversation ID') 
        ? 'There was an error updating your order. Please try refreshing the page and try again.'
        : 'Payment was successful but there was an error updating the order status. Please contact support.';
      
      alert(errorMessage);
    }
  };

  // Handle payment error
  const handlePaymentError = (error) => {
    console.error('Payment error:', error);
    // Only show alert for non-validation errors
    if (error.type !== 'validation_error') {
      alert('There was an error processing your payment. Please try again.');
    }
  };

  // Add debug log to see what we're receiving
  console.log('Order data in invoice modal:', order);

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          {showPayment ? (
            <>
              <div className="invoice-header">
                <h2>Payment for Order #{order.orderNumber || 'N/A'}</h2>
                <button className="close-btn" onClick={onClose}>×</button>
              </div>
              <div className="payment-container">
                <PaymentForm 
                  amount={order.totals.total}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </div>
            </>
          ) : (
            <>
              <div className="invoice-header">
                <h2>Order #{order.orderNumber || 'N/A'}</h2>
                <button className="close-btn" onClick={onClose}>×</button>
              </div>

              <div className="invoice-content">
                <div className="info-section">
                  <div className="info-box">
                    <h3>Customer Information</h3>
                    <div className="info-row">
                      <span className="info-label">Name</span>
                      <span className="info-value">{customer.name || 'N/A'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Email</span>
                      <span className="info-value">{customer.email || 'N/A'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Phone</span>
                      <span className="info-value">{customer.phone || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="info-box">
                    <h3>Shipping Information</h3>
                    <div className="info-row">
                      <span className="info-label">Address</span>
                      <span className="info-value">{address.street || 'N/A'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">City, State ZIP</span>
                      <span className="info-value">
                        {address.city || 'N/A'}, {address.state || 'N/A'} {address.zip || 'N/A'}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Method</span>
                      <span className="info-value">{shipping.method || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {isEditing ? renderEditableItems() : (
                  <div className="invoice-items">
                    <table>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Rate</th>
                          <th>QTY</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index}>
                            <td>
                              <div className="item-description">
                                <p>{item.description || item.name}</p>
                                <small>{item.details}</small>
                              </div>
                            </td>
                            <td>${(item.rate || item.price || 0).toFixed(2)}</td>
                            <td>{item.quantity || 0}</td>
                            <td>${((item.rate || item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="invoice-summary">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>${totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Tax</span>
                    <span>${totals.tax.toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Shipping</span>
                    <span>${totals.shipping.toFixed(2)}</span>
                  </div>
                  <div className="summary-row total">
                    <span>Total</span>
                    <span>${totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="invoice-footer">
                <div className="payment-status">
                  {order.status?.payment === 'paid' && (
                    <div className="paid-stamp">
                      <span className="paid-text">PAID</span>
                      <span className="paid-date">
                        {order.paymentDetails?.paidAt 
                          ? new Date(order.paymentDetails.paidAt).toLocaleDateString()
                          : new Date().toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="invoice-actions">
                  {isEditing ? (
                    <>
                      <button className="close-button" onClick={handleCancelEdit}>
                        Cancel
                      </button>
                      <button 
                        className="save-button"
                        onClick={handleSaveInvoice}
                        disabled={loading}
                      >
                        <FaSave /> {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="close-button" onClick={onClose}>
                        Close
                      </button>
                      {isVendor ? (
                        <button 
                          className="edit-button"
                          onClick={handleEditInvoice}
                        >
                          <FaEdit /> Edit Invoice
                        </button>
                      ) : (
                        (!statusInfo.payment || statusInfo.payment.className === 'pending') && (
                          <button 
                            className="pay-button"
                            onClick={() => setShowPayment(true)}
                          >
                            <FaCreditCard /> Pay Now
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default OrderInvoiceModal; 