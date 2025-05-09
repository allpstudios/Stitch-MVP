import React from 'react';
import './OrderDetailsModal.css';
import { FaTimes, FaBox, FaTruck, FaCreditCard, FaUser, FaCircle, FaCheckCircle, FaEnvelope, FaPhone, FaMapMarkerAlt } from 'react-icons/fa';
import { useOrders } from '../context/OrderContext';

const OrderDetailsModal = ({ order, onClose }) => {
  const { updateOrderStatus } = useOrders();

  if (!order) return null;

  // Ensure we're accessing the correct status structure
  const fulfillmentStatus = order.status?.fulfillment || 'pending';
  const statusClass = typeof fulfillmentStatus === 'string' ? fulfillmentStatus.toLowerCase() : 'pending';

  const handleStatusUpdate = async (newStatus) => {
    try {
      await updateOrderStatus(order.id, {
        ...order.status,
        fulfillment: newStatus
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Order #{order.orderNumber}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="order-info-section">
            <div className="order-date">
              <strong>Date:</strong> {new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}
            </div>
            <div className="order-status">
              <strong>Status:</strong> 
              <span className={`status-badge status-${statusClass}`}>
                {fulfillmentStatus}
              </span>
            </div>
          </div>

          {/* Only render items section if items exist and is an array */}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="items-section">
              <h3>Items</h3>
              <div className="items-table">
                <div className="table-header">
                  <div className="col-desc">Description</div>
                  <div className="col-qty">Qty</div>
                  <div className="col-rate">Rate</div>
                  <div className="col-amount">Amount</div>
                </div>
                {order.items.map((item, index) => (
                  <div key={index} className="table-row">
                    <div className="col-desc">{item.description || item.name}</div>
                    <div className="col-qty">{item.quantity}</div>
                    <div className="col-rate">${(item.rate || item.price || 0).toFixed(2)}</div>
                    <div className="col-amount">
                      ${((item.rate || item.price || 0) * (item.quantity || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="totals-section">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>${(order.totals?.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span>Tax:</span>
              <span>${(order.totals?.tax || 0).toFixed(2)}</span>
            </div>
            <div className="total-row grand-total">
              <span>Total:</span>
              <span>${(order.totals?.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn secondary" onClick={onClose}>Close</button>
          <button className="btn primary">Download PDF</button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal; 