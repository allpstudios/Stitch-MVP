import React, { useState, useEffect, createContext, useContext } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import VendorCard from './components/VendorCard';
import SearchBar from './components/SearchBar';
import FilterDropdown from './components/FilterDropdown';
import { BrowserRouter, Routes, Route, createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Resources from './pages/Resources';
import Community from './pages/Community';
import Shop from './pages/Shop';
import './App.css';
import './styles/mobile.css';
import NavUtility from './components/NavUtility';
import Dashboard from './pages/Dashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Profile from './pages/Profile';
import VendorServices from './pages/VendorServices';
import { VENDOR_CATEGORIES, VENDOR_COLORS } from './constants/categories';
import { collection, getDocs, query, where, addDoc, orderBy, serverTimestamp, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import AdminDashboard from './pages/AdminDashboard';
import { Link } from 'react-router-dom';
import { FaShoppingCart, FaEnvelope, FaUser, FaMapMarkedAlt, FaList, FaRobot, FaPaperPlane, FaTimes } from 'react-icons/fa';
import ProductDetail from './pages/ProductDetail';
import { CartProvider } from './context/CartContext';
import Cart from './components/Cart';
import ProfileEdit from './pages/ProfileEdit';
import MapPage from './pages/Map';
import { OrderProvider } from './context/OrderContext';
import CreateOrderPage from './pages/CreateOrderPage';
import Messages from './pages/Messages';
import VendorDashboard from './pages/VendorDashboard';
import VendorOrders from './pages/VendorOrders';
import Landing from './pages/Landing';
import LeadZone from './components/LeadZone';
import { isAlphaMode } from './config/projectState';
import CommandHandler from './components/CommandHandler';
import AlphaIndicator from './components/AlphaIndicator';
import BetaIndicator from './components/BetaIndicator';
import PublicVendorProfile from './pages/PublicVendorProfile';

const MAP_STYLES = [
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }]
  }
];

const StitchAIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      loadRecentMessages();
    }
  }, [currentUser]);

  const loadRecentMessages = async () => {
    if (!currentUser) return;
    
    try {
      const q = query(
        collection(db, 'aiChatHistory'),
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMessages(messages);
        },
        (error) => {
          console.error('Error loading AI chat history:', error);
          setMessages([]);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up AI chat history listener:', error);
      return () => {};
    }
  };

  const saveMessage = async (message, type) => {
    try {
      const messagesRef = collection(db, 'aiChats');
      await addDoc(messagesRef, {
        userId: currentUser.uid,
        text: message,
        type: type,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !currentUser) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to UI immediately
    const newUserMessage = {
      type: 'user',
      text: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    
    // Save user message to Firestore
    await saveMessage(userMessage, 'user');
    
    setIsLoading(true);

    // TODO: Replace with actual AI backend integration
    setTimeout(async () => {
      const aiResponse = "I'll help you find the perfect vendors for your needs. Let me search through our database...";
      
      // Add AI response to UI
      const newAiMessage = {
        type: 'ai',
        text: aiResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newAiMessage]);
      
      // Save AI response to Firestore
      await saveMessage(aiResponse, 'ai');
      
      setIsLoading(false);
    }, 1000);
  };

  if (!isOpen) {
    return (
      <div className="stitch-ai-widget">
        <button className="chat-button" onClick={() => setIsOpen(true)}>
          <FaRobot />
        </button>
      </div>
    );
  }

  return (
    <div className="chat-panel" style={{
      background: 'linear-gradient(135deg, rgba(255,105,180,0.1), rgba(155,93,229,0.1))'
    }}>
      <div className="chat-header" style={{
        background: 'linear-gradient(45deg, #FF69B4, #9B5DE5)'
      }}>
        <h3>Stitch AI Assistant</h3>
        <button className="close-chat" onClick={() => setIsOpen(false)}>
          <FaTimes />
        </button>
      </div>
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`message ${message.type}-message`}
            style={message.type === 'user' ? {
              background: 'linear-gradient(45deg, #FF69B4, #9B5DE5)',
              color: 'white'
            } : {}}
          >
            {message.text}
          </div>
        ))}
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
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            style={{
              background: 'linear-gradient(45deg, #FF69B4, #9B5DE5)'
            }}
          >
            <FaPaperPlane />
          </button>
        </form>
      </div>
    </div>
  );
};

const Layout = ({ children }) => {
  const auth = useAuth();
  const userProfile = auth?.userProfile;

  return (
    <div className="app">
      <header className="header">
        <div className="title-container">
          <img src={require('./assets/stitch-logo.png')} alt="Stitch" className="stitch-logo" />
          <h2>AI-powered ecosystem connecting fashion brands and vendors</h2>
        </div>
        <Navigation />
        <NavUtility />
      </header>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            {isAlphaMode() ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <MapPage />
            )}
          </ProtectedRoute>
        } />
        
        {/* Core Routes (Available in both Alpha and Beta) */}
        <Route path="/dashboard/*" element={
          <ProtectedRoute>
            <OrderProvider>
              <Dashboard />
            </OrderProvider>
          </ProtectedRoute>
        } />
        <Route path="/vendor/:vendorId" element={<PublicVendorProfile />} />
        <Route path="/dashboard/messages" element={
          <ProtectedRoute>
            <Dashboard defaultTab="messages" />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/orders" element={
          <ProtectedRoute>
            <Dashboard defaultTab="orders" />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/profile/edit" element={
          <ProtectedRoute>
            <ProfileEdit />
          </ProtectedRoute>
        } />
        <Route path="/profile/services" element={
          <ProtectedRoute>
            <VendorServices />
          </ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute>
            <VendorOrders />
          </ProtectedRoute>
        } />
        <Route path="/orders/new" element={
          <ProtectedRoute>
            <CreateOrderPage />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/create-order" element={<CreateOrderPage />} />
        
        {/* Beta-only Routes */}
        {!isAlphaMode() && (
          <>
            <Route path="/shop" element={<Shop />} />
            <Route path="/community" element={<Community />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/lead-zone" element={<LeadZone />} />
          </>
        )}
        
        {/* Redirect all other routes to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Cart />
      <StitchAIChat />
      <AlphaIndicator />
      <BetaIndicator />
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <OrderProvider>
            <LoadScript googleMapsApiKey="AIzaSyDEDfD9jbuYtbBYZoi_Cm0fO_ogI3csuKk">
              <Layout />
            </LoadScript>
            <CommandHandler />
          </OrderProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App; 