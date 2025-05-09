import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  getDoc,
  updateDoc, 
  writeBatch,
  arrayUnion,
  increment,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

useEffect(() => {
  const auth = getAuth();
  console.log('Current user:', auth.currentUser);
  if (auth.currentUser) {
    console.log('User ID:', auth.currentUser.uid);
  }
}, []);

useEffect(() => {
  if (!user) return;

  // Listen for new messages in the active chat
  if (activeChat) {
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', activeChat),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messageList);

      // Mark messages as read when viewing them
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        const message = doc.data();
        if (message.senderId !== user.uid && !message.readBy?.includes(user.uid)) {
          batch.update(doc.ref, {
            readBy: arrayUnion(user.uid)
          });
        }
      });

      // Update conversation unread count
      if (activeChat) {
        const convoRef = doc(db, 'conversations', activeChat);
        batch.update(convoRef, {
          [`unreadCount.${user.uid}`]: 0
        });
      }

      batch.commit().catch(console.error);
    });

    return () => unsubscribe();
  }
}, [activeChat, user]);

const sendMessage = async (e) => {
  e.preventDefault();
  if (!newMessage.trim() || !activeChat) return;

  try {
    const conversationRef = doc(db, 'conversations', activeChat);
    const conversationDoc = await getDoc(conversationRef);
    const conversation = conversationDoc.data();
    
    // Get other participants
    const otherParticipants = conversation.participants.filter(id => id !== user.uid);

    // Create unread count updates
    const unreadUpdates = {};
    otherParticipants.forEach(participantId => {
      // Initialize or increment the unread count for each participant
      unreadUpdates[`unreadCount.${participantId}`] = increment(1);
    });

    // Create batch for atomic updates
    const batch = writeBatch(db);

    // Add message
    const messageRef = collection(db, 'messages');
    batch.set(doc(messageRef), {
      conversationId: activeChat,
      senderId: user.uid,
      senderName: userProfile.companyName,
      content: newMessage,
      timestamp: serverTimestamp(),
      readBy: [user.uid]
    });

    // Update conversation
    batch.update(conversationRef, {
      lastMessage: newMessage,
      lastMessageAt: serverTimestamp(),
      ...unreadUpdates // Add unread counts
    });

    await batch.commit();
    setNewMessage('');
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

const handleConversationClick = async (conversationId) => {
  setActiveChat(conversationId);
  
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    
    // Reset unread count for current user
    await updateDoc(conversationRef, {
      [`unreadCount.${user.uid}`]: 0
    });

    // Mark all messages as read
    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      where('senderId', '!=', user.uid)
    );

    const unreadMessages = await getDocs(messagesQuery);
    
    if (!unreadMessages.empty) {
      const batch = writeBatch(db);
      unreadMessages.docs.forEach((doc) => {
        if (!doc.data().readBy?.includes(user.uid)) {
          batch.update(doc.ref, {
            readBy: arrayUnion(user.uid)
          });
        }
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
};

// Add this useEffect to initialize unreadCount field for new conversations
useEffect(() => {
  if (!user) return;

  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', user.uid)
  );

  const unsubscribe = onSnapshot(conversationsQuery, async (snapshot) => {
    const batch = writeBatch(db);
    let needsUpdate = false;

    snapshot.docs.forEach((doc) => {
      const conversation = doc.data();
      if (!conversation.unreadCount) {
        needsUpdate = true;
        batch.update(doc.ref, {
          unreadCount: conversation.participants.reduce((acc, participantId) => {
            acc[participantId] = 0;
            return acc;
          }, {})
        });
      }
    });

    if (needsUpdate) {
      await batch.commit();
    }
  });

  return () => unsubscribe();
}, [user]);

const fetchMessageData = async (messageId) => {
  try {
    const messageDoc = await getDoc(doc(db, 'messages', messageId));
    const messageData = messageDoc.data();
    
    // If it's an order message, fetch associated quote
    if (messageData.type === 'order' && messageData.quoteId) {
      const quoteDoc = await getDoc(doc(db, 'quoteRequests', messageData.quoteId));
      if (quoteDoc.exists()) {
        messageData.quoteDetails = quoteDoc.data();
      }
    }
    
    return messageData;
  } catch (error) {
    console.error('Error fetching message data:', error);
    return null;
  }
};

const setupListeners = async () => {
  try {
    // Messages query that's working fine
    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', activeChat),
      orderBy('timestamp', 'asc')
    );

    // Update quotes listener to include pending status
    const quotesQuery = query(
      collection(db, 'quoteRequests'),
      where('vendorId', '==', user.uid),
      // Add this to ensure we only query existing quotes
      where('status', 'in', ['pending', 'accepted', 'rejected'])
    );

    // Update orders listener to include status
    const ordersQuery = query(
      collection(db, 'orders'),
      where('vendorId', '==', user.uid),
      // Add this to ensure we only query existing orders
      where('status.fulfillment', 'in', ['unfulfilled', 'processing', 'shipped', 'delivered'])
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messageList);
    });

    const unsubQuotes = onSnapshot(quotesQuery, (snapshot) => {
      const quotesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuotes(quotesList);
    }, error => {
      console.error('Quotes listener error:', error);
    });

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersList);
    }, error => {
      console.error('Orders listener error:', error);
    });

    return () => {
      unsubMessages();
      unsubQuotes();
      unsubOrders();
    };
  } catch (error) {
    console.error('Error setting up listeners:', error);
  }
};

{conversations.map(conversation => {
  const unreadCount = conversation.unreadCount?.[user.uid] || 0;
  
  return (
    <div 
      key={conversation.id} 
      className={`conversation-item ${activeChat === conversation.id ? 'active' : ''} ${
        unreadCount > 0 ? 'unread' : ''
      }`}
      onClick={() => handleConversationClick(conversation.id)}
    >
      <div className="conversation-avatar">
        {conversation.participantNames?.find(name => name !== userProfile.companyName)?.substring(0, 2) || '??'}
      </div>
      <div className="conversation-info">
        <div className="conversation-top">
          <h4>{conversation.participantNames?.find(name => name !== userProfile.companyName)}</h4>
          <div className="conversation-meta">
            {unreadCount > 0 && (
              <span className="unread-count">
                {unreadCount}
              </span>
            )}
            <span className="timestamp">
              {conversation.lastMessageAt?.toDate().toLocaleDateString()}
            </span>
          </div>
        </div>
        <p className={`last-message ${unreadCount > 0 ? 'unread' : ''}`}>
          {conversation.lastMessage}
        </p>
      </div>
    </div>
  );
})} 