import React, { useState } from 'react';
import Portal from './Portal';
import './QuoteDetailsModal.css';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { FaCalendarAlt, FaBoxOpen, FaTshirt, FaFileAlt, FaInfoCircle, FaTimes, FaBox, FaTruck, FaCreditCard, FaUser, FaCircle, FaCheckCircle, FaEnvelope, FaPhone, FaMapMarkerAlt, FaDownload, FaFile, FaImage } from 'react-icons/fa';
import { useOrders } from '../context/OrderContext';
import { useNavigate } from 'react-router-dom';

const QuoteDetailsModal = ({ quote, onClose }) => {
  const { user, userProfile } = useAuth();
  const { updateOrderStatus } = useOrders();
  const navigate = useNavigate();
  const [previewFile, setPreviewFile] = useState(null);
  const [failedImages, setFailedImages] = useState({});

  console.log('Full quote object:', JSON.stringify(quote, null, 2));

  // Helper function to calculate total quantity
  const calculateTotalQuantity = (sizeBreakdown) => {
    if (!sizeBreakdown) return 0;
    return Object.values(sizeBreakdown).reduce((sum, qty) => sum + Number(qty), 0);
  };

  // Get the quote details from the correct location in the data structure
  const quoteDetails = quote?.quoteDetails || {};
  console.log('Raw quote object:', quote);
  console.log('Quote details object:', quoteDetails);
  console.log('Quote details sizes:', quoteDetails.sizes);
  console.log('Quote details quantities:', quoteDetails.quantities);
  console.log('Files in quote:', {
    mockupFiles: quoteDetails.mockupFiles,
    sourceFiles: quoteDetails.sourceFiles
  });

  // Add this right after the quoteDetails declaration
  console.log('Mockup Files:', quoteDetails.mockupFiles);
  console.log('Source Files:', quoteDetails.sourceFiles);

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this quote request?')) {
      try {
        const messageRef = doc(db, 'messages', quote.id);
        await updateDoc(messageRef, {
          status: 'cancelled',
          cancelledAt: new Date(),
          content: `❌ Cancelled Quote Request: ${quoteDetails.serviceRequired} - ${quoteDetails.quantity || 0} units`
        });
        onClose();
      } catch (error) {
        console.error('Error cancelling quote:', error);
        alert('Failed to cancel quote request');
      }
    }
  };

  // Only show edit/cancel options if the user is the sender
  const canModify = quote.senderId === user.uid;

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) {
      return <FaImage />;
    }
    return <FaFile />;
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

  const renderFileSection = (files, title) => {
    if (!files || files.length === 0) return null;
    
    console.log(`Rendering ${title}:`, files);
    
    return (
      <div className="files-section">
        <h3>{title}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {files.map((file, index) => {
            console.log('Rendering file:', file);
            const hasError = failedImages[`${title}-${index}`];
            const fileUrl = file.downloadURL || file.url; // Try both URL formats
            
            return (
              <div key={index} style={{ width: '200px', height: '200px', position: 'relative' }}>
                {fileUrl && !hasError ? (
                  <img 
                    src={fileUrl}
                    alt={file.name || 'File preview'}
                    onClick={() => setPreviewFile({...file, url: fileUrl})}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      backgroundColor: '#f8f9fa',
                      cursor: 'pointer'
                    }}
                    onError={() => {
                      console.error('Image failed to load:', file);
                      setFailedImages(prev => ({
                        ...prev,
                        [`${title}-${index}`]: true
                      }));
                    }}
                  />
                ) : (
                  <div 
                    onClick={() => handleDownload(fileUrl, file.name)}
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <FaFile size={48} color="#9B5DE5" />
                    <div style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
                      Click to download
                    </div>
                  </div>
                )}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  right: 0,
                  padding: '8px',
                  background: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  fontSize: '12px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  {file.name || 'Unnamed file'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Add this function to handle order creation
  const handleCreateOrder = () => {
    // Navigate to order creation with quote data
    navigate('/orders/new', {
      state: {
        fromQuote: true,
        quoteData: {
          brandId: quote.senderId,
          brandName: quote.senderName,
          serviceType: quoteDetails.serviceRequired,
          quantity: calculateTotalQuantity(quoteDetails.quantities),
          sizeBreakdown: quoteDetails.quantities,
          description: quoteDetails.projectDescription,
          timeline: quoteDetails.timeline,
          files: [
            ...(quoteDetails.mockupFiles || []),
            ...(quoteDetails.sourceFiles || [])
          ]
        }
      }
    });
    onClose();
  };

  // Add this near the end of your JSX, before the closing div
  const renderVendorActions = () => {
    if (userProfile?.userType !== 'vendor') return null;

    return (
      <div className="quote-actions">
        <button 
          className="create-order-btn"
          onClick={handleCreateOrder}
        >
          Create Order
        </button>
      </div>
    );
  };

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="quote-details-modal" onClick={e => e.stopPropagation()}>
          <div className="quote-header-banner">
            <h2>Quote Request Details</h2>
            <button className="close-btn" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          <div className="quote-content">
            {/* Service Details Section */}
            <div className="service-section">
              <div className="section-icon">
                <FaTshirt />
              </div>
              <h3>Service Details</h3>
              <div className="service-info">
                <h4>{quoteDetails.serviceRequired}</h4>
                <div className="quantity-info">
                  <p className="total-quantity">
                    Total Quantity: {quoteDetails.quantity || 0}
                  </p>
                  {/* Size Breakdown */}
                  <div className="size-breakdown">
                    <h5 style={{color: '#FF69B4'}}>Size Breakdown:</h5>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map(size => {
                        const quantity = quoteDetails?.quantities?.[size] || "0";
                        return (
                          <div key={size} style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            alignItems: 'center',
                            minWidth: '60px'
                          }}>
                            <span style={{ fontWeight: '500' }}>{size}:</span>
                            <span>{quantity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Section */}
            {quoteDetails.timeline && (
              <div className="timeline-section">
                <div className="section-icon">
                  <FaCalendarAlt />
                </div>
                <h3>Timeline</h3>
                <p>{quoteDetails.timeline}</p>
              </div>
            )}

            {/* Files Sections with different thumbnail sizes */}
            {renderFileSection(quoteDetails.mockupFiles, 'Mockup Files')}
            {renderFileSection(quoteDetails.sourceFiles, 'Source Files')}

            {/* Additional Information */}
            {quoteDetails.projectDescription && (
              <div className="additional-info-section">
                <div className="section-icon">
                  <FaInfoCircle />
                </div>
                <h3>Additional Information</h3>
                <p>{quoteDetails.projectDescription}</p>
              </div>
            )}

            {/* Add this before the quote footer */}
            <div className="delivery-section">
              <div className="section-icon">
                <FaTruck />
              </div>
              <h3>Delivery Method</h3>
              <p>
                {quoteDetails.deliveryMethod === 'pickup' ? (
                  <span>Pickup in LA</span>
                ) : (
                  <>
                    <strong>Ship to:</strong><br />
                    {quoteDetails.shippingAddress?.street}<br />
                    {quoteDetails.shippingAddress?.city}, {quoteDetails.shippingAddress?.state} {quoteDetails.shippingAddress?.zip}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="modal-footer">
            {canModify && (
              <div className="action-buttons">
                <button 
                  onClick={onClose}
                  style={{
                    background: 'linear-gradient(45deg, #FF69B4, #9B5DE5)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            {renderVendorActions()}
          </div>
        </div>
      </div>

      {previewFile && (
        <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewFile.name}</h3>
              <div className="modal-actions">
                <button 
                  className="modal-button download"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDownload(previewFile.downloadURL || previewFile.url, previewFile.name);
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
                src={previewFile.downloadURL || previewFile.url}
                alt={previewFile.name}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </Portal>
  );
};

export default QuoteDetailsModal; 