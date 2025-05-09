import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaShoppingCart, FaUser, FaEnvelope } from 'react-icons/fa';
import './Header.css';

const Header = () => {
  const { user } = useAuth();

  return (
    <div className="header">
      <div className="header-content">
        <div className="header-left">
          <Link to="/" className="logo">
            STITCH
          </Link>
        </div>

        <div className="header-right">
          {user ? (
            <div className="nav-icons">
              <Link to="/cart" className="nav-icon">
                <FaShoppingCart size={20} />
              </Link>
              <Link to="/dashboard/messages" className="nav-icon">
                <FaEnvelope size={20} />
              </Link>
              <Link to="/dashboard" className="nav-icon">
                <FaUser size={20} />
              </Link>
            </div>
          ) : (
            <Link to="/login" className="login-btn">
              Login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header; 