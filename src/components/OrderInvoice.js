import React from 'react';
import './OrderInvoice.css';
import { FaTimes } from 'react-icons/fa';

const OrderInvoice = ({ order, onClose }) => {
  return (
    <div className="invoice-modal-overlay">
      <div className="invoice-modal">
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
        
        <div className="invoice-content">
          <div className="invoice-header">
            <div className="brand-info">
              <h2>INVOICE</h2>
              <p className="invoice-number">#{order.orderNumber}</p>
              <p className="invoice-date">{new Date(order.date).toLocaleDateString()}</p>
            </div>
            <div className="logo">
              <h1>Stitch</h1>
            </div>
          </div>

          <div className="invoice-addresses">
            <div className="from-address">
              <h4>From</h4>
              <p>{order.vendorName}</p>
              <p>{order.vendorCompany}</p>
              <p>{order.vendorEmail}</p>
            </div>
            <div className="to-address">
              <h4>Bill To</h4>
              <p>{order.customer.name}</p>
              <p>{order.customer.company}</p>
              <p>{order.customer.email}</p>
            </div>
          </div>

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
                {order.items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <div className="item-description">
                        <p>{item.description}</p>
                        <small>{item.details}</small>
                      </div>
                    </td>
                    <td>${item.rate.toFixed(2)}</td>
                    <td>{item.quantity}</td>
                    <td>${(item.rate * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="invoice-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>${order.totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Tax (10%)</span>
              <span>${order.totals.tax.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Shipping</span>
              <span>${order.totals.shipping.toFixed(2)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>${order.totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="invoice-actions">
            <button className="pay-invoice-btn">
              Pay Invoice
            </button>
          </div>

          <div className="invoice-footer">
            <p>Shipping Address</p>
            <p>{order.shipping.address.street}</p>
            <p>{order.shipping.address.city}, {order.shipping.address.state} {order.shipping.address.zip}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderInvoice; 