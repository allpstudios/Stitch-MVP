import React, { useState } from 'react';
import { FaFileInvoice, FaBox, FaClock, FaFileAlt, FaFile, FaTrash } from 'react-icons/fa';
import './OrderOverviewCard.css';
import OrderOverviewModal from './OrderOverviewModal';
import OrderInvoiceModal from './OrderInvoiceModal';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const OrderOverviewCard = ({ message, isOwnMessage }) => {
  const [showOverview, setShowOverview] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const { user } = useAuth();

  // Add debug logging
  console.log('OrderOverviewCard props:', { message, isOwnMessage });

  const handleDeleteOrder = async (e) => {
    e.stopPropagation();
    try {
      // Get the order ID from the message
      const orderId = message?.id || message?.order?.id;
      if (!orderId) {
        console.error('Cannot delete order: Order ID is undefined');
        return;
      }
      
      await deleteDoc(doc(db, 'orders', orderId));
      // Also delete the message if it exists
      if (message?.id) {
        await deleteDoc(doc(db, 'messages', message.id));
      }
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  };

  // Get order data from the message with null checks
  const orderData = message?.type === 'order' ? message?.orderDetails || message?.order || {} : message || {};
  
  // Calculate total quantity from items with null checks
  const totalQuantity = orderData?.items?.reduce((sum, item) => {
    return sum + (Number(item?.quantity) || 0);
  }, 0) || 0;

  // Calculate totals from items with validation and null checks
  const subtotal = orderData?.items?.reduce((sum, item) => {
    const price = parseFloat(item?.price || item?.rate || 0);
    const quantity = parseInt(item?.quantity || 0);
    return sum + (isNaN(price) || isNaN(quantity) ? 0 : price * quantity);
  }, 0) || 0;

  // Create totals object for invoice
  const calculatedTotals = {
    subtotal: subtotal,
    tax: subtotal * 0.1, // 10% tax or adjust as needed
    shipping: parseFloat(orderData?.shipping?.cost || 0),
    total: subtotal + (subtotal * 0.1) + parseFloat(orderData?.shipping?.cost || 0)
  };

  // Get total from the correct location in the data structure with validation
  let total = 0;
  if (typeof orderData?.totals?.total === 'number' && !isNaN(orderData.totals.total)) {
    total = orderData.totals.total;
  } else if (typeof orderData?.total === 'number' && !isNaN(orderData.total)) {
    total = orderData.total;
  } else if (typeof orderData?.quoteDetails?.total === 'number' && !isNaN(orderData.quoteDetails.total)) {
    total = orderData.quoteDetails.total;
  } else {
    total = calculatedTotals.total;
  }

  // Ensure total is a valid number
  total = isNaN(total) ? 0 : total;

  const fulfillmentStatus = orderData?.status?.fulfillment || 'unfulfilled';
  const paymentStatus = orderData?.status?.payment || 'pending';
  const progress = fulfillmentStatus.toLowerCase() === 'fulfilled' ? 100 : 0;

  // If we don't have an order number, don't render anything
  if (!orderData?.orderNumber) {
    console.warn('No order number found in message:', message);
    return null;
  }

  return (
    <div className={`message-item order-overview ${isOwnMessage ? 'own-message' : ''}`}>
      <div className="order-progress-card" onClick={() => setShowOverview(true)}>
        <div className="order-card-header">
          <div className="order-info">
            <div className="order-title">
              <h3>Order #{orderData.orderNumber}</h3>
              <span className={`status-badge ${paymentStatus.toLowerCase()}`}>
                {paymentStatus}
              </span>
            </div>
            <span className="order-date">
              {orderData?.createdAt?.seconds ? 
                new Date(orderData.createdAt.seconds * 1000).toLocaleDateString() :
                new Date().toLocaleDateString()}
            </span>
          </div>
          <div className="order-actions">
            {(isOwnMessage || user?.uid === orderData?.vendorId) && (
              <button 
                className="delete-order-button" 
                onClick={handleDeleteOrder}
                title="Delete order"
              >
                <FaTrash />
              </button>
            )}
          </div>
        </div>
        
        <div className="order-card-details">
          <div className="detail-item">
            <span className="label">Customer:</span>
            <span className="value">
              {orderData?.customer?.name || orderData?.brandName || 'N/A'}
            </span>
          </div>
          <div className="detail-item">
            <span className="label">Items:</span>
            <span className="value">{totalQuantity} items</span>
          </div>
          <div className="detail-item">
            <span className="label">Total:</span>
            <span className="value">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="progress-tracker">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="progress-text">{progress}% Complete</span>
        </div>

        <button 
          className="view-order-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowOverview(true);
          }}
        >
          View Order
        </button>
      </div>

      {showOverview && (
        <OrderOverviewModal
          message={{
            ...message,
            order: {
              ...orderData,
              id: orderData.id || message.id,
              orderNumber: orderData.orderNumber,
              status: orderData.status || {
                payment: paymentStatus,
                fulfillment: fulfillmentStatus
              },
              createdAt: orderData.createdAt || message.timestamp,
              totals: calculatedTotals,
              conversationId: message.conversationId
            }
          }}
          onClose={() => setShowOverview(false)}
          onShowInvoice={() => {
            setShowOverview(false);
            setShowInvoice(true);
          }}
        />
      )}

      {showInvoice && (
        <OrderInvoiceModal
          order={{
            ...orderData,
            id: orderData.id || message.id,
            messageId: message.id,
            totals: calculatedTotals,
            conversationId: message.conversationId
          }}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  );
};

export default OrderOverviewCard; 