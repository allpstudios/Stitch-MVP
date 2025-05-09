import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Login form submitted');
      const result = await login(email, password);
      console.log('Login result:', result);
      
      if (result.success) {
        console.log('Login successful, navigating to dashboard');
        navigate('/dashboard');
      } else {
        console.log('Login failed:', result.error);
        setError(result.error || 'Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to login. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Welcome Back</h2>
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
          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <div className="auth-footer">
          <p>Don't have an account? <button onClick={() => navigate('/signup')} className="link-button">Sign Up</button></p>
          <button className="link-button">Forgot Password?</button>
        </div>
      </div>
    </div>
  );
};

export default Login; 