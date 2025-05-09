import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import './VendorServices.css';
import { VENDOR_CATEGORIES } from '../constants/categories';

const VendorServices = () => {
  const { user, userProfile } = useAuth();
  const [services, setServices] = useState([]);
  const [isAddingService, setIsAddingService] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    contactInfo: {
      phone: '',
      email: '',
      website: ''
    },
    minOrderQuantity: '',
    clients: '',
    description: ''
  });

  // Fetch vendor's services
  useEffect(() => {
    const fetchServices = async () => {
      if (user) {
        const servicesRef = collection(db, 'users', user.uid, 'services');
        const snapshot = await getDocs(servicesRef);
        const servicesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setServices(servicesList);
      }
    };
    fetchServices();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const serviceData = {
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingService) {
        // Update existing service
        await setDoc(doc(db, 'users', user.uid, 'services', editingService.id), serviceData);
        setServices(services.map(service => 
          service.id === editingService.id ? { ...serviceData, id: service.id } : service
        ));
      } else {
        // Add new service
        const newServiceRef = doc(collection(db, 'users', user.uid, 'services'));
        await setDoc(newServiceRef, serviceData);
        setServices([...services, { ...serviceData, id: newServiceRef.id }]);
      }

      setFormData({
        name: '',
        category: '',
        contactInfo: {
          phone: '',
          email: '',
          website: ''
        },
        minOrderQuantity: '',
        clients: '',
        description: ''
      });
      setIsAddingService(false);
      setEditingService(null);
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Failed to save service. Please try again.');
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData(service);
    setIsAddingService(true);
  };

  const handleDelete = async (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'services', serviceId));
        setServices(services.filter(service => service.id !== serviceId));
      } catch (error) {
        console.error('Error deleting service:', error);
        alert('Failed to delete service. Please try again.');
      }
    }
  };

  return (
    <div className="services-page">
      <div className="services-header">
        <h2>My Services</h2>
        <button 
          className="add-service-btn"
          onClick={() => setIsAddingService(true)}
        >
          <FaPlus /> Add New Service
        </button>
      </div>

      {isAddingService ? (
        <div className="service-form-container">
          <h3>{editingService ? 'Edit Service' : 'Add New Service'}</h3>
          <form onSubmit={handleSubmit} className="service-form">
            <div className="form-group">
              <label>Business Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">Select a category</option>
                {VENDOR_CATEGORIES.map(category => (
                  <option key={category} value={category.toLowerCase()}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Contact Information</label>
              <div className="contact-inputs">
                <input
                  type="tel"
                  placeholder="Phone"
                  value={formData.contactInfo.phone}
                  onChange={(e) => setFormData({
                    ...formData,
                    contactInfo: { ...formData.contactInfo, phone: e.target.value }
                  })}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.contactInfo.email}
                  onChange={(e) => setFormData({
                    ...formData,
                    contactInfo: { ...formData.contactInfo, email: e.target.value }
                  })}
                />
                <input
                  type="url"
                  placeholder="Website"
                  value={formData.contactInfo.website}
                  onChange={(e) => setFormData({
                    ...formData,
                    contactInfo: { ...formData.contactInfo, website: e.target.value }
                  })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Minimum Order Quantity (MOQ)</label>
              <input
                type="number"
                value={formData.minOrderQuantity}
                onChange={(e) => setFormData({ ...formData, minOrderQuantity: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Previous Clients</label>
              <textarea
                value={formData.clients}
                onChange={(e) => setFormData({ ...formData, clients: e.target.value })}
                placeholder="List some notable clients you've worked with"
              />
            </div>

            <div className="form-group">
              <label>Business Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell us about your business, specialties, and capabilities"
                required
              />
            </div>

            <div className="form-buttons">
              <button type="button" onClick={() => {
                setIsAddingService(false);
                setEditingService(null);
              }}>
                Cancel
              </button>
              <button type="submit">
                {editingService ? 'Save Changes' : 'Add Service'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="services-grid">
          {services.map(service => (
            <div key={service.id} className="service-card">
              <h3>{service.name}</h3>
              <span className="category-tag">{service.category}</span>
              <div className="service-details">
                <div className="detail-group">
                  <label>Contact Info:</label>
                  <p>{service.contactInfo.phone}</p>
                  <p>{service.contactInfo.email}</p>
                  {service.contactInfo.website && (
                    <a href={service.contactInfo.website} target="_blank" rel="noopener noreferrer">
                      Website
                    </a>
                  )}
                </div>
                <div className="detail-group">
                  <label>MOQ:</label>
                  <p>{service.minOrderQuantity} units</p>
                </div>
                {service.clients && (
                  <div className="detail-group">
                    <label>Clients:</label>
                    <p>{service.clients}</p>
                  </div>
                )}
                <div className="detail-group">
                  <label>Description:</label>
                  <p>{service.description}</p>
                </div>
              </div>
              <div className="service-actions">
                <button onClick={() => handleEdit(service)}>
                  <FaEdit /> Edit
                </button>
                <button onClick={() => handleDelete(service.id)}>
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorServices; 