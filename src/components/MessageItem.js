import React, { useState } from 'react';
import OrderInvoiceModal from './OrderInvoiceModal';
import QuoteDetailsModal from './QuoteDetailsModal';
import './MessageItem.css';
import { FaFileInvoice, FaFile, FaImage, FaFileDownload, FaDownload, FaFileContract, FaFileAlt, FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import OrderOverviewCard from './OrderOverviewCard';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const MessageItem = ({ message, isOwnMessage }) => {
  const [showInvoice, setShowInvoice] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const { userProfile } = useAuth();
  
  console.log('MessageItem rendering:', {
    id: message.id,
    type: message.type,
    senderId: message.senderId,
    isOwnMessage,
    userProfile,
    hasOrderDetails: !!message.orderDetails,
    orderDetails: message.orderDetails,
    content: message.content,
    fileUrl: message.fileUrl,
    fileName: message.fileName,
    fileType: message.fileType
  });

  const handleDeleteMessage = async (e) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'messages', message.id));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleDownload = (fileUrl, fileName) => {
    // Create temporary link element
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download'; // Use provided filename or default
    link.target = '_blank'; // Open in new tab if download fails
    
    // Append to document, click, and cleanup
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderOrderCard = () => {
    if (!message.orderDetails) {
      console.warn('Missing orderDetails for order message:', message);
      return null;
    }

    const {
      orderNumber,
      date,
      items = [],
      totals = {
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0
      },
      status = {
        payment: 'pending',
        fulfillment: 'unfulfilled'
      }
    } = message.orderDetails;

    // Use isOwnMessage to align with sender's other messages
    return (
      <div className={`message-item order-message ${isOwnMessage ? 'own-message' : ''}`}>
        <div className="order-card" onClick={() => setShowInvoice(true)}>
          <div className="order-icon">
            <FaFileInvoice />
          </div>
          
          <div className="order-content">
            <div className="order-header">
              <h4>Order #{orderNumber}</h4>
              <div className="status-badges">
                <span className={`status-badge ${status.payment.toLowerCase()}`}>
                  {status.payment}
                </span>
              </div>
            </div>
            
            <div className="order-summary">
              <div className="order-info">
                <span>Items: {items.length}</span>
                <span>Total: ${typeof totals.total === 'number' ? totals.total.toFixed(2) : '0.00'}</span>
              </div>
              <div className="order-date">
                {new Date(date).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
        <div className="message-timestamp">
          {message.timestamp?.toDate ? new Date(message.timestamp.toDate()).toLocaleDateString() : ''}
        </div>

        {showInvoice && (
          <OrderInvoiceModal
            order={{
              ...message.orderDetails,
              conversationId: message.conversationId,
              vendorId: message.senderId
            }}
            onClose={() => setShowInvoice(false)}
          />
        )}
      </div>
    );
  };

  const renderFileMessage = () => {
    const isImage = message.fileType?.startsWith('image/');
    const isUploading = message.isUploading;
    
    return (
      <div className={`message-item ${isOwnMessage ? 'own-message' : ''}`}>
        <div className="message-content file-message">
          {isUploading ? (
            <div className="file-upload-progress">
              <div className="file-info">
                <div className="file-icon">
                  <FaFile />
                </div>
                <div className="file-details">
                  <span className="file-name">{message.fileName}</span>
                  <div className="upload-progress-bar">
                    <div 
                      className="upload-progress" 
                      style={{ width: `${message.uploadProgress}%` }}
                    />
                  </div>
                  <span className="upload-progress-text">
                    {Math.round(message.uploadProgress)}%
                  </span>
                </div>
              </div>
            </div>
          ) : isImage ? (
            <div className="image-preview">
              <img 
                src={message.fileUrl} 
                alt={message.fileName}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewFile({
                    fileUrl: message.fileUrl,
                    fileName: message.fileName,
                    fileType: message.fileType
                  });
                }}
              />
              <div 
                className="image-overlay"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewFile({
                    fileUrl: message.fileUrl,
                    fileName: message.fileName,
                    fileType: message.fileType
                  });
                }}
              >
                <FaDownload className="download-icon" />
              </div>
            </div>
          ) : (
            <div className="file-info">
              <div className="file-icon">
                <FaFile />
              </div>
              <div className="file-details">
                <span className="file-name">{message.fileName}</span>
                <button 
                  onClick={(e) => handleDownload(message.fileUrl, message.fileName)}
                  className="download-link"
                >
                  <FaFileDownload /> Download
                </button>
              </div>
            </div>
          )}
        </div>
        {!isUploading && (
          <div className="message-timestamp">
            {message.timestamp?.toDate ? new Date(message.timestamp.toDate()).toLocaleDateString() : ''}
          </div>
        )}

        {previewFile && (
          <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{previewFile.fileName}</h3>
                <div className="modal-actions">
                  <button 
                    className="modal-button download"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDownload(previewFile.fileUrl, previewFile.fileName);
                    }}
                  >
                    <FaDownload /> Download
                  </button>
                  <button 
                    className="modal-button close"
                    onClick={() => setPreviewFile(null)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="modal-body">
                <img 
                  src={previewFile.fileUrl} 
                  alt={previewFile.fileName}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDeleteButton = () => {
    if (isOwnMessage) {
      return (
        <button 
          className="delete-button" 
          onClick={handleDeleteMessage}
          title="Delete message"
        >
          <FaTrash />
        </button>
      );
    }
    return null;
  };

  const renderReactions = () => {
    // This is a placeholder for now - can be implemented later if needed
    return null;
  };

  const renderRegularMessage = () => {
    if (!message) return null;

    const messageText = message.content || message.text;
    if (!messageText) {
      console.warn('Message has no content or text field:', message);
      return null;
    }

    return (
      <div className={`message-item ${isOwnMessage ? 'own-message' : 'other-message'}`}>
        <div className="message-content">
          {messageText}
          {renderDeleteButton()}
        </div>
        <div className="message-timestamp">
          {message.timestamp?.toDate ? new Date(message.timestamp.toDate()).toLocaleDateString() : ''}
        </div>
        {renderReactions()}
      </div>
    );
  };

  const renderQuoteCard = () => {
    return (
      <div className={`message-item quote-message ${isOwnMessage ? 'own-message' : ''}`}>
        <div className="quote-card" onClick={() => setShowQuote(true)}>
          <div className="quote-icon">
            <FaFileContract />
          </div>
          
          <div className="quote-content">
            <div className="quote-header">
              <h4>Quote Request</h4>
              <span className="quote-date">
                {message.timestamp?.toDate ? new Date(message.timestamp.toDate()).toLocaleDateString() : ''}
              </span>
            </div>
            
            <div className="quote-summary">
              {Array.isArray(message.services) && message.services.map((service, index) => (
                <div key={index} className="service-item">
                  <span className="service-name">{service.service}</span>
                  <div className="quantities-preview">
                    {Object.entries(service.quantities || {})
                      .filter(([_, qty]) => qty > 0)
                      .map(([size, qty], i) => (
                        <span key={i} className="quantity-badge">
                          {size}: {qty}
                        </span>
                      )).slice(0, 3)}
                    {Object.entries(service.quantities || {}).filter(([_, qty]) => qty > 0).length > 3 && 
                      <span className="quantity-badge more">+more</span>
                    }
                  </div>
                </div>
              )).slice(0, 2)}
              {message.services?.length > 2 && (
                <div className="more-services">+{message.services.length - 2} more services</div>
              )}
            </div>
            
            {message.deadline && (
              <div className="quote-footer">
                <span className="deadline">
                  Deadline: {new Date(message.deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="message-timestamp">
          {message.timestamp?.toDate ? new Date(message.timestamp.toDate()).toLocaleDateString() : ''}
        </div>

        {showQuote && (
          <QuoteDetailsModal
            quote={message}
            onClose={() => setShowQuote(false)}
          />
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (!message) return null;

    switch (message.type) {
      case 'text':
        return renderRegularMessage();
      case 'file':
        return renderFileMessage();
      case 'quote':
        return renderQuoteCard();
      case 'system':
        return (
          <div className={`message-item system-message`}>
            <div className="message-content system-content">
              {message.content || message.text}
            </div>
            <div className="message-timestamp">
              {message.timestamp?.toDate ? new Date(message.timestamp.toDate()).toLocaleDateString() : ''}
            </div>
          </div>
        );
      case 'order':
        // Check both possible locations for order data
        const orderData = message.order || message.orderDetails;
        if (!orderData) {
          console.warn('No order data found in message:', message);
          return null;
        }
        
        // Ensure status object exists with payment status
        const status = orderData.status || {};
        const enhancedOrderData = {
          ...orderData,
          status: {
            payment: status.payment || 'pending',
            fulfillment: status.fulfillment || 'unfulfilled'
          }
        };
        
        const combinedMessage = {
          ...message,
          quoteDetails: message.quoteDetails || message.quote || {},
          order: enhancedOrderData,
          orderDetails: enhancedOrderData
        };
        
        return <OrderOverviewCard message={combinedMessage} isOwnMessage={isOwnMessage} />;
      default:
        return renderRegularMessage();
    }
  };

  return renderContent();
};

export default MessageItem; 