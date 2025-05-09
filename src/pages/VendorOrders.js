import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import './VendorOrders.css';
import QuoteDetailsModal from '../components/QuoteDetailsModal';
import OrderOverviewModal from '../components/OrderOverviewModal';
import OrderInvoiceModal from '../components/OrderInvoiceModal';
import { FaArchive, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';

const VendorOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [quoteRequests, setQuoteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    fulfilledOrders: 0,
    pendingOrders: 0,
    totalQuotes: 0
  });

  // Create a ref to store the quotes map so it persists between renders
  const quotesMapRef = useRef(new Map());
  const isCleanedUpRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Reset cleanup flag on mount
    isCleanedUpRef.current = false;
    quotesMapRef.current.clear();

    console.log('Setting up quote request listeners for vendor:', user.uid);

    // Listen to quoteRequests collection
    const quotesRequestsQuery = query(
      collection(db, 'quoteRequests'),
      where('vendorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // Listen to quote messages
    const quoteMessagesQuery = query(
      collection(db, 'messages'),
      where('type', '==', 'quote'),
      where('recipientId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    // Subscribe to quoteRequests
    const unsubscribeQuotesRequests = onSnapshot(quotesRequestsQuery, (snapshot) => {
      if (isCleanedUpRef.current) return;
      
      console.log('Quote requests snapshot size:', snapshot.size);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('Processing quote request:', {id: doc.id, ...data});

        const totalQuantity = data.services?.reduce((sum, service) => {
          if (service.quantities) {
            return sum + Object.values(service.quantities).reduce((qty, val) => qty + (parseInt(val) || 0), 0);
          }
          return sum + (parseInt(service.totalQuantity) || 0);
        }, 0) || 0;

        const quoteData = {
          id: doc.id,
          quoteRequestId: doc.id,
          source: 'quoteRequests',
          date: data.createdAt?.toDate().toLocaleDateString(),
          brandName: data.brandName || 'Unknown Brand',
          serviceRequired: data.services?.[0]?.service || 'Not specified',
          quantity: totalQuantity,
          timeline: data.deadline ? new Date(data.deadline).toLocaleDateString() : 'Not specified',
          status: data.status || 'pending',
          timestamp: data.createdAt?.toDate().getTime() || 0,
          rawData: data
        };

        // Store in map using the quote request ID
        quotesMapRef.current.set(doc.id, quoteData);
      });

      if (!isCleanedUpRef.current) {
        updateQuoteRequestsState();
      }
    });

    // Subscribe to quote messages
    const unsubscribeQuoteMessages = onSnapshot(quoteMessagesQuery, (snapshot) => {
      if (isCleanedUpRef.current) return;
      
      console.log('Quote messages snapshot size:', snapshot.size);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('Processing quote message:', {id: doc.id, ...data});

        // Skip if this is a message for a quote we already have
        if (data.quoteRequestId && quotesMapRef.current.has(data.quoteRequestId)) {
          return;
        }

        // Only process if it has quoteDetails and we don't already have this quote
        if (data.quoteDetails) {
          const quoteDetails = data.quoteDetails;
          const totalQuantity = Object.values(quoteDetails.quantities || {}).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);

          const quoteData = {
            id: doc.id,
            quoteRequestId: data.quoteRequestId,
            source: 'messages',
            date: data.timestamp?.toDate().toLocaleDateString(),
            brandName: data.senderName || 'Unknown Brand',
            serviceRequired: quoteDetails.serviceRequired || 'Not specified',
            quantity: totalQuantity,
            timeline: quoteDetails.timeline || 'Not specified',
            status: quoteDetails.status || 'pending',
            timestamp: data.timestamp?.toDate().getTime() || 0,
            rawData: { ...data, ...quoteDetails }
          };

          // Only store if we don't already have this quote
          if (data.quoteRequestId) {
            quotesMapRef.current.set(data.quoteRequestId, quoteData);
          }
        }
      });

      if (!isCleanedUpRef.current) {
        updateQuoteRequestsState();
      }
    });

    // Helper function to update state with deduplicated quotes
    const updateQuoteRequestsState = () => {
      if (isCleanedUpRef.current) return;
      
      const uniqueQuotes = Array.from(quotesMapRef.current.values())
        .sort((a, b) => b.timestamp - a.timestamp);
      
      console.log('Setting unique quotes:', uniqueQuotes);
      setQuoteRequests(uniqueQuotes);
      setLoading(false);
    };

    // Set up listeners for orders
    const ordersQuery = query(
      collection(db, 'messages'),
      where('type', '==', 'order'),
      where('order.vendorId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    // Subscribe to orders
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      if (isCleanedUpRef.current) return;
      
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersList);
      
      // Update stats
      setStats({
        totalOrders: ordersList.length,
        fulfilledOrders: ordersList.filter(order => order.order?.status?.fulfillment === 'fulfilled').length,
        pendingOrders: ordersList.filter(order => order.order?.status?.fulfillment === 'unfulfilled').length,
        totalQuotes: quotesMapRef.current.size
      });
    });

    return () => {
      isCleanedUpRef.current = true;
      quotesMapRef.current.clear();
      unsubscribeOrders();
      unsubscribeQuotesRequests();
      unsubscribeQuoteMessages();
    };
  }, [user]);

  const calculateTotalQuantity = (quantities) => {
    if (!quantities) return 0;
    return Object.values(quantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
  };

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
        // Show success message
        toast.success('Order deleted successfully');
        // Refresh orders list
        setOrders(orders.filter(order => order.id !== orderId));
      } catch (error) {
        console.error('Error deleting order:', error);
        toast.error('Failed to delete order');
      }
    }
  };

  const handleArchiveOrder = async (orderId) => {
    try {
      const orderToArchive = orders.find(order => order.id === orderId);
      if (!orderToArchive) return;

      await updateDoc(doc(db, 'orders', orderId), {
        status: {
          ...orderToArchive.status,
          archived: true,
          archivedAt: serverTimestamp()
        }
      });
      toast.success('Order archived successfully');
      // Update local state
      setOrders(orders.map(order => 
        order.id === orderId 
          ? { ...order, status: { ...order.status, archived: true, archivedAt: new Date() } }
          : order
      ));
    } catch (error) {
      console.error('Error archiving order:', error);
      toast.error('Failed to archive order');
    }
  };

  return (
    <div className="vendor-orders">
      {/* Stats Section */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon orders-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalOrders}</div>
            <div className="stat-label">Total Orders</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon fulfilled-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.fulfilledOrders}</div>
            <div className="stat-label">Fulfilled Orders</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon pending-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pendingOrders}</div>
            <div className="stat-label">Pending Orders</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon quotes-icon">💬</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalQuotes}</div>
            <div className="stat-label">Total Quotes</div>
          </div>
        </div>
      </div>

      {/* Quote Requests Table */}
      <div className="section">
        <div className="section-header">
          <h2>Quote Requests</h2>
          <div className="search-container">
            <input
              type="text"
              placeholder="Search quotes..."
              className="search-input"
            />
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Service Required</th>
                <th>Quantity</th>
                <th>Timeline</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="loading">Loading quote requests...</td>
                </tr>
              ) : quoteRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">No quote requests found</td>
                </tr>
              ) : (
                quoteRequests.map(quote => (
                  <tr key={quote.id} onClick={() => setSelectedQuote(quote)}>
                    <td>{quote.date}</td>
                    <td>{quote.brandName}</td>
                    <td>{quote.serviceRequired}</td>
                    <td>{quote.quantity}</td>
                    <td>{quote.timeline}</td>
                    <td>
                      <span className={`status-badge ${quote.status}`}>
                        {quote.status}
                      </span>
                    </td>
                    <td>
                      <div className="quote-actions">
                        <button 
                          className="action-btn view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuote(quote);
                          }}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders Table */}
      <div className="section">
        <h2>Orders</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="loading">Loading orders...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">No orders found</td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id} className="order-row">
                    <td>{order.order?.orderNumber || 'N/A'}</td>
                    <td>{order.timestamp?.toDate().toLocaleDateString()}</td>
                    <td>{order.order?.customerName || 'N/A'}</td>
                    <td>{order.order?.items?.length || 0}</td>
                    <td>${order.order?.total?.toFixed(2) || '0.00'}</td>
                    <td>
                      <span className={`status-badge ${order.order?.status?.payment || 'pending'}`}>
                        {order.order?.status?.payment || 'pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${order.order?.status?.fulfillment || 'unfulfilled'}`}>
                        {order.order?.status?.fulfillment || 'unfulfilled'}
                      </span>
                    </td>
                    <td>
                      <div className="order-actions">
                        <button 
                          className="action-btn archive-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveOrder(order.id);
                          }}
                          title="Archive order"
                        >
                          <FaArchive />
                        </button>
                        <button 
                          className="action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(order.id);
                          }}
                          title="Delete order"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
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
            setSelectedInvoiceOrder({
              ...selectedOrder.order,
              conversationId: selectedOrder.conversationId,
              items: selectedOrder.order.items || [],
              totals: {
                subtotal: selectedOrder.order.total || 0,
                tax: (selectedOrder.order.total || 0) * 0.1,
                shipping: 15,
                total: (selectedOrder.order.total || 0) * 1.1 + 15
              },
              status: selectedOrder.order.status || {
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
    </div>
  );
};

export default VendorOrders; 