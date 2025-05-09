import { addDoc, collection, query, where, getDocs, updateDoc, doc, serverTimestamp, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const calculateTotals = (items = []) => {
  const subtotal = items.reduce((sum, item) => sum + ((item.rate || 0) * (item.quantity || 0)), 0);
  const tax = subtotal * 0.1; // 10% tax
  const shipping = 15; // Fixed shipping
  const total = subtotal + tax + shipping;
  return { subtotal, tax, shipping, total };
};

export const createMessageThread = async (order) => {
  try {
    console.log('Creating message thread for order:', order);

    // Create the conversation first
    const conversationData = {
      participants: [order.vendorId, order.customerId],
      participantNames: {
        [order.vendorId]: order.vendorName || 'Vendor',
        [order.customerId]: order.customerName || 'Customer'
      },
      lastMessage: `New order #${order.orderNumber}`,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unreadCount: {
        [order.vendorId]: 0,
        [order.customerId]: 1
      }
    };

    const threadRef = await addDoc(collection(db, 'conversations'), conversationData);
    console.log('Created new thread:', threadRef.id);

    // Create the order message
    const messageData = {
      type: 'order',
      conversationId: threadRef.id,
      senderId: order.vendorId,
      senderName: order.vendorName || 'Vendor',
      content: `Order #${order.orderNumber} created`,
      order: {
        ...order,
        orderNumber: order.orderNumber,
        date: new Date().toISOString(),
        status: {
          payment: 'pending',
          fulfillment: 'unfulfilled'
        }
      },
      timestamp: serverTimestamp(),
      readBy: [order.vendorId]
    };

    console.log('Creating order message:', JSON.stringify(messageData, null, 2));
    await addDoc(collection(db, 'messages'), messageData);

    // Update conversation with the thread ID
    await updateDoc(doc(db, 'conversations', threadRef.id), {
      lastMessageAt: serverTimestamp()
    });

    return threadRef.id;
  } catch (error) {
    console.error('Error creating message thread:', error);
    throw error;
  }
};

export const createOrderOverviewMessage = async (orderId, conversationId) => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    const orderData = orderDoc.data();

    const messageData = {
      type: 'order',
      conversationId,
      senderId: orderData.vendorId,
      content: `Order #${orderData.orderNumber} overview`,
      orderDetails: {
        ...orderData,
        status: {
          ...orderData.status,
          payment: 'paid',
          production: 'in_production'
        },
        paidAt: serverTimestamp(),
        lastUpdate: serverTimestamp()
      },
      timestamp: serverTimestamp(),
      readBy: [orderData.vendorId]
    };

    await addDoc(collection(db, 'messages'), messageData);

    // Update the order status in the orders collection
    await updateDoc(orderRef, {
      status: messageData.orderDetails.status,
      paidAt: messageData.orderDetails.paidAt,
      lastUpdate: messageData.orderDetails.lastUpdate
    });

  } catch (error) {
    console.error('Error creating order overview message:', error);
    throw error;
  }
};

export const simulatePaymentAndCreateOverview = async (message) => {
  try {
    console.log('Starting payment simulation with message:', message);

    // Check for required data
    if (!message) {
      throw new Error('No message object provided');
    }

    if (!message.conversationId) {
      throw new Error('No conversation ID found in message');
    }

    // Get the order details from the correct location
    const orderDetails = message.orderDetails || message.order;
    if (!orderDetails) {
      throw new Error('No order details found in message');
    }

    // Get the message ID from the correct location
    const messageId = message.id;
    if (!messageId) {
      throw new Error('No message ID found');
    }

    console.log('Found message ID:', messageId);
    console.log('Found order details:', orderDetails);

    // Update the existing message with new status
    const updatedOrderDetails = {
      ...orderDetails,
      status: {
        payment: 'paid',
        production: 'in_production',
        fulfillment: orderDetails.status?.fulfillment || 'unfulfilled'
      },
      paidAt: serverTimestamp(),
      lastUpdate: serverTimestamp()
    };

    console.log('Preparing to update message with:', {
      messageId,
      updatedOrderDetails
    });

    // Update the existing message
    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      orderDetails: updatedOrderDetails,
      order: updatedOrderDetails // Update both locations to ensure compatibility
    });

    // Update the conversation's last message
    const conversationRef = doc(db, 'conversations', message.conversationId);
    await updateDoc(conversationRef, {
      lastMessage: `Order #${orderDetails.orderNumber} has been paid`,
      lastMessageDate: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('Successfully updated order payment status');

    return true;
  } catch (error) {
    console.error('Error in simulatePaymentAndCreateOverview:', error);
    console.error('Message object that caused error:', message);
    throw error;
  }
};

export class MessageService {
  static async sendOrderToThread(threadId, order, senderName) {
    try {
      const messageRef = collection(db, 'messages');
      const threadRef = doc(db, 'conversations', threadId);

      // Create the message with all required order data
      await addDoc(messageRef, {
        conversationId: threadId,
        type: 'order',
        order: order, // Keep the entire order object
        senderId: order.vendorId,
        senderName: senderName,
        timestamp: serverTimestamp(),
        read: false
      });

      // Update conversation
      await updateDoc(threadRef, {
        lastMessage: `New order #${order.orderNumber}`,
        lastMessageTimestamp: serverTimestamp()
      });

    } catch (error) {
      console.error('Error sending order to thread:', error);
      throw error;
    }
  }

  static async createMessageThread({ participants, participantNames, order, senderName }) {
    try {
      // Create conversation first
      const conversationRef = collection(db, 'conversations');
      const newConversation = await addDoc(conversationRef, {
        participants,
        participantNames,
        lastMessage: `New order #${order.orderNumber}`,
        lastMessageTimestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Create first message with order
      const messageRef = collection(db, 'messages');
      await addDoc(messageRef, {
        conversationId: newConversation.id,
        type: 'order',
        order: order, // Keep the entire order object
        senderId: order.vendorId,
        senderName: senderName,
        timestamp: serverTimestamp(),
        read: false
      });

      return newConversation.id;
    } catch (error) {
      console.error('Error creating message thread:', error);
      throw error;
    }
  }
} 