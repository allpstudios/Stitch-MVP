import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { 
  FaStar, 
  FaMapMarkerAlt, 
  FaPhone, 
  FaEnvelope, 
  FaGlobe,
  FaClock,
  FaBox,
  FaInstagram,
  FaTiktok,
  FaFacebookF,
  FaStore,
  FaArrowLeft,
  FaShareAlt
} from 'react-icons/fa';
import './PublicVendorProfile.css';
import QuoteRequestModal from '../components/QuoteRequestModal';

const PublicVendorProfile = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('company');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  useEffect(() => {
    const fetchVendorProfile = async () => {
      try {
        const vendorDoc = await getDoc(doc(db, 'vendors', vendorId));
        if (vendorDoc.exists()) {
          setVendor({ id: vendorDoc.id, ...vendorDoc.data() });
        } else {
          setError('Vendor not found');
        }
      } catch (err) {
        setError('Error loading vendor profile');
        console.error('Error fetching vendor:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVendorProfile();
  }, [vendorId]);

  const handleMessageClick = async () => {
    // Check if user is logged in
    if (!user) {
      alert('Please log in to message this vendor');
      navigate('/login');
      return;
    }

    // Make sure vendor data is loaded
    if (!vendor) {
      alert('Vendor information not available');
      return;
    }

    console.log('Starting message flow for vendor:', vendorId);
    setMessageLoading(true); // Start loading

    try {
      // Check if a conversation already exists between the user and vendor
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      let existingConversation = null;
      
      // Find an existing conversation with this vendor
      querySnapshot.forEach(doc => {
        const conversation = doc.data();
        if (conversation.participants?.includes(vendorId)) {
          existingConversation = { id: doc.id, ...conversation };
        }
      });
      
      if (existingConversation) {
        console.log('Found existing conversation:', existingConversation.id);
        
        // Navigate to the conversation
        navigate('/dashboard/messages', {
          state: {
            activeTab: 'messages',
            selectedChatId: existingConversation.id,
            forceOpen: true,
            openThread: true
          }
        });
      } else {
        // Ensure we have the vendor's company name
        const vendorName = vendor.companyName || 'Unknown Vendor';
        const userName = userProfile?.companyName || 'You';
        
        console.log('Creating new conversation between brand and vendor');
        
        // Create new conversation
        const newConversation = {
          participants: [user.uid, vendorId],
          participantIds: [user.uid, vendorId], // Add participantIds to match security rules
          participantNames: {
            [user.uid]: userName,
            [vendorId]: vendorName
          },
          participantTypes: {
            [user.uid]: userProfile?.userType || 'brand',
            [vendorId]: 'vendor'
          },
          brandId: user.uid,
          vendorId: vendorId,
          lastMessage: 'Started a conversation',
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
          senderName: userName,
          recipientId: vendorId,
          recipientName: vendorName,
          content: `Started a conversation with ${vendorName}`,
          timestamp: serverTimestamp(),
          type: 'system',
          readBy: [user.uid]
        });
        
        console.log('Navigating to new conversation with state:', {
          activeTab: 'messages',
          selectedChatId: newConversationRef.id,
          forceOpen: true,
          openThread: true
        });
        
        // Navigate to the new conversation
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
      console.error('Error finding/creating conversation:', error);
      alert('There was an error starting the conversation. Please try again.');
      // Fallback to simple navigation
      navigate(`/dashboard/messages?vendorId=${vendor.id}`);
    } finally {
      setMessageLoading(false); // End loading
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
      // Debug the incoming quote data
      console.log('Quote data received from modal:', JSON.stringify(quoteData, null, 2));
      
      // Clean up the quoteData to avoid undefined fields
      const cleanQuoteData = {
        serviceRequired: quoteData?.quoteDetails?.serviceRequired || quoteData.serviceRequired || '',
        quantity: quoteData?.quoteDetails?.quantity || quoteData.quantity || '',
        timeline: quoteData?.quoteDetails?.timeline || quoteData.timeline || 'Standard',
        projectDescription: quoteData?.quoteDetails?.projectDescription || quoteData.projectDescription || '',
        quantities: quoteData?.quoteDetails?.quantities || quoteData.quantities || {},
        mockupFiles: quoteData?.quoteDetails?.mockupFiles || quoteData.mockupFiles || [],
        sourceFiles: quoteData?.quoteDetails?.sourceFiles || quoteData.sourceFiles || [],
        status: 'pending',
        date: new Date().toISOString(),
      };

      console.log('Creating quote with cleaned data:', cleanQuoteData);

      // Check if conversation already exists
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

  const renderCompanyInfoSection = () => (
    <div className="public-content-section">
      <h2>Overview</h2>
      <div className="public-info-grid">
        <div className="public-info-card">
          <FaMapMarkerAlt />
          <h3>Location</h3>
          <p>{vendor.location?.address || 'Contact for details'}</p>
        </div>
        <div className="public-info-card">
          <FaPhone />
          <h3>Contact</h3>
          <p>{vendor.phoneNumber || 'Contact for details'}</p>
        </div>
        <div className="public-info-card">
          <FaGlobe />
          <h3>Website</h3>
          <p>
            {vendor.website ? (
              <a href={vendor.website} target="_blank" rel="noopener noreferrer">
                {vendor.website}
              </a>
            ) : 'Contact for details'}
          </p>
        </div>
        <div className="public-info-card">
          <FaEnvelope />
          <h3>Email</h3>
          <p>{vendor.email || 'Contact for details'}</p>
        </div>
      </div>

      <div className="public-company-description">
        <h3>About Us</h3>
        <p>{vendor.description || 'No description available.'}</p>
      </div>

      {vendor.socialMedia && (
        <div className="social-links">
          {vendor.socialMedia.instagram && (
            <a href={`https://instagram.com/${vendor.socialMedia.instagram}`} target="_blank" rel="noopener noreferrer" className="social-link">
              <FaInstagram /> Instagram
            </a>
          )}
          {vendor.socialMedia.tiktok && (
            <a href={`https://tiktok.com/@${vendor.socialMedia.tiktok}`} target="_blank" rel="noopener noreferrer" className="social-link">
              <FaTiktok /> TikTok
            </a>
          )}
          {vendor.socialMedia.facebook && (
            <a href={vendor.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="social-link">
              <FaFacebookF /> Facebook
            </a>
          )}
        </div>
      )}
    </div>
  );

  const renderServicesSection = () => (
    <div className="public-content-section">
      <h2>Our Services</h2>
      <div className="public-services-grid">
        {vendor.services?.map((service, index) => {
          const serviceName = typeof service === 'object' ? service.name : service;
          const moq = typeof service === 'object' ? service.moq : null;
          const leadTime = typeof service === 'object' ? service.leadTime : null;
          const serviceImage = typeof service === 'object' ? service.image : null;
          
          return (
            <div key={index} className="public-service-card">
              {serviceImage ? (
                <div className="public-service-image">
                  <img src={serviceImage} alt={serviceName || 'Service'} />
                </div>
              ) : (
                <div className="public-service-icon">
                  <FaBox />
                </div>
              )}
              <h3>{serviceName || 'Unnamed Service'}</h3>
              <div className="public-service-details">
                <span>MOQ: {moq || 'Contact for details'}</span>
                <span>Lead Time: {leadTime || 'Contact for details'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {vendor.specializations && vendor.specializations.length > 0 && (
        <div className="public-capabilities-section">
          <h3>Specializations</h3>
          <div className="public-tags-container">
            {vendor.specializations.map((spec, index) => (
              <span key={index} className="public-tag">{spec}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderPortfolioSection = () => (
    <div className="public-content-section">
      <h2>Portfolio</h2>
      
      {/* Gallery Section */}
      <div className="public-portfolio-section">
        <h3>Gallery</h3>
        <p className="public-section-description">
          A showcase of our work in a collage format.
        </p>
        
        {vendor.galleryImages && vendor.galleryImages.length > 0 && (
          <div className="public-gallery-grid">
            {vendor.galleryImages.map((image, index) => (
              <div key={index} className="public-gallery-item">
                <img src={image} alt={`Gallery item ${index + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects Section */}
      <div className="public-portfolio-section">
        <h3>Projects</h3>
        <p className="public-section-description">
          Detailed projects showcasing our expertise.
        </p>
        
        <div className="public-portfolio-grid">
          {vendor.portfolio?.map((item, index) => (
            <div key={index} className="public-portfolio-card">
              <div className="public-portfolio-image">
                {item.image && <img src={item.image} alt={item.title} />}
              </div>
              <div className="public-portfolio-info">
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderClientsSection = () => (
    <div className="public-content-section">
      <h2>Our Clients</h2>
      <div className="public-clients-display-grid">
        {vendor.clientsList?.map((client, index) => (
          <div key={index} className="public-client-card">
            {client.logo ? (
              <div className="public-client-logo">
                <img src={client.logo} alt={client.name} />
              </div>
            ) : (
              <div className="public-client-icon">
                <FaStore />
              </div>
            )}
            <div className="public-client-info">
              <h3>{client.name}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderReviewsSection = () => (
    <div className="public-content-section">
      <h2>Reviews</h2>
      <div className="public-reviews-overview">
        <div className="public-rating-summary">
          <div className="public-average-rating">
            <FaStar className="public-star-icon" />
            <span className="public-rating-number">4.8</span>
          </div>
          <p className="public-total-reviews">Based on 24 reviews</p>
        </div>
        <div className="public-rating-bars">
          <div className="public-rating-bar">
            <span className="public-stars">5 stars</span>
            <div className="public-bar-container">
              <div className="public-bar" style={{ width: '80%' }}></div>
            </div>
            <span className="public-count">20</span>
          </div>
          <div className="public-rating-bar">
            <span className="public-stars">4 stars</span>
            <div className="public-bar-container">
              <div className="public-bar" style={{ width: '15%' }}></div>
            </div>
            <span className="public-count">3</span>
          </div>
          <div className="public-rating-bar">
            <span className="public-stars">3 stars</span>
            <div className="public-bar-container">
              <div className="public-bar" style={{ width: '5%' }}></div>
            </div>
            <span className="public-count">1</span>
          </div>
          <div className="public-rating-bar">
            <span className="public-stars">2 stars</span>
            <div className="public-bar-container">
              <div className="public-bar" style={{ width: '0%' }}></div>
            </div>
            <span className="public-count">0</span>
          </div>
          <div className="public-rating-bar">
            <span className="public-stars">1 star</span>
            <div className="public-bar-container">
              <div className="public-bar" style={{ width: '0%' }}></div>
            </div>
            <span className="public-count">0</span>
          </div>
        </div>
      </div>
      
      <div className="public-reviews-list">
        {/* Placeholder reviews - in production these would come from the vendor data */}
        <div className="public-review-card">
          <div className="public-review-header">
            <div className="public-reviewer-info">
              <div className="public-reviewer-avatar">B</div>
              <div>
                <h4>Brand Name</h4>
                <div className="public-review-rating">
                  <FaStar className="public-star-icon" />
                  <FaStar className="public-star-icon" />
                  <FaStar className="public-star-icon" />
                  <FaStar className="public-star-icon" />
                  <FaStar className="public-star-icon" />
                </div>
              </div>
            </div>
            <span className="public-review-date">2 months ago</span>
          </div>
          <p className="public-review-text">
            "Excellent service and quality! The team was very professional and delivered exactly what we needed. 
            Communication was great throughout the entire process."
          </p>
        </div>
        
        <div className="public-review-card">
          <div className="public-review-header">
            <div className="public-reviewer-info">
              <div className="public-reviewer-avatar">C</div>
              <div>
                <h4>Client Name</h4>
                <div className="public-review-rating">
                  <FaStar className="public-star-icon" />
                  <FaStar className="public-star-icon" />
                  <FaStar className="public-star-icon" />
                  <FaStar className="public-star-icon" />
                  <FaStar className="public-star-icon" />
                </div>
              </div>
            </div>
            <span className="public-review-date">1 month ago</span>
          </div>
          <p className="public-review-text">
            "Very satisfied with the results. The attention to detail and quick turnaround time were impressive. 
            Would definitely work with them again."
          </p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="loading">Loading vendor profile...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!vendor) {
    return <div className="error">Vendor not found</div>;
  }

  return (
    <div className="public-profile-container">
      <button 
        className="public-back-button"
        onClick={() => navigate(-1)}
        title="Go back"
      >
        <FaArrowLeft /> Back
      </button>
      
      <div className="public-profile-header">
        <div className="public-profile-cover">
          {vendor.coverImage && <img src={vendor.coverImage} alt="Cover" className="public-cover-image" />}
        </div>
        
        <div className="public-profile-quick-info">
          <div className="public-company-logo">
            {vendor.logo ? (
              <div className="public-logo-preview">
                <img src={vendor.logo} alt={vendor.companyName} className="public-logo-image" />
              </div>
            ) : (
              <div className="public-logo-placeholder">
                {vendor.companyName?.charAt(0)}
              </div>
            )}
          </div>

          <div>
            <h1>{vendor.companyName}</h1>
            <div className="public-vendor-rating">
              <FaStar className="public-star-icon" />
              <span>4.8</span>
              <span className="public-review-count">(24 reviews)</span>
            </div>
            {vendor.categories && vendor.categories.length > 0 && (
              <div className="public-vendor-categories">
                {vendor.categories.map((category, index) => (
                  <span key={index} className="public-category-tag">{category}</span>
                ))}
              </div>
            )}
            <div className="public-contact-icons-row">
              {vendor.location?.address && (
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(vendor.location.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-contact-icon"
                >
                  <FaMapMarkerAlt />
                  <span className="public-contact-tooltip">{vendor.location.address}</span>
                </a>
              )}
              {vendor.phoneNumber && (
                <a 
                  href={`tel:${vendor.phoneNumber}`}
                  className="public-contact-icon"
                >
                  <FaPhone />
                  <span className="public-contact-tooltip">{vendor.phoneNumber}</span>
                </a>
              )}
              {vendor.website && (
                <a 
                  href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-contact-icon"
                >
                  <FaGlobe />
                  <span className="public-contact-tooltip">{vendor.website}</span>
                </a>
              )}
              {vendor.socialMedia && (Object.values(vendor.socialMedia).some(link => link)) && (
                <a 
                  href={
                    vendor.socialMedia.instagram 
                      ? `https://instagram.com/${vendor.socialMedia.instagram}` 
                      : vendor.socialMedia.tiktok 
                        ? `https://tiktok.com/@${vendor.socialMedia.tiktok}` 
                        : vendor.socialMedia.facebook || "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-contact-icon social-icon"
                >
                  <FaShareAlt />
                  <span className="public-contact-tooltip">Social Media</span>
                </a>
              )}
            </div>
          </div>

          <div className="public-profile-actions">
            <button 
              className="public-action-btn message"
              onClick={handleMessageClick}
              disabled={messageLoading}
            >
              {messageLoading ? '⏳ Loading...' : '💬 Message'}
            </button>
            <button 
              className="public-action-btn quote"
              onClick={() => setShowQuoteModal(true)}
              disabled={isQuoteLoading}
            >
              {isQuoteLoading ? '⏳ Loading...' : '📝 Request Quote'}
            </button>
          </div>
        </div>
      </div>

      <div className="public-profile-nav">
        <button 
          className={activeSection === 'company' ? 'active' : ''} 
          onClick={() => setActiveSection('company')}
        >
          Overview
        </button>
        <button 
          className={activeSection === 'services' ? 'active' : ''} 
          onClick={() => setActiveSection('services')}
        >
          Services
        </button>
        <button 
          className={activeSection === 'portfolio' ? 'active' : ''} 
          onClick={() => setActiveSection('portfolio')}
        >
          Portfolio
        </button>
        <button 
          className={activeSection === 'clients' ? 'active' : ''} 
          onClick={() => setActiveSection('clients')}
        >
          Clients
        </button>
        <button 
          className={activeSection === 'reviews' ? 'active' : ''} 
          onClick={() => setActiveSection('reviews')}
        >
          Reviews
        </button>
      </div>

      <div className="public-profile-content">
        {activeSection === 'services' ? renderServicesSection() :
         activeSection === 'portfolio' ? renderPortfolioSection() :
         activeSection === 'clients' ? renderClientsSection() :
         activeSection === 'reviews' ? renderReviewsSection() :
         renderCompanyInfoSection()}
      </div>

      {showQuoteModal && (
        <QuoteRequestModal
          vendorName={vendor.companyName}
          onClose={() => setShowQuoteModal(false)}
          vendorId={vendor.id}
          onSubmit={handleQuoteSubmit}
        />
      )}
    </div>
  );
};

export default PublicVendorProfile; 