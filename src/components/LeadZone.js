import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { FaSearch, FaFilter, FaClock, FaBox, FaDollarSign } from 'react-icons/fa';
import './LeadZone.css';
import QuoteDetailsModal from '../components/QuoteDetailsModal';

const LeadZone = () => {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('Fetching orders...');
      const ordersRef = collection(db, 'orderRequests');
      
      // Simplified query while index is building
      const q = query(
        ordersRef,
        where('status', '==', 'open')
        // Temporarily remove orderBy until index is ready
        // orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      console.log('Found orders:', snapshot.docs.length);
      
      const ordersList = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Order data:', { id: doc.id, ...data });
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        };
      });
      
      // Sort the orders client-side for now
      ordersList.sort((a, b) => b.createdAt - a.createdAt);
      
      console.log('Processed orders:', ordersList);
      setOrders(ordersList);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBidClick = (order) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  const OrderCard = ({ order }) => (
    <div className="order-card">
      <div className="order-header">
        <h3>{order.productType || 'Untitled Order'}</h3>
        <span className="order-date">
          <FaClock /> Posted {order.createdAt?.toLocaleDateString() || 'Recently'}
        </span>
      </div>
      
      <div className="order-details">
        <div className="detail-item">
          <FaBox />
          <span>Quantity: {order.quantity || 'N/A'}</span>
        </div>
        <div className="detail-item">
          <FaDollarSign />
          <span>Budget: ${order.budget?.toLocaleString() || 'N/A'}</span>
        </div>
      </div>

      <div className="order-description">
        <p>{order.description || 'No description provided'}</p>
      </div>

      {order.categories && order.categories.length > 0 && (
        <div className="order-categories">
          {order.categories.map((category, index) => (
            <span key={index} className="category-tag">{category}</span>
          ))}
        </div>
      )}

      <div className="brand-info">
        <span>From: {order.brandName || 'Anonymous'}</span>
        {order.timeline && <span>Timeline: {order.timeline}</span>}
      </div>

      <div className="order-footer">
        <button 
          className="view-order-btn"
          onClick={() => handleBidClick(order)}
        >
          View Order Details
        </button>
      </div>
    </div>
  );

  return (
    <div className="lead-zone-container">
      <div className="lead-zone-header">
        <h2>Lead Zone</h2>
        <div className="search-filter-container">
          <div className="search-bar">
            <FaSearch />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-dropdown">
            <FaFilter />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="screen-printing">Screen Printing</option>
              <option value="embroidery">Embroidery</option>
              <option value="cut-and-sew">Cut & Sew</option>
              {/* Add more categories */}
            </select>
          </div>
        </div>
      </div>

      <div className="orders-grid">
        {loading ? (
          <div className="loading">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="no-orders">No order requests available</div>
        ) : (
          orders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))
        )}
      </div>

      {showDetails && selectedOrder && (
        <QuoteDetailsModal
          quote={selectedOrder}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
};

export default LeadZone; 