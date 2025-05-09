import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './AdminDashboard.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FaBox, 
  FaUsers, 
  FaStore,
  FaPlus,
  FaPencilAlt,
  FaTrash 
} from 'react-icons/fa';
import VendorImporter from '../components/VendorImporter';

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [productData, setProductData] = useState({
    name: '',
    category: 'T-shirt',
    description: '',
    price: '',
    inventory: [
      { size: 'S', color: '', quantity: 0 },
      { size: 'M', color: '', quantity: 0 },
      { size: 'L', color: '', quantity: 0 },
      { size: 'XL', color: '', quantity: 0 }
    ],
    media: null
  });

  useEffect(() => {
    // Real-time updates for vendors
    const unsubscribe = onSnapshot(collection(db, 'vendors'), (snapshot) => {
      const vendorsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVendors(vendorsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Move this before any conditional returns
  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  const verifyVendor = async (vendorId) => {
    try {
      await updateDoc(doc(db, 'vendors', vendorId), {
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: user.uid
      });
    } catch (error) {
      console.error('Error verifying vendor:', error);
      alert('Failed to verify vendor');
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const productRef = collection(db, 'products');
      const newProduct = {
        ...productData,
        price: parseFloat(productData.price),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid,
        isActive: true
      };

      await addDoc(productRef, newProduct);
      setIsProductModalOpen(false);
      setProductData({
        name: '',
        category: 'T-shirt',
        description: '',
        price: '',
        inventory: [
          { size: 'S', color: '', quantity: 0 },
          { size: 'M', color: '', quantity: 0 },
          { size: 'L', color: '', quantity: 0 },
          { size: 'XL', color: '', quantity: 0 }
        ],
        media: null
      });
      
      // Optionally fetch products again or update the list
      // fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product. Please try again.');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'vendors':
        return <VendorImporter />;
      default:
        return <div>Select a tab</div>;
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-sidebar">
        <h2>Admin Dashboard</h2>
        <nav>
          <button 
            className={`nav-button ${activeTab === 'vendors' ? 'active' : ''}`}
            onClick={() => setActiveTab('vendors')}
          >
            Vendor Management
          </button>
        </nav>
      </div>
      <div className="admin-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminDashboard; 