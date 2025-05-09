import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';  // We'll combine Login and SignUp styles
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState('brand');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    try {
      setError('');
      setLoading(true);
      const result = await signup(email, password, userType, companyName);
      if (result.success) {
        navigate('/profile');
      } else {
        setError(result.error || 'Failed to create account');
      }
    } catch (error) {
      setError('Failed to create account. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create Account</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>
          <div className="form-group">
            <label>Account Type</label>
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              className="auth-select"
              required
            >
              <option value="brand">Brand</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
          {(userType === 'vendor' || userType === 'brand') && (
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter your company name"
                required
              />
            </div>
          )}
          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        <div className="auth-footer">
          <p>Already have an account? <button onClick={() => navigate('/login')} className="link-button">Log In</button></p>
        </div>
      </div>
    </div>
  );
};

export default SignUp; 