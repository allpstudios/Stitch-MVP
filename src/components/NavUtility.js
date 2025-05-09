import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaEnvelope, FaShoppingCart } from 'react-icons/fa';
import NotificationBadge from './NotificationBadge';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useCart } from '../context/CartContext';
import './NavUtility.css';
import { isAlphaMode } from '../config/projectState';

const NavUtility = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const { cartItems, toggleCart } = useCart();

  useEffect(() => {
    if (!user) return;

    // Listen for conversations with unread messages
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach(doc => {
        const conversation = doc.data();
        totalUnread += conversation.unreadCount?.[user.uid] || 0;
      });
      setUnreadCount(totalUnread);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Calculate total quantity across all items
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className="nav-utility">
      {user ? (
        <>
          {/* Only show cart in beta mode */}
          {!isAlphaMode() && (
            <button onClick={toggleCart} className="cart-icon-container">
              <FaShoppingCart />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          )}
          <Link 
            to="/dashboard/messages" 
            className="utility-link messages-link"
          >
            <FaEnvelope />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </Link>
          <div className="profile-dropdown">
            <button 
              className="utility-icon profile-button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <FaUser />
            </button>
            {isDropdownOpen && (
              <div className="dropdown-menu">
                <button onClick={() => {
                  navigate('/dashboard');
                  setIsDropdownOpen(false);
                }}>Dashboard</button>
                <button onClick={handleLogout}>Log Out</button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="auth-buttons">
          <Link to="/login" className="auth-button">
            Login
          </Link>
          <Link to="/signup" className="auth-button">
            Sign Up
          </Link>
        </div>
      )}
    </div>
  );
};

export default NavUtility; 