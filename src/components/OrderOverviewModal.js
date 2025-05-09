import React, { useState, useEffect } from 'react';
import { FaFileInvoice, FaChevronDown, FaChevronUp, FaTimes, FaDownload, FaPlus, FaFile } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, getDoc, doc, onSnapshot } from 'firebase/firestore';
import Portal from './Portal';
import './OrderOverviewModal.css';
import { auth } from '../firebase';

const OrderOverviewModal = ({ message, onClose, onShowInvoice }) => {
  console.log('OrderOverviewModal received message:', message);
  console.log('Message order details:', message?.order);
  console.log('Order number from message:', message?.order?.orderNumber);

  const [showSourceFiles, setShowSourceFiles] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventText, setNewEventText] = useState('');
  
  // Fetch quote data
  useEffect(() => {
    const fetchQuoteData = async () => {
      if (!message?.conversationId) return;
      
      try {
        const messagesRef = collection(db, 'messages');
        const q = query(
          messagesRef, 
          where('conversationId', '==', message.conversationId),
          where('type', '==', 'quote')
        );
        
        const querySnapshot = await getDocs(q);
        const quotes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const latestQuote = quotes.sort((a, b) => 
          b.timestamp.seconds - a.timestamp.seconds
        )[0];

        if (latestQuote?.quoteDetails) {
          setQuoteData(latestQuote.quoteDetails);
          console.log('Found quote data:', latestQuote.quoteDetails);
        }
      } catch (error) {
        console.error('Error fetching quote data:', error);
      }
    };

    fetchQuoteData();
  }, [message?.conversationId]);

  // Fetch timeline events
  useEffect(() => {
    let unsubscribe;

    const fetchTimelineEvents = async () => {
      console.log('Fetching timeline events for order:', message?.order?.orderNumber);
      if (!message?.order?.orderNumber) {
        console.log('No order number found in message:', message);
        return;
      }

      try {
        // First get the order document
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('orderNumber', '==', message.order.orderNumber));
        console.log('Querying orders collection for order number:', message.order.orderNumber);
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          console.error('No order found with order number:', message.order.orderNumber);
          return;
        }

        const orderDoc = querySnapshot.docs[0];
        const orderId = orderDoc.id;
        console.log('Found order document with ID:', orderId);
        
        // Set up real-time listener for events
        const eventsRef = collection(db, 'orders', orderId, 'events');
        const eventsQuery = query(eventsRef, orderBy('timestamp', 'asc'));
        
        unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
          const events = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null
            };
          });
          console.log('Received timeline events:', events);
          setTimelineEvents(events);
        });
      } catch (error) {
        console.error('Error setting up timeline events listener:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          path: error.path
        });
      }
    };

    fetchTimelineEvents();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [message?.order?.orderNumber]);

  const handleAddEvent = async () => {
    console.log('=== handleAddEvent called ===');
    if (!newEventText.trim()) {
      console.log('No text entered, returning early');
      return;
    }
    
    console.log('=== Event Addition Debug ===');
    console.log('Message object:', JSON.stringify(message, null, 2));
    console.log('Message ID:', message?.id);
    console.log('Message order:', JSON.stringify(message?.order, null, 2));
    console.log('Current user:', auth.currentUser?.uid);
    console.log('New event text:', newEventText);
    
    const orderNumber = message?.order?.orderNumber;
    console.log('Using order number:', orderNumber);
    
    if (!orderNumber) {
      console.error('Cannot add event: Order number is undefined');
      return;
    }

    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('orderNumber', '==', orderNumber));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.error('No order found with order number:', orderNumber);
        return;
      }

      const orderDoc = querySnapshot.docs[0];
      const orderId = orderDoc.id;
      console.log('Found order document ID:', orderId);

      const eventData = {
        description: newEventText,
        timestamp: serverTimestamp(),
        type: 'update',
        createdBy: auth.currentUser.uid
      };
      console.log('Event data to be added:', eventData);

      const orderEventsRef = collection(db, 'orders', orderId, 'events');
      console.log('Attempting to add event to:', orderEventsRef.path);
      
      await addDoc(orderEventsRef, eventData);
      console.log('Event added successfully');
      
      setNewEventText('');
      setShowAddEvent(false);
    } catch (error) {
      console.error('Error adding timeline event:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        path: error.path
      });
    }
  };

  if (!message) {
    console.error('Message prop is undefined in OrderOverviewModal');
    return null;
  }

  const orderData = message.order || {};
  const quantities = quoteData?.quantities || {};
  const totalUnits = Object.values(quantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);

  const handleFileClick = (file) => {
    setSelectedFile(file);
  };

  const handleDownload = (fileUrl, fileName) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Portal>
      <div className="modal-overlay">
        <div className="modal-container">
          <div className="gradient-banner">
            <div className="header-content">
              <h2>Order #{orderData.orderNumber || 'N/A'} 
                <FaFileInvoice 
                  className="header-file-icon" 
                  onClick={() => onShowInvoice({
                    ...orderData,
                    conversationId: message.conversationId
                  })} 
                />
              </h2>
              <FaTimes className="header-close" onClick={onClose} />
            </div>
            <div className="banner-timeline">
              {/* Creation event dot */}
              <div className="timeline-step">
                <div 
                  className="step-point active" 
                  title={`Order Created\n${
                    message.order?.createdAt?.seconds 
                      ? new Date(message.order.createdAt.seconds * 1000).toLocaleDateString()
                      : new Date().toLocaleDateString()
                  }`}
                />
                <div className="step-line" />
              </div>
              
              {/* Timeline events */}
              {timelineEvents.map((event, index) => (
                <div key={event.id} className="timeline-step">
                  <div 
                    className={`step-point active ${event.type === 'payment' ? 'payment' : ''}`}
                    title={`${event.description}\n${
                      event.timestamp 
                        ? event.timestamp.toLocaleDateString() 
                        : new Date().toLocaleDateString()
                    }`}
                  />
                  <div className="step-line" />
                </div>
              ))}
              
              {/* Add event button */}
              <div className="timeline-step">
                <div 
                  className="step-point add-point" 
                  onClick={() => setShowAddEvent(true)}
                  title="Add timeline event"
                >
                  <FaPlus className="add-icon" />
                </div>
              </div>
            </div>
            {showAddEvent && (
              <div className="add-event-form">
                <div className="input-button-group">
                  <input
                    type="text"
                    value={newEventText}
                    onChange={(e) => setNewEventText(e.target.value)}
                    placeholder="Enter event description..."
                    className="event-input"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddEvent();
                      }
                    }}
                  />
                </div>
                <button onClick={handleAddEvent} className="cancel-btn">
                  Add Event
                </button>
              </div>
            )}
          </div>

          <div className="modal-content">
            <div className="service-info-container">
              <div className="service-pills">
                <div className="info-pill">
                  <span className="label" style={{ 
                    color: 'rgba(255, 255, 255, 0.8)', 
                    fontSize: '0.8rem',
                    fontWeight: '400',
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    SERVICE
                  </span>
                  <span className="value" style={{ 
                    color: 'white',
                    fontSize: '1.2rem',
                    fontWeight: '600'
                  }}>
                    {quoteData?.serviceRequired || 'N/A'}
                  </span>
                </div>
                <div className="info-pill">
                  <span className="label" style={{ 
                    color: 'rgba(255, 255, 255, 0.8)', 
                    fontSize: '0.8rem',
                    fontWeight: '400',
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    TOTAL UNIT COUNT
                  </span>
                  <span className="value" style={{ 
                    color: 'white',
                    fontSize: '1.2rem',
                    fontWeight: '600'
                  }}>
                    {totalUnits}
                  </span>
                </div>
              </div>
              
              <div className="size-breakdown">
                {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((size) => (
                  <div key={size} className="size-box">
                    <span className="size-label">{size}</span>
                    <span className="size-value">
                      {quantities[size] || '0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Mockup Preview Section */}
            {quoteData?.mockupFiles?.[0] && (
              <div className="mockup-section">
                <div 
                  className="mockup-preview"
                  onClick={() => handleFileClick(quoteData.mockupFiles[0])}
                  style={{ cursor: 'pointer' }}
                >
                  <img 
                    src={quoteData.mockupFiles[0].downloadURL} 
                    alt="Product Mockup"
                  />
                </div>
              </div>
            )}

            {/* Source Files Section */}
            {quoteData?.sourceFiles?.length > 0 && (
              <div className="files-section">
                <button 
                  className="files-toggle"
                  onClick={() => setShowSourceFiles(!showSourceFiles)}
                >
                  <span>Source Files</span>
                  {showSourceFiles ? <FaChevronUp /> : <FaChevronDown />}
                </button>
                
                {showSourceFiles && (
                  <div className="files-list">
                    {quoteData.sourceFiles.map((file, index) => (
                      <div 
                        key={index} 
                        className="file-preview-item"
                        onClick={() => handleFileClick(file)}
                      >
                        <div className="file-preview-image">
                          <img 
                            src={file.downloadURL} 
                            alt={file.name}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = ''; // Clear broken image
                            }}
                          />
                        </div>
                        <span className="file-name">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add File Preview Modal */}
            {selectedFile && (
              <div className="modal-overlay" onClick={() => setSelectedFile(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{selectedFile.name}</h3>
                    <div className="modal-actions">
                      <button 
                        className="modal-button download"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownload(selectedFile.downloadURL, selectedFile.name);
                        }}
                      >
                        <FaDownload /> Download
                      </button>
                      <button 
                        className="modal-button close"
                        onClick={() => setSelectedFile(null)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="modal-body">
                    <img 
                      src={selectedFile.downloadURL} 
                      alt={selectedFile.name}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes Section */}
            {quoteData?.projectDescription && (
              <div className="notes-section">
                <h3>Notes</h3>
                <p>{quoteData.projectDescription}</p>
              </div>
            )}

            {/* Delivery Section */}
            {orderData.shipping && (
              <div className="delivery-section">
                <h3>Delivery Details</h3>
                <p>
                  <strong>Method: </strong>
                  {orderData.shipping.method || 'Standard Shipping'}
                </p>
                {orderData.shipping.address && (
                  <p>
                    <strong>Address: </strong>
                    {`${orderData.shipping.address.street || ''}, ${orderData.shipping.address.city || ''}, ${orderData.shipping.address.state || ''} ${orderData.shipping.address.zip || ''}`}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default OrderOverviewModal; 