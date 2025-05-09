import React, { useState, useEffect } from 'react';
import './VendorCard.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import { db } from '../firebase';
import QuoteRequestModal from './QuoteRequestModal';
import { 
  FaMapMarkerAlt, 
  FaPhone, 
  FaEnvelope, 
  FaGlobe, 
  FaShareAlt,
  FaStar,
  FaCubes,
  FaClock,
  FaUser
} from 'react-icons/fa';

const VendorCard = ({ vendor, isSelected, onClick }) => {
  const [showContact, setShowContact] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedMockupFiles, setSelectedMockupFiles] = useState([]);
  const [selectedSourceFiles, setSelectedSourceFiles] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [deadline, setDeadline] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  // Log exactly what we receive
  console.log('VendorCard received vendor data:', JSON.stringify({
    id: vendor.id,
    companyName: vendor.companyName,
    logo: vendor.logo || vendor.profileImage,
    categories: vendor.categories,
    allData: vendor
  }, null, 2));

  // Debug logging for vendor services and MOQ data
  useEffect(() => {
    // Print everything we need for debugging
    console.log(`VENDOR DATA DEBUG for ${vendor.companyName}:`, {
      vendorId: vendor.id || vendor.uid,
      vendorName: vendor.companyName,
      services: vendor.services,
      hasServices: Boolean(vendor.services && vendor.services.length > 0),
      servicesType: vendor.services ? typeof vendor.services : 'undefined',
      servicesIsArray: Array.isArray(vendor.services),
      serviceStrings: Array.isArray(vendor.services) 
        ? vendor.services.filter(s => typeof s === 'string').map(s => s.trim())
        : [],
      serviceObjects: Array.isArray(vendor.services)
        ? vendor.services.filter(s => typeof s === 'object' && s !== null)
        : []
    });

    // Special detailed logging for each service
    if (Array.isArray(vendor.services)) {
      vendor.services.forEach((service, index) => {
        console.log(`${vendor.companyName} Service #${index+1}:`, {
          type: typeof service,
          value: service,
          isObject: typeof service === 'object' && service !== null,
          hasMoq: typeof service === 'object' && service !== null ? Boolean(service.moq) : false,
          moqValue: typeof service === 'object' && service !== null ? service.moq : null
        });
      });
    }
  }, [vendor]);

  // Check if this vendor has MOQ information to display
  const hasServiceMOQs = () => {
    if (!vendor.services || !Array.isArray(vendor.services) || vendor.services.length === 0) {
      return false;
    }
    
    // Show MOQs if we have any services
    return vendor.services.length > 0;
  };

  // Get the minimum MOQ to display on the badge
  const getMinimumMOQ = () => {
    if (!vendor.services || !Array.isArray(vendor.services) || vendor.services.length === 0) {
      return "Contact for details";
    }
    
    const moqValues = [];
    
    // Process each service to extract MOQ values
    vendor.services.forEach(service => {
      if (typeof service === 'object' && service !== null && service.moq) {
        // Handle service objects with explicit MOQ values
        const moqString = service.moq.toString();
        const numericValue = parseInt(moqString.replace(/\D/g, ''));
        
        if (!isNaN(numericValue)) {
          moqValues.push({
            service: service.name || 'Service',
            moq: moqString,
            numericValue: numericValue
          });
        }
      } else if (typeof service === 'string') {
        // Define default MOQ values for string-based services
        const defaultMoqs = {
          'Screen Printing': '50',
          'DTF Print': '12',
          'Embroidery': '24',
          'DTG Printing': '1',
          'Fulfillment': '50'
        };
        
        // Find a matching default MOQ
        const key = Object.keys(defaultMoqs).find(k => 
          k.toLowerCase().trim() === service.toLowerCase().trim()
        );
        
        if (key) {
          moqValues.push({
            service: service,
            moq: defaultMoqs[key],
            numericValue: parseInt(defaultMoqs[key])
          });
        }
      }
    });
    
    console.log(`${vendor.companyName} MOQ values found:`, moqValues);
    
    // If we found any MOQ values, return the lowest one
    if (moqValues.length > 0) {
      moqValues.sort((a, b) => a.numericValue - b.numericValue);
      return moqValues[0].moq;
    }
    
    return "Contact for details";
  };

  // Format turnaround times to be more compact
  const formatTurnaroundTime = (time) => {
    if (!time) return "Contact for details";
    
    // Make display more compact by removing "days" text if it ends with "days"
    return time.replace(/(\d+-\d+) days/, "$1d").replace(/(\d+) days/, "$1d");
  };

  // Get the fastest turnaround time to display
  const getFastestTurnaround = () => {
    if (!vendor.services || !Array.isArray(vendor.services) || vendor.services.length === 0) {
      return "Contact";
    }
    
    const turnaroundValues = [];
    
    // Process each service to extract turnaround/lead time values
    vendor.services.forEach(service => {
      if (typeof service === 'object' && service !== null && service.leadTime) {
        // Use the explicit leadTime from service object
        turnaroundValues.push({
          service: service.name || 'Service',
          leadTime: service.leadTime.toString()
        });
      } else if (typeof service === 'string') {
        // Define default turnaround times for string-based services
        const defaultTurnarounds = {
          'Screen Printing': '10-14d',
          'DTF Print': '5-7d',
          'Embroidery': '7-10d',
          'DTG Printing': '3-5d',
          'Fulfillment': '1-3d'
        };
        
        // Find a matching default turnaround
        const key = Object.keys(defaultTurnarounds).find(k => 
          k.toLowerCase().trim() === service.toLowerCase().trim()
        );
        
        if (key) {
          turnaroundValues.push({
            service: service,
            leadTime: defaultTurnarounds[key]
          });
        }
      }
    });
    
    // If we found any turnaround values, return a sensible one
    if (turnaroundValues.length > 0) {
      // Let's just return the first one for now
      // In a more sophisticated implementation, we could try to find the fastest one
      return formatTurnaroundTime(turnaroundValues[0].leadTime);
    }
    
    return "Contact";
  };

  // Get all service MOQs for this vendor to display in tooltip
  const getServiceMOQs = () => {
    if (!vendor.services || !Array.isArray(vendor.services) || vendor.services.length === 0) {
      return [];
    }
    
    const result = [];
    
    // Process services to extract MOQ information
    vendor.services.forEach(service => {
      if (typeof service === 'object' && service !== null) {
        if (service.moq) {
          result.push({
            name: service.name || 'Service',
            moq: service.moq.toString()
          });
        }
      } else if (typeof service === 'string') {
        // Define default MOQ values for string-based services
        const defaultMoqs = {
          'Screen Printing': '50',
          'DTF Print': '12',
          'Embroidery': '24',
          'DTG Printing': '1',
          'Fulfillment': '50'
        };
        
        // Find a matching default MOQ
        const key = Object.keys(defaultMoqs).find(k => 
          k.toLowerCase().trim() === service.toLowerCase().trim()
        );
        
        if (key) {
          result.push({
            name: service,
            moq: defaultMoqs[key]
          });
        }
      }
    });
    
    return result;
  };

  // Get all service turnaround times for this vendor to display in tooltip
  const getServiceTurnarounds = () => {
    if (!vendor.services || !Array.isArray(vendor.services) || vendor.services.length === 0) {
      return [];
    }
    
    const result = [];
    
    // Process services to extract turnaround information
    vendor.services.forEach(service => {
      if (typeof service === 'object' && service !== null) {
        if (service.leadTime) {
          result.push({
            name: service.name || 'Service',
            leadTime: service.leadTime.toString()
          });
        }
      } else if (typeof service === 'string') {
        // Define default turnaround times for string-based services
        const defaultTurnarounds = {
          'Screen Printing': '10-14 days',
          'DTF Print': '5-7 days',
          'Embroidery': '7-10 days',
          'DTG Printing': '3-5 days',
          'Fulfillment': '1-3 days'
        };
        
        // Find a matching default turnaround
        const key = Object.keys(defaultTurnarounds).find(k => 
          k.toLowerCase().trim() === service.toLowerCase().trim()
        );
        
        if (key) {
          result.push({
            name: service,
            leadTime: defaultTurnarounds[key]
          });
        }
      }
    });
    
    return result;
  };

  const startConversation = async (vendorId, vendorName, conversationType) => {
    if (!user) {
      alert('You need to sign in to send messages.');
      navigate('/login');
      return;
    }

    // Set loading state
    setIsMessageLoading(true);

    try {
      // Check if conversation already exists
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', user.uid)
      );
      const querySnapshot = await getDocs(q);
      let existingChat = null;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(vendorId)) {
          existingChat = { id: doc.id, ...data };
        }
      });

      if (existingChat) {
        console.log('Found existing conversation:', existingChat.id);
        
        // Only update necessary fields to avoid messing with existing data
        const chatDoc = doc(db, 'conversations', existingChat.id);
        
        // Keep original fields and just update minimal fields
        const updateData = {
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        // Only add these fields if they don't exist
        if (!existingChat.brandId) updateData.brandId = user.uid;
        if (!existingChat.vendorId) updateData.vendorId = vendorId;
        if (!existingChat.participantIds) updateData.participantIds = [user.uid, vendorId];

        // Only update if there's something to update
        if (Object.keys(updateData).length > 0) {
          try {
            await updateDoc(chatDoc, updateData);
            console.log('Updated conversation timestamp');
          } catch (error) {
            console.error('Error updating conversation:', error);
            // Continue anyway - we can still try to navigate
          }
        }
        
        // IMPORTANT: Navigate to existing conversation with state to force open the thread
        console.log('Navigating to existing chat:', existingChat.id);
        navigate('/dashboard/messages', {
          state: {
            activeTab: 'messages',
            selectedChatId: existingChat.id,
            forceOpen: true,
            openThread: true
          }
        });
      } else {
        // Create new conversation
        const newConversation = {
          participants: [user.uid, vendorId],
          participantIds: [user.uid, vendorId], // Add participantIds to match security rules
          brandId: user.uid, // Add explicit brandId field
          vendorId: vendorId, // Add explicit vendorId field
          participantNames: {
            [user.uid]: userProfile?.companyName || 'You',
            [vendorId]: vendorName
          },
          participantTypes: {
            [user.uid]: userProfile?.userType || 'brand',
            [vendorId]: 'vendor'
          },
          lastMessage: conversationType === 'inquiry' ? 'Started a conversation' : 'Sent a quote request',
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unreadCount: {
            [user.uid]: 0,
            [vendorId]: 1
          }
        };

        const newConversationRef = await addDoc(conversationsRef, newConversation);
        console.log('Created new conversation with ID:', newConversationRef.id);

        // Send first system message
        const messagesRef = collection(db, 'messages');
        await addDoc(messagesRef, {
          conversationId: newConversationRef.id,
          senderId: user.uid,
          senderName: userProfile?.companyName || 'You',
          recipientId: vendorId,
          recipientName: vendorName,
          brandId: user.uid, // Add explicit brandId field
          vendorId: vendorId, // Add explicit vendorId field
          content: conversationType === 'inquiry' 
            ? `Started a conversation with ${vendorName}` 
            : `Sent a quote request to ${vendorName}`,
          timestamp: serverTimestamp(),
          type: 'system',
          readBy: [user.uid]
        });
        
        // IMPORTANT: Navigate to new conversation with state to force open the thread
        console.log('Navigating to new chat:', newConversationRef.id);
        navigate('/dashboard/messages', {
          state: {
            activeTab: 'messages',
            selectedChatId: newConversationRef.id,
            forceOpen: true,
            openThread: true
          }
        });
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation. Please try again.');
    } finally {
      // Reset loading state after a short delay to prevent UI flicker during navigation
      // Note: This may not execute if navigation has already started
      setTimeout(() => {
        setIsMessageLoading(false);
      }, 500);
    }
  };

  const handleQuoteSubmit = async (quoteData) => {
    if (!user) {
      alert('You need to sign in to send a quote request.');
      navigate('/login');
      return;
    }

    // Set loading state
    setIsQuoteLoading(true);

    try {
      const vendorId = vendor.id || vendor.uid;
      
      // Debug the incoming quote data
      console.log('Quote data received from modal:', JSON.stringify(quoteData, null, 2));
      
      // Clean up the quoteData to avoid undefined fields
      const cleanQuoteData = {
        serviceRequired: quoteData?.quoteDetails?.serviceRequired || quoteData.serviceRequired || '',
        quantity: quoteData?.quoteDetails?.quantity || quoteData.quantity || '',
        timeline: quoteData?.quoteDetails?.timeline || quoteData.timeline || 'Standard',
        status: 'pending',
        date: new Date().toISOString(),
        projectDescription: quoteData?.quoteDetails?.projectDescription || quoteData.projectDescription || '',
        quantities: quoteData?.quoteDetails?.quantities || quoteData.quantities || {},
        mockupFiles: quoteData?.quoteDetails?.mockupFiles || quoteData.mockupFiles || [],
        sourceFiles: quoteData?.quoteDetails?.sourceFiles || quoteData.sourceFiles || [],
        deliveryMethod: quoteData?.quoteDetails?.deliveryMethod || quoteData.deliveryMethod || 'pickup',
        shippingAddress: quoteData?.quoteDetails?.shippingAddress || quoteData.shippingAddress || null,
        // Include vendor details
        selectedVendor: {
          id: vendorId,
          name: vendor.companyName
        }
      };
      
      // Debug the cleaned quote data
      console.log('Cleaned quote data:', JSON.stringify(cleanQuoteData, null, 2));

      // Check if a conversation already exists - IMPROVED QUERY
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', user.uid)
      );
      const querySnapshot = await getDocs(q);
      let existingConversation = null;
      
      // Loop through all conversations to find a match
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Check if the vendor is a participant in this conversation
        if (data.participants && Array.isArray(data.participants) && data.participants.includes(vendorId)) {
          existingConversation = { id: doc.id, ...data };
          console.log('Found existing conversation for quote:', existingConversation.id);
        }
      });

      let conversationId;
      
      // Handle existing conversation
      if (existingConversation) {
        conversationId = existingConversation.id;
        console.log('Using existing conversation for quote:', conversationId);
        
        // Minimal update to avoid corrupting conversation data
        const updateData = {
          lastMessage: 'Sent a quote request',
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          [`unreadCount.${vendorId}`]: increment(1)
        };
        
        // Only add missing required fields
        if (!existingConversation.brandId) updateData.brandId = user.uid;
        if (!existingConversation.vendorId) updateData.vendorId = vendorId;
        if (!existingConversation.participantIds) updateData.participantIds = [user.uid, vendorId];
        
        try {
          await updateDoc(doc(db, 'conversations', conversationId), updateData);
          console.log('Updated conversation for quote request');
        } catch (error) {
          console.error('Error updating conversation for quote:', error);
          // Continue anyway - we'll still try to add the message
        }
      } else {
        // Create a new conversation if needed
        console.log('No existing conversation found, creating new one for quote');
        const newConversation = {
          participants: [user.uid, vendorId],
          participantIds: [user.uid, vendorId],
          brandId: user.uid, 
          vendorId: vendorId,
          participantNames: {
            [user.uid]: userProfile?.companyName || 'You',
            [vendorId]: vendor.companyName
          },
          participantTypes: {
            [user.uid]: userProfile?.userType || 'brand',
            [vendorId]: 'vendor'
          },
          lastMessage: 'Sent a quote request',
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unreadCount: {
            [user.uid]: 0,
            [vendorId]: 1
          }
        };

        const newConversationRef = await addDoc(conversationsRef, newConversation);
        conversationId = newConversationRef.id;
        console.log('Created new conversation with ID:', conversationId);
        
        // Send first system message
        const messagesRef = collection(db, 'messages');
        await addDoc(messagesRef, {
          conversationId: conversationId,
          senderId: user.uid,
          senderName: userProfile?.companyName || 'You',
          recipientId: vendorId,
          recipientName: vendor.companyName,
          brandId: user.uid,
          vendorId: vendorId,
          content: `Started a conversation with ${vendor.companyName}`,
          timestamp: serverTimestamp(),
          type: 'system',
          readBy: [user.uid]
        });
      }

      // Create quote message in the conversation
      console.log('Adding quote message to conversation:', conversationId);
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        conversationId: conversationId,
        senderId: user.uid,
        senderName: userProfile?.companyName || 'You',
        recipientId: vendorId,
        recipientName: vendor.companyName,
        content: 'Sent a quote request',
        quoteDetails: cleanQuoteData,
        timestamp: serverTimestamp(),
        type: 'quote',
        brandId: user.uid,
        vendorId: vendorId,
        readBy: [user.uid]
      });

      // Create a quote request document
      console.log('Creating quote document linked to conversation:', conversationId);
      const quotesRef = collection(db, 'quotes');
      const newQuote = {
        senderId: user.uid,
        senderName: userProfile?.companyName || 'Anonymous User',
        senderType: userProfile?.userType || 'brand',
        recipientId: vendorId,
        recipientName: vendor.companyName,
        brandId: user.uid,
        vendorId: vendorId,
        quoteDetails: cleanQuoteData,
        files: cleanQuoteData.mockupFiles.concat(cleanQuoteData.sourceFiles || []),
        createdAt: serverTimestamp(),
        status: 'active',
        archived: false,
        conversationId: conversationId
      };

      await addDoc(quotesRef, newQuote);
      console.log('Quote request created successfully');

      // Close modal
      setShowQuoteModal(false);
      
      // Navigate to the conversation with state to open thread
      console.log('Navigating to conversation with quote:', conversationId);
      navigate('/dashboard/messages', {
        state: {
          activeTab: 'messages',
          selectedChatId: conversationId,
          forceOpen: true,
          openThread: true
        }
      });
      
    } catch (error) {
      console.error('Error submitting quote:', error);
      alert('Failed to submit quote request. Please try again.');
    } finally {
      // Always reset the loading state, even if navigation occurs
      setIsQuoteLoading(false);
    }
  };

  const uploadFile = async (file, path) => {
    try {
      const storage = getStorage();
      const storageRef = ref(storage, path);
      
      // Add metadata explicitly
      const metadata = {
        contentType: file.type,
      };
      
      const uploadResult = await uploadBytes(storageRef, file, metadata);
      const url = await getDownloadURL(uploadResult.ref);
      return url;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Render the MOQ tooltip content
  const renderMoqTooltipContent = () => {
    const servicesMoqs = getServiceMOQs();

    if (servicesMoqs.length === 0) {
      return (
        <div className="moq-tooltip-no-services">
          No service-specific MOQs available
        </div>
      );
      }

    return (
      <>
        <div className="moq-tooltip-title">Service MOQs</div>
        {servicesMoqs.map((service, index) => (
          <div key={index} className="moq-tooltip-item">
            <span className="moq-tooltip-service">{service.name}:</span>
            <span className="moq-tooltip-quantity">{service.moq}</span>
          </div>
        ))}
      </>
    );
  };

  // Render the Turnaround tooltip content
  const renderTurnaroundTooltipContent = () => {
    const serviceTurnarounds = getServiceTurnarounds();
    
    if (serviceTurnarounds.length === 0) {
      return (
        <div className="moq-tooltip-no-services">
          No service-specific turnaround times available
        </div>
      );
    }
    
    return (
      <>
        <div className="moq-tooltip-title">Service Turnaround Times</div>
        {serviceTurnarounds.map((service, index) => (
          <div key={index} className="moq-tooltip-item">
            <span className="moq-tooltip-service">{service.name}:</span>
            <span className="moq-tooltip-quantity">{service.leadTime}</span>
          </div>
        ))}
      </>
    );
  };

  return (
    <div 
      className={`vendor-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      data-vendor-id={vendor.id}
    >
      <div className="vendor-card-header">
        <div className="vendor-profile">
          {vendor.logo || vendor.profileImage ? (
            <img 
              src={vendor.logo || vendor.profileImage}
              alt={vendor.companyName} 
              className="vendor-profile-image"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.companyName)}&background=random`;
              }}
            />
          ) : (
            <div className="vendor-profile-placeholder">
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.companyName)}&background=random`}
                alt={vendor.companyName}
                className="vendor-profile-image"
              />
            </div>
          )}
          <div className="vendor-info">
            <h3>{vendor.companyName}</h3>
            <div className="vendor-rating">
              <FaStar className="star-icon" />
              <span>4.8</span>
              <span className="review-count">(24)</span>
            </div>
          </div>
        </div>
        <button 
          className="view-profile-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/vendor/${vendor.uid || vendor.id}`);
          }}
          title="View Profile"
        >
          <FaUser />
        </button>
      </div>
      
      {/* Service Tags */}
      {vendor.services && vendor.services.length > 0 && (
        <div className="vendor-services">
          {Array.from(new Set(vendor.services.map(service => 
            typeof service === 'object' ? service.name || '' : 
            typeof service === 'string' ? service : ''
          ))).filter(Boolean).map((serviceName, index) => (
            <span key={index} className="service-tag">
              {serviceName}
            </span>
        ))}
      </div>
      )}

      {/* MOQ and Turnaround Section */}
      {hasServiceMOQs() ? (
        <div className="vendor-details-section">
          <div className="vendor-moq-section">
            <FaCubes className="moq-icon" />
            <div className="moq-tooltip">
              <span className="moq-badge">MOQ: {getMinimumMOQ()}</span>
              <div className="moq-tooltip-content">
                {renderMoqTooltipContent()}
            </div>
            </div>
            </div>

          <div className="vendor-turnaround-section">
            <FaClock className="turnaround-icon" />
            <div className="moq-tooltip">
              <span className="moq-badge">Turn: {getFastestTurnaround()}</span>
              <div className="moq-tooltip-content">
                {renderTurnaroundTooltipContent()}
              </div>
            </div>
            </div>
            </div>
      ) : (
        null
      )}

      <div className="vendor-actions">
        <button 
          className="action-btn message"
          onClick={(e) => {
            e.stopPropagation();
            startConversation(vendor.uid || vendor.id, vendor.companyName, 'inquiry');
          }}
          disabled={isMessageLoading}
        >
          {isMessageLoading ? '⏳ Loading...' : '💬 Message'}
        </button>
        <button 
          className="action-btn quote"
          onClick={(e) => {
            e.stopPropagation();
            setShowQuoteModal(true);
          }}
          disabled={isQuoteLoading}
        >
          {isQuoteLoading ? '⏳ Loading...' : '📝 Request Quote'}
        </button>
      </div>

      {showQuoteModal && (
        <QuoteRequestModal
          vendorName={vendor.companyName}
          onClose={() => setShowQuoteModal(false)}
          onSubmit={handleQuoteSubmit}
        />
      )}
    </div>
  );
};

export default VendorCard; 