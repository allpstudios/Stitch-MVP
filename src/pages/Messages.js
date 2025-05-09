import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaFile, FaPaperclip, FaDownload, FaThumbsUp, FaThumbsDown, FaQuestion, FaRobot, FaPaperPlane, FaBars, FaFileAlt } from 'react-icons/fa';
import './Messages.css';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDocs, writeBatch, arrayUnion, arrayRemove, getDoc, increment, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import QuoteDetailsModal from '../components/QuoteDetailsModal';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import MessageItem from '../components/MessageItem';
import CreateOrder from '../components/CreateOrder';
import QuoteRequestModal from '../components/QuoteRequestModal';
import { createMessageThread } from '../services/MessageService';
import OrderOverviewModal from '../components/OrderOverviewModal';
import OrderInvoiceModal from '../components/OrderInvoiceModal';
import { useLocation } from 'react-router-dom';

const StitchAIThread = ({ onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useAuth();
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      const messagesRef = collection(db, 'aiChats');
      const q = query(
        messagesRef,
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const loadedMessages = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .reverse();
      
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading AI chat history:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // Save user message
      await addDoc(collection(db, 'aiChats'), {
        userId: currentUser.uid,
        text: userMessage,
        type: 'user',
        timestamp: serverTimestamp()
      });

      // TODO: Replace with actual AI backend call
      setTimeout(async () => {
        // Save AI response
        await addDoc(collection(db, 'aiChats'), {
          userId: currentUser.uid,
          text: "I'll help you find the perfect vendors for your needs. Let me search through our database...",
          type: 'ai',
          timestamp: serverTimestamp()
        });

        await loadMessages();
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-thread">
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.type}-message`}>
            {message.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Stitch AI about vendors..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            <FaPaperPlane />
          </button>
        </form>
      </div>
    </div>
  );
};

const ChatSidebar = ({ isOpen, selectedChat, currentUser }) => {
  const [activeTab, setActiveTab] = useState('quotes');
  const [sharedContent, setSharedContent] = useState({
    quotes: [],
    orders: [],
    files: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [sharedQuotes, setSharedQuotes] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);

  useEffect(() => {
    let unsubscribers = [];
    
    const setupListeners = async () => {
      if (!selectedChat || !currentUser) {
        setSharedContent({
          quotes: [],
          orders: [],
          files: []
        });
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Query for quotes
        const quotesQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', selectedChat),
          where('type', '==', 'quote')
        );

        const quotesUnsubscribe = onSnapshot(quotesQuery, 
          (snapshot) => {
            setSharedContent(prev => ({
              ...prev,
              quotes: snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                type: 'quote'
              }))
            }));
          },
          (error) => {
            console.error('Quotes listener error:', error);
          }
        );

        // Query for files in messages
        const filesQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', selectedChat),
          where('type', '==', 'file'),
          orderBy('timestamp', 'desc')
        );

        const filesUnsubscribe = onSnapshot(filesQuery,
          (snapshot) => {
            setSharedContent(prev => ({
              ...prev,
              files: snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  fileName: data.fileName,
                  fileUrl: data.fileUrl,
                  fileType: data.type || 'file',
                  uploadedAt: data.timestamp,
                  type: 'file'
                };
              })
            }));
          },
          (error) => {
            console.error('Files listener error:', error);
          }
        );

        // Query for orders
        const ordersQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', selectedChat),
          where('type', '==', 'order'),
          orderBy('timestamp', 'desc')
        );

        const ordersUnsubscribe = onSnapshot(ordersQuery,
          (snapshot) => {
            setSharedContent(prev => ({
              ...prev,
              orders: snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  ...data,
                  orderNumber: data.order?.orderNumber || 'N/A',
                  date: data.timestamp?.toDate() || new Date(),
                  total: data.order?.total || 0,
                  type: 'order'
                };
              })
            }));
          },
          (error) => {
            console.error('Orders listener error:', error);
          }
        );

        // Query for messages in this conversation that are quotes
        const messagesRef = collection(db, 'messages');
        const q = query(
          messagesRef,
          where('conversationId', '==', selectedChat),
          where('type', '==', 'quote'),
          orderBy('timestamp', 'desc')
        );

        const messageQuotesUnsubscribe = onSnapshot(q, (snapshot) => {
          const quotesList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setSharedQuotes(quotesList);
        });

        unsubscribers.push(quotesUnsubscribe, filesUnsubscribe, ordersUnsubscribe, messageQuotesUnsubscribe);
        setLoading(false);
      } catch (error) {
        console.error('Error setting up listeners:', error);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubscribers.forEach(unsubscribe => {
        try {
          if (unsubscribe) unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      });
      unsubscribers = [];
    };
  }, [selectedChat, currentUser]);

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <FaFile />;
    if (fileType?.includes('pdf')) return <FaFile />;
    if (fileType?.includes('doc')) return <FaFile />;
    if (fileType?.includes('sheet')) return <FaFile />;
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

  const calculateTotalQuantity = (quantities) => {
    if (!quantities) return 0;
    return Object.values(quantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
  };

  const renderContent = () => {
    if (loading) {
      return <div className="loading">Loading shared content...</div>;
    }

    const content = sharedContent[activeTab] || [];
    
    if (content.length === 0) {
      return <div className="no-items">No {activeTab} shared yet</div>;
    }

    switch (activeTab) {
      case 'quotes':
        return sharedQuotes.length > 0 ? (
          <div className="shared-items">
            {sharedQuotes.map((quote) => (
              <div 
                key={quote.id} 
                className="shared-item"
                onClick={() => setSelectedQuote(quote)}
              >
                <div className="item-header">
                  <span className="item-title">
                    {quote.quoteDetails?.serviceRequired || quote.quoteDetails?.services?.[0]?.service || 'Quote Request'}
                  </span>
                  <span className="item-date">
                    {quote.timestamp?.toDate?.()?.toLocaleDateString() || 'N/A'}
                  </span>
                </div>
                <div className="item-details">
                  Total Quantity: {calculateTotalQuantity(quote.quoteDetails?.quantities || quote.quoteDetails?.services?.[0]?.quantities || {})}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-items">No quotes shared yet</div>
        );
      case 'orders':
        return (
          <div className="shared-items">
            {content.map(item => {
              // Extract order data from the message
              const orderData = item.order || {};
              // Calculate total from items
              let total = 0;
              if (orderData.items?.length > 0) {
                total = orderData.items.reduce((sum, item) => {
                  const rate = parseFloat(item.rate || item.price || 0);
                  const quantity = parseInt(item.quantity || 0);
                  return sum + (rate * quantity);
                }, 0);
              }

              return (
                <div 
                  key={item.id} 
                  className="shared-item"
                  onClick={() => setSelectedOrder(item)}
                >
                  <div className="item-header">
                    <span className="item-title">
                      Order #{orderData.orderNumber || 'N/A'}
                    </span>
                    <span className="item-date">
                      {item.timestamp?.toDate?.()?.toLocaleDateString() || 'N/A'}
                    </span>
                  </div>
                  <div className="item-details">
                    <div>Customer: {orderData.customer?.name || orderData.brandName || 'N/A'}</div>
                    <div>Total: ${parseFloat(total).toFixed(2)}</div>
                    <div>Status: {orderData.status?.fulfillment || 'unfulfilled'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      case 'files':
        return (
          <div className="files-grid">
            {content.map(item => (
              <div
                key={item.id}
                className="file-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewFile(item);
                }}
              >
                <div className="image-preview">
                  <img 
                    src={item.fileUrl} 
                    alt={item.fileName}
                  />
                  <div className="image-overlay">
                    <FaDownload className="download-icon" />
                  </div>
                </div>
                <div className="file-name">
                  {item.fileName}
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className={`chat-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h3>Shared Content</h3>
          </div>
          
          <div className="content-tabs">
            <button 
              className={`content-tab ${activeTab === 'quotes' ? 'active' : ''}`}
              onClick={() => setActiveTab('quotes')}
            >
              Quotes {sharedContent.quotes.length > 0 && `(${sharedContent.quotes.length})`}
            </button>
            <button 
              className={`content-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              Orders {sharedContent.orders.length > 0 && `(${sharedContent.orders.length})`}
            </button>
            <button 
              className={`content-tab ${activeTab === 'files' ? 'active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              Files {sharedContent.files.length > 0 && `(${sharedContent.files.length})`}
            </button>
          </div>

          {renderContent()}
        </div>
      </div>

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

      {selectedQuote && (
        <QuoteDetailsModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
        />
      )}

      {selectedOrder && (
        <OrderOverviewModal
          message={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onShowInvoice={() => {
            setSelectedOrder(null);
            // Calculate totals from items
            const items = selectedOrder.order?.items || [];
            const subtotal = items.reduce((sum, item) => {
              const rate = parseFloat(item.rate || item.price || 0);
              const quantity = parseInt(item.quantity || 0);
              return sum + (rate * quantity);
            }, 0);
            const tax = subtotal * 0.0875; // 8.75% tax rate
            const shipping = selectedOrder.order?.shipping?.cost || 0;
            const total = subtotal + tax + shipping;

            setSelectedInvoiceOrder({
              ...selectedOrder.order,
              conversationId: selectedOrder.conversationId,
              items: items,
              totals: {
                subtotal: subtotal,
                tax: tax,
                shipping: shipping,
                total: total
              },
              status: selectedOrder.order?.status || {
                payment: 'pending',
                fulfillment: 'unfulfilled'
              }
            });
            setShowInvoice(true);
          }}
        />
      )}

      {showInvoice && selectedInvoiceOrder && (
        <OrderInvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => {
            setShowInvoice(false);
            setSelectedInvoiceOrder(null);
          }}
        />
      )}
    </>
  );
};

const Messages = ({ initialChatId, openThread }) => {
  const { user, userProfile } = useAuth();
  const location = useLocation();
  const [activeChat, setActiveChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);
  const [showThreadActions, setShowThreadActions] = useState(null);
  const [starredThreads, setStarredThreads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  // ⚠️ IMPORTANT: DO NOT REMOVE THIS REF ⚠️
  // This ref is used to focus the message input field when a conversation is opened
  // and is referenced by multiple functions throughout the component
  const messageInputRef = useRef(null);
  
  const [selectedChat, setSelectedChat] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [shouldOpenThread, setShouldOpenThread] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);
  const [deletedThreads, setDeletedThreads] = useState([]);

  // Safe find utility function to prevent errors
  const safeFindInArray = (array, predicate, defaultValue) => {
    if (!array || !Array.isArray(array)) return defaultValue;
    try {
      const result = array.find(predicate);
      return result !== undefined ? result : defaultValue;
    } catch (error) {
      console.error('Error in safeFindInArray:', error);
      return defaultValue;
    }
  };
  
  // Safe get participant name utility
  const getParticipantName = (conversation, defaultName = 'Chat') => {
    if (!conversation) return defaultName;
    
    try {
      if (conversation.participantNames) {
        if (Array.isArray(conversation.participantNames)) {
          return safeFindInArray(
            conversation.participantNames, 
            name => name !== userProfile?.companyName, 
            defaultName
          );
        } else if (typeof conversation.participantNames === 'object') {
          const namesArray = Object.values(conversation.participantNames);
          return safeFindInArray(
            namesArray, 
            name => name !== userProfile?.companyName, 
            defaultName
          );
        }
      }
      
      // Fallback to participant ID if names not available
      if (conversation.participants && Array.isArray(conversation.participants)) {
        const otherId = safeFindInArray(
          conversation.participants, 
          id => id !== user?.uid, 
          null
        );
        return otherId ? `User ${otherId.substring(0, 5)}` : defaultName;
      }
      
      return defaultName;
    } catch (error) {
      console.error('Error getting participant name:', error);
      return defaultName;
    }
  };

  // Get conversation ID from URL
  const conversationId = location.pathname.split('/').pop();
  const isValidConversationId = conversationId && conversationId !== 'messages';

  // Add a new ref to track active listeners
  const activeListeners = useRef([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Effect to handle initial chat setup
  useEffect(() => {
    console.log('Messages component received:', { 
      initialChatId, 
      openThread, 
      locationState: location?.state,
      conversationId,
      isValidConversationId
    });
    
    // Process state variables 
    const chatId = isValidConversationId 
      ? conversationId 
      : location?.state?.selectedChatId || initialChatId;
    
    const shouldForceOpen = !!location?.state?.forceOpen;
    const shouldOpenThread = shouldForceOpen || 
                           !!location?.state?.openThread || 
                           !!openThread;
    
    if (chatId) {
      console.log('Setting active chat and opening thread:', chatId);
      // Set state for selectedChat and activeChat
      setActiveChat(chatId);
      setSelectedChat(chatId);
      
      // Handle thread opening
      if (shouldOpenThread) {
        setShowThread(true);
        
        // Make sure we load the conversation data
        handleConversationClick(chatId);
        
        // Scroll to the input box after a short delay
        if (shouldForceOpen) {
          setTimeout(() => {
            if (messageInputRef.current) {
              messageInputRef.current.focus();
            }
          }, 500);
        }
      }
    }
  }, [location, initialChatId, openThread, conversationId, isValidConversationId]);

  useEffect(() => {
    if (activeChat) {
      console.log('Active chat changed:', activeChat);
      if (shouldOpenThread) {
        console.log('Opening thread for active chat');
        setShowThread(true);
        setShouldOpenThread(false);
      }
    }
  }, [activeChat, shouldOpenThread]);

  // Effect to fetch conversations
  useEffect(() => {
    if (!user) return;

    console.log('Setting up conversations listener');
    
    // Create the Stitch AI thread
    const stitchAiThread = {
      id: 'stitch-ai',
      name: 'Stitch AI Assistant',
      lastMessage: 'Ask me anything about vendors or fashion production!',
      timestamp: new Date(),
      isAI: true,
      participants: [], // Add empty array to prevent .find() error
      participantNames: ['Stitch AI Assistant']
    };
    
    // This query watches for changes in conversations where user is a participant
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        console.log('Conversations snapshot received, size:', snapshot.size);
        let conversationList = snapshot.docs
          .map(doc => {
            const data = doc.data();
            
            // Safely handle lastMessage whether it's a string or an object
            let safeLastMessage = '';
            if (typeof data.lastMessage === 'string') {
              safeLastMessage = data.lastMessage;
            } else if (data.lastMessage && typeof data.lastMessage === 'object') {
              safeLastMessage = data.lastMessage.text || 'New message';
            }
            
            // Handle unreadCount field name inconsistency
            let unreadCount = {};
            if (data.unreadCount) {
              unreadCount = data.unreadCount;
            } else if (data.unreadCounts) {
              unreadCount = data.unreadCounts;
            }
            
            return {
              id: doc.id,
              ...data,
              lastMessage: safeLastMessage,
              unreadCount: unreadCount
            };
          })
          .filter(conv => {
            // Filter out conversations the user has deleted locally
            return !deletedThreads.includes(conv.id);
          });

        // Always add Stitch AI as the first conversation
        conversationList = [stitchAiThread, ...conversationList];

        // If user is a brand, ensure ALLP Studios is always in the list
        if (userProfile?.userType === 'brand') {
          const ALLP_STUDIOS_ID = 'lwJ2Ja9jmEUZgV2yCvlCScZXlAR2';
          const hasAllpStudios = conversationList.some(conv => 
            conv.participants && conv.participants.includes(ALLP_STUDIOS_ID) && 
            conv.id !== 'stitch-ai' // Make sure this isn't the Stitch AI conversation
          );

          if (!hasAllpStudios) {
            // Add ALLP Studios as a default conversation option
            conversationList.push({
              id: `default-allp-${user.uid}`,
              participants: [user.uid, ALLP_STUDIOS_ID],
              participantNames: {
                [user.uid]: userProfile?.companyName || 'You',
                [ALLP_STUDIOS_ID]: 'ALLP STUDIOS'
              },
              lastMessage: 'Click to start messaging with ALLP STUDIOS',
              lastMessageAt: new Date(),
              type: 'inquiry',
              vendorId: ALLP_STUDIOS_ID,
              brandId: user.uid,
              unreadCount: { [user.uid]: 0, [ALLP_STUDIOS_ID]: 0 }
            });
          }
        }

        console.log('Setting conversations state with', conversationList.length, 'items');
        
        // Add extra debugging for new conversations
        if (conversationList.length > 0) {
          console.log('First conversation:', {
            id: conversationList[0].id,
            lastMessage: conversationList[0].lastMessage,
            participants: conversationList[0].participants
          });
        }
        
        setConversations(conversationList);
        
        // If we have an initialChatId, make sure it's loaded
        if (initialChatId && openThread) {
          const conversation = conversationList.find(c => c.id === initialChatId);
          if (conversation) {
            handleConversationClick(initialChatId);
          }
        }

        // Keep the currently selected chat if it exists
        if (selectedChat) {
          const stillExists = conversationList.some(c => c.id === selectedChat);
          if (!stillExists && conversationList.length > 0) {
            // If the selected chat is gone but we have other chats, select the first one
            setSelectedChat(conversationList[0].id);
          }
        }
      },
      error: (error) => {
        console.error('Error in conversations listener:', error);
      }
    });

    // Clean up on unmount
    return () => {
      console.log('Cleaning up conversations listener');
      unsubscribe();
    };
  }, [user, userProfile, initialChatId, openThread, deletedThreads]);

  // Modify handleConversationClick to handle the default ALLP Studios conversation
  const handleConversationClick = async (conversationId) => {
    try {
      // Clean up all active listeners before switching
      activeListeners.current.forEach(unsubscribe => {
        try {
          if (unsubscribe) unsubscribe();
        } catch (error) {
          console.error('Error cleaning up listener:', error);
        }
      });
      activeListeners.current = [];

      setMessages([]); // Clear messages before loading new ones
      setActiveChat(conversationId);
      setSelectedChat(conversationId);
      setSidebarOpen(false);

      // Add debugging for selected conversation
      console.log('Handling conversation click for ID:', conversationId);
      
      // Special handling for "default-allp" conversations - create an actual conversation
      if (conversationId.startsWith('default-allp')) {
        console.log('Creating new conversation with ALLP Studios');
        
        const ALLP_STUDIOS_ID = 'lwJ2Ja9jmEUZgV2yCvlCScZXlAR2';
        
        // Create a real conversation in Firestore
        try {
          const conversationsRef = collection(db, 'conversations');
          const newConversation = {
            participants: [user.uid, ALLP_STUDIOS_ID],
            participantIds: [user.uid, ALLP_STUDIOS_ID], // Add participantIds to match security rules
            participantNames: {
              [user.uid]: userProfile?.companyName || 'You',
              [ALLP_STUDIOS_ID]: 'ALLP STUDIOS'
            },
            participantTypes: {
              [user.uid]: userProfile?.userType || 'brand',
              [ALLP_STUDIOS_ID]: 'vendor'
            },
            brandId: userProfile?.userType === 'brand' ? user.uid : ALLP_STUDIOS_ID,
            vendorId: userProfile?.userType === 'vendor' ? user.uid : ALLP_STUDIOS_ID,
            lastMessage: 'Started a conversation with ALLP STUDIOS',
            lastMessageAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            unreadCount: {
              [user.uid]: 0,
              [ALLP_STUDIOS_ID]: 1
            }
          };
          
          // Create the conversation document
          const newConversationRef = await addDoc(conversationsRef, newConversation);
          
          // Send initial system message
          const messagesRef = collection(db, 'messages');
          await addDoc(messagesRef, {
            conversationId: newConversationRef.id,
            senderId: user.uid,
            senderName: userProfile?.companyName || 'You',
            recipientId: ALLP_STUDIOS_ID,
            recipientName: 'ALLP STUDIOS',
            content: 'Started a conversation with ALLP STUDIOS',
            timestamp: serverTimestamp(),
            type: 'system',
            readBy: [user.uid]
          });
          
          // Update state to use the real conversation ID
          setActiveChat(newConversationRef.id);
          setSelectedChat(newConversationRef.id);
          console.log('Created real conversation with ID:', newConversationRef.id);
        } catch (error) {
          console.error('Error creating new conversation:', error);
          alert('Error creating new conversation. Please try again.');
        }
        
        // Return early - the conversations listener will pick up the new conversation
        return;
      }

      // Get conversation data and set other user
      let otherParticipantId;
      try {
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationSnap = await getDoc(conversationRef);
        if (conversationSnap.exists()) {
          const conversationData = conversationSnap.data();
          
          // Check if user is a participant
          if (!conversationData.participants?.includes(user.uid)) {
            console.error('User is not a participant in this conversation');
            alert('You do not have permission to view this conversation');
            setActiveChat(null);
            setSelectedChat(null);
            return;
          }
          
          otherParticipantId = conversationData.participants.find(id => id !== user.uid);
          
          // Get other user's data
          if (otherParticipantId) {
            try {
              const otherUserRef = doc(db, 'users', otherParticipantId);
              const otherUserSnap = await getDoc(otherUserRef);
              if (otherUserSnap.exists()) {
                setOtherUser({
                  uid: otherParticipantId,
                  ...otherUserSnap.data()
                });
              }
            } catch (error) {
              console.error('Error fetching other user data:', error);
              // Continue anyway - this is not critical
            }
          }
          
          // Try to mark messages as read
          try {
            await markMessagesAsRead(conversationId);
          } catch (error) {
            console.error('Error marking messages as read:', error);
            // Continue anyway - message reading is not critical
          }
        } else {
          console.error('Conversation not found', conversationId);
          alert('This conversation no longer exists');
          setActiveChat(null);
          setSelectedChat(null);
          return;
        }
      } catch (error) {
        console.error('Error fetching conversation:', error);
        // Continue anyway - we'll try to get messages
      }

      // Set up real-time listener for all messages in this conversation
      try {
        const messagesQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', conversationId),
          orderBy('timestamp', 'asc')
        );

        const messagesUnsubscribe = onSnapshot(
          messagesQuery, 
          {
            next: (snapshot) => {
              console.log(`Received ${snapshot.docs.length} messages for conversation ${conversationId}`);
              const messageList = snapshot.docs
                .map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                  timestamp: doc.data().timestamp || null
                }))
                .filter(Boolean);

              // Log message types for debugging
              messageList.forEach(msg => {
                console.log(`Message: type=${msg.type}, senderId=${msg.senderId}, content=${msg.content || msg.text}`);
              });

              setMessages(messageList);
              
              // Scroll to bottom after messages load
              setTimeout(() => {
                scrollToBottom();
              }, 100);
            },
            error: (error) => {
              console.error('Error in messages listener:', error);
              if (error.code === 'permission-denied') {
                alert('You do not have permission to view messages in this conversation');
                setActiveChat(null);
                setSelectedChat(null);
              }
            }
          }
        );
        
        activeListeners.current.push(messagesUnsubscribe);
      } catch (error) {
        console.error('Error setting up messages listener:', error);
        if (error.code === 'permission-denied') {
          alert('You do not have permission to view messages in this conversation');
          setActiveChat(null);
          setSelectedChat(null);
          return;
        }
      }
      
      // Focus the message input after switching conversation
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error handling conversation click:', error);
      alert('There was an error loading the conversation. Please try again.');
    }
  };

  // Modify the useEffect for messages
  useEffect(() => {
    if (!activeChat || !user) {
      setMessages([]);
      return;
    }

    let unsubscribe;
    try {
      const q = query(
        collection(db, 'messages'),
        where('conversationId', '==', activeChat),
        orderBy('timestamp', 'asc')
      );

      unsubscribe = onSnapshot(q, {
        next: (snapshot) => {
          const messageList = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp || null,
              reactions: doc.data().reactions || {}
            }))
            .filter(Boolean);

          const uniqueMessages = messageList.reduce((acc, current) => {
            if (!acc.find(item => item.id === current.id)) {
              acc.push(current);
            }
            return acc;
          }, []);

          setMessages(uniqueMessages);
        },
        error: (error) => {
          console.error('Error in messages listener:', error);
          setMessages([]);
        }
      });

      activeListeners.current.push(unsubscribe);
    } catch (error) {
      console.error('Error setting up messages listener:', error);
    }

    return () => {
      try {
        if (unsubscribe) {
          unsubscribe();
          activeListeners.current = activeListeners.current.filter(listener => listener !== unsubscribe);
        }
      } catch (error) {
        console.error('Error cleaning up messages listener:', error);
      }
    };
  }, [activeChat, user]);

  // Add this new useEffect to track unread messages
  useEffect(() => {
    if (!user) return;

    const unreadQuery = query(
      collection(db, 'messages'),
      where('readBy', 'array-contains-any', [user.uid])
    );

    const unsubscribe = onSnapshot(unreadQuery, (snapshot) => {
      const counts = {};
      snapshot.docs.forEach(doc => {
        const message = doc.data();
        if (!message.readBy.includes(user.uid)) {
          counts[message.conversationId] = (counts[message.conversationId] || 0) + 1;
        }
      });
      setUnreadCounts(counts);
    });

    return () => unsubscribe();
  }, [user]);

  // Add this useEffect to fetch starred threads
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('starredBy', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStarredThreads(snapshot.docs.map(doc => doc.id));
    });

    return () => unsubscribe();
  }, [user]);

  // Add this effect near the other useEffect hooks
  useEffect(() => {
    const handleRefresh = async (event) => {
      const { threadId, forceReload } = event.detail;
      if (threadId) {
        if (forceReload) {
          // Force cleanup of existing listeners
          activeListeners.current.forEach(unsubscribe => {
            try {
              if (unsubscribe) unsubscribe();
            } catch (error) {
              console.error('Error cleaning up listener:', error);
            }
          });
          activeListeners.current = [];
          
          // Clear messages before reloading
          setMessages([]);
          
          // Set the active chat and reload messages
          setActiveChat(threadId);
          setSelectedChat(threadId);
          
          // Set up new message listener
          const q = query(
            collection(db, 'messages'),
            where('conversationId', '==', threadId),
            orderBy('timestamp', 'asc')
          );

          const unsubscribe = onSnapshot(q, {
            next: (snapshot) => {
              const messageList = snapshot.docs
                .map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                  timestamp: doc.data().timestamp || null,
                  reactions: doc.data().reactions || {}
                }))
                .filter(Boolean);

              setMessages(messageList);
            },
            error: (error) => {
              console.error('Error in messages listener:', error);
              setMessages([]);
            }
          });

          activeListeners.current.push(unsubscribe);
        } else {
          // Just reload messages for this thread
          handleConversationClick(threadId);
        }
      }
    };

    window.addEventListener('refreshMessages', handleRefresh);
    return () => window.removeEventListener('refreshMessages', handleRefresh);
  }, [handleConversationClick]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    try {
      // Check if the conversation exists first
      const conversationRef = doc(db, 'conversations', activeChat);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        console.error('Conversation does not exist');
        alert('This conversation no longer exists. Please refresh the page.');
        return;
      }
      
      // Get the conversation data to find the other participant
      const conversationData = conversationSnap.data();
      
      // Check if user is a participant
      if (!conversationData.participants?.includes(user.uid)) {
        console.error('User is not a participant in this conversation');
        alert('You do not have permission to send messages in this conversation.');
        return;
      }
      
      const otherParticipantId = conversationData.participants.find(id => id !== user.uid);
      
      if (!otherParticipantId) {
        console.error('Cannot find recipient');
        alert('Cannot identify the recipient for this message.');
        return;
      }
      
      // Try adding the message optimistically to improve UX
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        conversationId: activeChat,
        senderId: user.uid,
        senderName: userProfile?.companyName || 'User',
        recipientId: otherParticipantId,
        recipientName: getParticipantName(conversationData),
        content: newMessage,
        timestamp: new Date(),
        readBy: [user.uid],
        type: 'text',
        _isOptimistic: true
      };
      
      // Add to UI immediately
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Clear input to show message was sent
      setNewMessage('');
      
      try {
        // Try to add message to Firestore
        const messageRef = collection(db, 'messages');
        const { _isOptimistic, id, ...messageData } = optimisticMessage;
        
        // Set timestamp to server timestamp
        messageData.timestamp = serverTimestamp();
        
        const messageDoc = await addDoc(messageRef, messageData);
        console.log('Message sent successfully with ID:', messageDoc.id);
        
        // Try to update conversation data
        try {
          await updateDoc(conversationRef, {
            lastMessage: newMessage,
            lastMessageAt: serverTimestamp(),
            [`unreadCount.${otherParticipantId}`]: increment(1)
          });
          console.log('Conversation updated with last message');
        } catch (error) {
          console.error('Failed to update conversation data:', error);
          // Don't alert the user since the message was still sent
        }
      } catch (error) {
        console.error('Error sending message to Firestore:', error);
        
        // Remove optimistic message from UI
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        
        // Show error to user
        if (error.code === 'permission-denied') {
          alert('You do not have permission to send messages in this conversation.');
        } else {
          alert('Failed to send message. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.code === 'permission-denied') {
        alert('You do not have permission to send messages in this conversation.');
      } else {
        alert('Failed to send message. Please try again later.');
      }
    }
  };

  // Update the markMessagesAsRead function
  const markMessagesAsRead = async (conversationId) => {
    try {
      // First check if the conversation exists and user is a participant
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        console.log('Conversation not found, cannot mark messages as read');
        return;
      }
      
      const conversationData = conversationSnap.data();
      if (!conversationData.participants?.includes(user.uid)) {
        console.log('User is not a participant in this conversation');
        return;
      }
      
      // Now fetch messages that need to be marked as read
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        where('senderId', '!=', user.uid)
      );

      try {
        const snapshot = await getDocs(messagesQuery);
        
        if (snapshot.empty) {
          console.log('No unread messages to mark as read');
          return;
        }
        
        // Create a batch to update messages
        const batch = writeBatch(db);
        let updatesNeeded = false;
        
        snapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          // Only update if the user hasn't read this message yet
          if (!data.readBy?.includes(user.uid)) {
            updatesNeeded = true;
            const messageRef = doc(db, 'messages', docSnapshot.id);
            batch.update(messageRef, {
              readBy: arrayUnion(user.uid)
            });
          }
        });
        
        // Only commit the batch if we have updates to make
        if (updatesNeeded) {
          await batch.commit();
          console.log('Successfully marked messages as read');
        } else {
          console.log('No updates needed - all messages already read');
        }
      } catch (error) {
        // This is likely a permission error, but we can ignore it
        console.log('Could not mark messages as read (permission issue):', error.message);
      }

      // Don't try to update the conversation's unread count if we had issues earlier
      // This is likely to fail with the same permission error
    } catch (error) {
      console.error('Error marking messages as read:', error);
      // Don't throw the error - just log it
    }
  };

  const toggleStar = async (conversationId, e) => {
    e.stopPropagation();
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const isCurrentlyStarred = starredThreads.includes(conversationId);
      
      await updateDoc(conversationRef, {
        starredBy: isCurrentlyStarred 
          ? arrayRemove(user.uid)
          : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error('Error toggling star:', error);
    }
  };

  const deleteThread = (conversationId, e) => {
    if (e) {
      e.stopPropagation(); // Prevent the click from selecting the conversation
    }
    
    try {
      console.log('Deleting conversation:', conversationId);
      
      // Update local state first for responsiveness
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // If this was the active conversation, clear it
      if (activeChat === conversationId) {
        setActiveChat(null);
        setSelectedChat(null);
      }

      // Add to deleted threads
      const updatedDeletedThreads = [...deletedThreads, conversationId];
      setDeletedThreads(updatedDeletedThreads);
      
      // Save to localStorage
      const deletedThreadsKey = `deletedThreads_${user.uid}`;
      localStorage.setItem(deletedThreadsKey, JSON.stringify(updatedDeletedThreads));
      
      console.log('Conversation deleted locally');
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat) return;

    try {
      // Create a temporary message to show upload progress
      const tempMessageId = `temp-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: tempMessageId,
        type: 'file',
        senderId: user.uid,
        fileName: file.name,
        isUploading: true,
        uploadProgress: 0
      }]);

      // Get conversation data to find other participant
      const conversationRef = doc(db, 'conversations', activeChat);
      const conversationSnap = await getDoc(conversationRef);
      if (!conversationSnap.exists()) {
        throw new Error('Conversation not found');
      }
      
      const conversation = conversationSnap.data();
      const otherParticipantId = conversation.participants.find(id => id !== user.uid);

      // Create storage reference
      const storageRef = ref(storage, `messages/${activeChat}/${file.name}`);
      
      // Upload file
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          // Handle progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          // Update the temporary message with progress
          setMessages(prev => prev.map(msg => 
            msg.id === tempMessageId 
              ? { ...msg, uploadProgress: progress }
              : msg
          ));
        },
        (error) => {
          // Handle error
          console.error('Upload error:', error);
          // Remove the temporary message
          setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
        },
        async () => {
          // Handle success - get download URL
          const downloadURL = await getDownloadURL(storageRef);
          
          // Remove the temporary message
          setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
          
          // Create message document
          const messageData = {
            conversationId: activeChat,
            senderId: user.uid,
            senderName: userProfile.companyName,
            type: 'file',
            fileUrl: downloadURL,
            fileName: file.name,
            fileType: file.type,
            timestamp: serverTimestamp(),
            readBy: [user.uid]
          };

          // Create batch for atomic updates
          const batch = writeBatch(db);

          // Add message
          const messageRef = collection(db, 'messages');
          batch.set(doc(messageRef), messageData);

          // Update conversation
          batch.update(conversationRef, {
            lastMessage: `Sent a file: ${file.name}`,
            lastMessageAt: serverTimestamp(),
            [`unreadCount.${otherParticipantId}`]: increment(1)
          });

          await batch.commit();
        }
      );
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const renderMessage = (message) => {
    console.log('Rendering message in Messages.js:', {
      messageId: message.id,
      senderId: message.senderId,
      currentUserId: user.uid,
      isOwnMessage: message.senderId === user.uid,
      type: message.type
    });

    // For order messages, check if the current user is the vendor who created the order
    const isOwnMessage = message.type === 'order' 
      ? (message.order?.vendorId === user.uid || message.orderDetails?.vendorId === user.uid)
      : message.senderId === user.uid;

    return (
      <MessageItem 
        key={message.id}
        message={message}
        isOwnMessage={isOwnMessage}
      />
    );
  };

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    if (initialChatId) {
      console.log('Setting active chat from initialChatId:', initialChatId);
      setActiveChat(initialChatId);
      if (openThread) {
        console.log('Opening thread automatically');
        setShouldOpenThread(true);
      }
    }
  }, [initialChatId, openThread]);

  useEffect(() => {
    if (activeChat) {
      console.log('Active chat changed:', activeChat);
      if (shouldOpenThread) {
        console.log('Opening thread for active chat');
        setShowThread(true);
        setShouldOpenThread(false);
      }
    }
  }, [activeChat, shouldOpenThread]);

  const loadConversations = async () => {
    try {
      // Add Stitch AI as the first conversation with proper structure
      const stitchAiThread = {
        id: 'stitch-ai',
        name: 'Stitch AI Assistant',
        lastMessage: 'Ask me anything about vendors or fashion production!',
        timestamp: new Date(),
        isAI: true,
        participants: [], // Add empty array to prevent .find() error
        participantNames: ['Stitch AI Assistant']
      };

      // Save Stitch AI to localStorage to persist even on refresh
      try {
        localStorage.setItem('stitch_ai_thread', JSON.stringify(stitchAiThread));
      } catch (err) {
        console.warn('Failed to save Stitch AI thread to localStorage:', err);
      }

      // Load actual conversations from Firestore
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', user.uid)
      );
      
      const snapshot = await getDocs(q);
      const loadedConversations = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Safely handle lastMessage whether it's a string or an object
        let safeLastMessage = '';
        if (typeof data.lastMessage === 'string') {
          safeLastMessage = data.lastMessage;
        } else if (data.lastMessage && typeof data.lastMessage === 'object') {
          safeLastMessage = data.lastMessage.text || 'New message';
        }
        
        return {
          id: doc.id,
          ...data,
          lastMessage: safeLastMessage
        };
      });

      // Combine Stitch AI thread with other conversations
      setConversations([stitchAiThread, ...loadedConversations]);
      console.log('Fetched conversations:', [stitchAiThread, ...loadedConversations]);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const renderConversation = (conversation) => {
    if (!conversation) return null;

    // Special handling for Stitch AI thread
    if (conversation.id === 'stitch-ai' || conversation.isAI) {
      return (
        <div 
          key="stitch-ai"
          className={`conversation-item ${selectedChat === 'stitch-ai' ? 'active' : ''}`}
          onClick={() => {
            setSelectedChat('stitch-ai');
          }}
        >
          <div className="conversation-avatar">
            St
          </div>
          <div className="conversation-info">
            <div className="conversation-top">
              <h4>Stitch AI Assistant</h4>
              <div className="conversation-meta">
                <span className="timestamp">
                  AI
                </span>
              </div>
            </div>
            <p className="last-message">
              Ask me anything about vendors or fashion production!
            </p>
          </div>
        </div>
      );
    }

    // Make sure participants exists and is an array
    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    const otherParticipant = safeFindInArray(participants, id => id !== user.uid, null);
    const isSelected = selectedChat === conversation.id;
    const unreadCount = conversation.unreadCount?.[user?.uid] || 0;
    
    // Get the other participant's name using our safe utility
    const otherParticipantName = getParticipantName(conversation);
    const avatarContent = otherParticipantName.substring(0, 2) || '??';
    
    // Handle lastMessage safely whether it's a string or an object
    let lastMessageText = '';
    if (typeof conversation.lastMessage === 'string') {
      lastMessageText = conversation.lastMessage;
    } else if (conversation.lastMessage && typeof conversation.lastMessage === 'object') {
      // If lastMessage is an object, try to get text property or stringify safely
      lastMessageText = conversation.lastMessage.text || 'New message';
      console.log('Converted lastMessage object to string:', lastMessageText);
    }

    return (
      <div 
        key={conversation.id}
        className={`conversation-item ${isSelected ? 'active' : ''} ${
          unreadCount > 0 ? 'unread' : ''
        }`}
        onClick={() => {
          setSelectedChat(conversation.id);
          handleConversationClick(conversation.id);
        }}
        onMouseEnter={() => setShowThreadActions(conversation.id)}
        onMouseLeave={() => setShowThreadActions(null)}
      >
        <div className="conversation-avatar">
          {avatarContent}
        </div>
        <div className="conversation-info">
          <div className="conversation-top">
            <h4>{otherParticipantName}</h4>
            <div className="conversation-meta">
              {unreadCount > 0 && (
                <span className="unread-count">
                  {unreadCount}
                </span>
              )}
              <span className="timestamp">
                {conversation.lastMessageAt?.toDate?.()?.toLocaleDateString() || ''}
              </span>
            </div>
          </div>
          <p className={`last-message ${unreadCount > 0 ? 'unread' : ''}`}>
            {lastMessageText}
          </p>
        </div>
        {showThreadActions === conversation.id && (
          <div className="conversation-actions">
            <button 
              className={`star-btn ${starredThreads.includes(conversation.id) ? 'starred' : ''}`}
              onClick={(e) => toggleStar(conversation.id, e)}
            >
              ⭐
            </button>
            <button 
              className="delete-thread-btn"
              onClick={(e) => deleteThread(conversation.id, e)}
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    );
  };

  // Add cleanup on component unmount
  useEffect(() => {
    return () => {
      activeListeners.current.forEach(unsubscribe => {
        try {
          if (unsubscribe) unsubscribe();
        } catch (error) {
          console.error('Error cleaning up listener:', error);
        }
      });
      activeListeners.current = [];
    };
  }, []);

  // Add this useEffect near the top with other useEffects
  useEffect(() => {
    // Store that messages is open in sessionStorage
    sessionStorage.setItem('activeTab', 'messages');

    // Cleanup
    return () => {
      sessionStorage.removeItem('activeTab');
    };
  }, []);

  // Add this function to handle quote submission
  const handleQuoteSubmit = async (quoteData) => {
    try {
      // Get the current conversation
      const currentConversation = conversations.find(c => c.id === selectedChat);
      if (!currentConversation) {
        console.error('No active conversation found');
        return;
      }
      
      // Get recipient ID safely
      if (!currentConversation.participants || !Array.isArray(currentConversation.participants)) {
        console.error('Invalid participants in conversation');
        return;
      }
      
      const recipientId = safeFindInArray(currentConversation.participants, id => id !== user.uid, null);
      if (!recipientId) {
        console.error('Could not find recipient ID');
        return;
      }
      
      // Get recipient name safely using our utility
      const recipientName = getParticipantName(currentConversation);

      // Create a message about the quote in the conversation
      const messageRef = doc(collection(db, 'messages'));
      await setDoc(messageRef, {
        conversationId: selectedChat,
        senderId: user.uid,
        senderName: userProfile?.companyName || 'User',
        recipientId: recipientId,
        recipientName: recipientName,
        type: 'quote',
        content: 'Sent a quote request',
        quoteDetails: quoteData.quoteDetails,
        timestamp: serverTimestamp(),
        readBy: [user.uid]
      });

      // Update the conversation's last message
      const conversationRef = doc(db, 'conversations', selectedChat);
      await updateDoc(conversationRef, {
        lastMessage: 'Sent a quote request',
        lastMessageAt: serverTimestamp(),
        [`unreadCount.${recipientId}`]: increment(1)
      });

      setShowQuoteForm(false);
    } catch (error) {
      console.error('Error submitting quote:', error);
      alert('Failed to submit quote request. Please try again.');
    }
  };

  const renderFormModal = () => {
    // Safety check for selectedChat
    if (!selectedChat || !conversations || conversations.length === 0) {
      console.error('No selected chat or conversations');
      return null;
    }

      const currentConversation = conversations.find(c => c.id === selectedChat);
    if (!currentConversation) {
      console.error('Selected conversation not found');
      return null;
    }
    
    // Safety check for participants
    if (!currentConversation.participants || !Array.isArray(currentConversation.participants)) {
      console.error('Invalid participants data in conversation');
      return null;
    }
    
    const recipientId = safeFindInArray(currentConversation.participants, id => id !== user?.uid, null);
    if (!recipientId) {
      console.error('Recipient ID not found');
      return null;
    }
    
    // Get recipient name safely using our utility
    const recipientName = getParticipantName(currentConversation);

    if (userProfile?.userType === 'vendor') {
      return (
        <CreateOrder
          onClose={() => setShowForm(false)}
          vendorId={user?.uid}
          customerId={recipientId}
          customerName={recipientName}
          onSubmit={async (orderData) => {
            try {
              // Add necessary fields for message creation
              const orderWithDetails = {
                ...orderData,
                conversationId: selectedChat,
                vendorName: userProfile?.companyName || 'Vendor',
                orderNumber: Math.floor(Math.random() * 1000000), // Generate random order number
                date: new Date().toISOString(),
                status: {
                  payment: 'pending',
                  fulfillment: 'unfulfilled'
                }
              };

              // Create message thread with the order
              await createMessageThread(orderWithDetails);
              
              // Close the form
              setShowForm(false);
            } catch (error) {
              console.error('Error creating order:', error);
              alert('Failed to create order. Please try again.');
            }
          }}
        />
      );
    }
    
    // For brands, show the quote request form
    return (
      <QuoteRequestModal
        onClose={() => setShowForm(false)}
        onSubmit={handleQuoteSubmit}
        vendorName={recipientName}
        isDirectQuote={true}
      />
    );
  };

  // Add this useEffect to load deleted threads from localStorage
  useEffect(() => {
    if (!user) return;
    
    // Load deleted threads from localStorage
    try {
      const deletedThreadsKey = `deletedThreads_${user.uid}`;
      const deletedThreadsJson = localStorage.getItem(deletedThreadsKey);
      if (deletedThreadsJson) {
        setDeletedThreads(JSON.parse(deletedThreadsJson));
      }
    } catch (error) {
      console.error('Error loading deleted threads from localStorage:', error);
    }
  }, [user]);

  // Listen for the refreshMessages custom event
  useEffect(() => {
    const handleRefreshMessages = (event) => {
      const { threadId, forceOpen } = event.detail;
      console.log('Received refreshMessages event:', { threadId, forceOpen });
      
      if (threadId) {
        setActiveChat(threadId);
        setSelectedChat(threadId);
        
        if (forceOpen) {
          console.log('Force opening thread UI for:', threadId);
          setSidebarOpen(false);
          setShowThread(true);
          
          // Focus the input field when the thread is opened
          setTimeout(() => {
            if (messageInputRef.current) {
              messageInputRef.current.focus();
            }
          }, 500);
        }
      }
    };
    
    window.addEventListener('refreshMessages', handleRefreshMessages);
    
    return () => {
      window.removeEventListener('refreshMessages', handleRefreshMessages);
    };
  }, []);

  // Improved scroll to bottom effect when messages change or when active chat changes
  useEffect(() => {
    // Scroll to bottom when messages change or active chat changes
    if (messages.length > 0 || activeChat) {
      console.log('Scrolling to bottom due to messages change or active chat change');
      scrollToBottom();
      
      // Try again after a short delay to ensure everything is rendered
      setTimeout(() => {
        scrollToBottom();
      }, 300);
    }
  }, [messages, activeChat]);

  return (
    <div className="messages-container">
      <div className="conversations-list">
        <div className="conversations-header">
          <h2>Messages</h2>
          <div className="search-bar">
            <FaSearch />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${activeFilter === 'starred' ? 'active' : ''}`}
              onClick={() => setActiveFilter('starred')}
            >
              Starred
            </button>
          </div>
        </div>

        <div className="conversations">
          {conversations
            .filter(conversation => {
              if (activeFilter === 'all') return true;
              if (activeFilter === 'starred') return starredThreads.includes(conversation.id);
              return true;
            })
            .map(conversation => renderConversation(conversation))}
        </div>
      </div>

      <div className="chat-container">
        {selectedChat === 'stitch-ai' ? (
          <StitchAIThread onClose={() => setSelectedChat(null)} />
        ) : selectedChat ? (
          <div className="regular-chat">
            <div className="chat-header">
              <div className="chat-contact-info">
                <h3>
                  {getParticipantName(conversations.find(c => c.id === selectedChat))}
                </h3>
                <span className="status">Online</span>
              </div>
            </div>

            <div className="messages-list">
              {messages.map(message => renderMessage(message))}
              <div ref={messagesEndRef} />
            </div>

            <ChatSidebar 
              isOpen={sidebarOpen}
              selectedChat={selectedChat}
              currentUser={user}
            />
            
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FaBars />
            </button>

            <div className="message-input">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                ref={messageInputRef}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newMessage.trim()) {
                      try {
                    sendMessage(e);
                      } catch (error) {
                        console.error('Error sending message on Enter:', error);
                      }
                    }
                  }
                }}
              />
              <label className="attach-btn">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                <FaPaperclip />
              </label>
              <button 
                className="icon-btn"
                onClick={() => setShowForm(true)}
                title="Request Quote"
              >
                <FaFileAlt />
              </button>
              <button 
                className="send-btn" 
                onClick={(e) => {
                  if (newMessage.trim()) {
                    try {
                      sendMessage(e);
                    } catch (error) {
                      console.error('Error sending message on button click:', error);
                    }
                  }
                }}
                disabled={!newMessage.trim()}
              >
                <FaPaperPlane />
              </button>
            </div>
          </div>
        ) : (
          <div className="no-chat-selected">
            <h3>Select a conversation to start messaging</h3>
          </div>
        )}
      </div>

      {showForm && renderFormModal()}
    </div>
  );
};

export default Messages; 