import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import VendorCard from '../components/VendorCard';
import SearchBar from '../components/SearchBar';
import { VENDOR_COLORS } from '../constants/categories';
import './Map.css';
import { FaMapMarkedAlt, FaList, FaStream } from 'react-icons/fa';
import LeadZone from '../components/LeadZone';
import { useAuth } from '../context/AuthContext';
import { geocodeAddress } from '../utils/geocodeAddress';
import { getMarkerIcon } from '../utils/markerUtils';

const MapPage = () => {
  const { userProfile } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [mapError, setMapError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapRef, setMapRef] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [view, setView] = useState('map'); // Changed from viewMode to view

  const defaultCenter = {
    lat: 34.0356,
    lng: -118.2529
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    filterVendors(term, selectedTypes);
  };

  const handleTypeFilter = (type) => {
    if (type === 'All') {
      setSelectedTypes([]);
      setSelectedFilter('all');
      filterVendors('', []);
      return;
    }
    
    // Toggle the selected type
    let newSelectedTypes;
    if (selectedTypes.includes(type)) {
      // Remove the type if it's already selected
      newSelectedTypes = selectedTypes.filter(t => t !== type);
    } else {
      // Add the type if it's not selected
      newSelectedTypes = [...selectedTypes, type];
    }
    
    setSelectedTypes(newSelectedTypes);
    setSelectedFilter(newSelectedTypes.length === 1 ? newSelectedTypes[0] : 'multiple');
    filterVendors(searchTerm, newSelectedTypes);
  };

  const filterVendors = (term, types) => {
    setIsLoading(true);
    let filtered = vendors;
    
    if (term) {
      filtered = filtered.filter(vendor => 
        (vendor.companyName?.toLowerCase().includes(term.toLowerCase()) ||
         vendor.categories?.some(type => 
           type.toLowerCase().includes(term.toLowerCase())
         ) ||
         vendor.services?.some(service => 
           (typeof service === 'object' ? service.name : service)?.toLowerCase().includes(term.toLowerCase())
         )) ?? false
      );
    }
    
    if (types.length > 0) {
      filtered = filtered.filter(vendor => {
        // Check if vendor matches ANY of the selected types
        return types.some(searchType => {
          // Check in categories array
          const matchInCategories = vendor.categories?.some(vType => {
            const normalizedType = vType.toLowerCase();
            const normalizedSearchType = searchType.toLowerCase();
            
            // Special handling for screen printing variations
            if (normalizedSearchType === 'screen printing') {
              return ['screen printing', 'screen printer', 'screen print'].includes(normalizedType);
            }
            
            return normalizedType === normalizedSearchType;
          }) ?? false;

          // Check in services array
          const matchInServices = vendor.services?.some(service => {
            const serviceName = typeof service === 'object' ? service.name : service;
            const normalizedService = serviceName?.toLowerCase() || '';
            const normalizedSearchType = searchType.toLowerCase();
            
            // Special handling for screen printing variations
            if (normalizedSearchType === 'screen printing') {
              return ['screen printing', 'screen printer', 'screen print'].includes(normalizedService);
            }
            
            return normalizedService === normalizedSearchType;
          }) ?? false;

          return matchInCategories || matchInServices;
        });
      });
    }
    
    setFilteredVendors(filtered);
    setIsLoading(false);
  };

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const vendorsRef = collection(db, 'vendors');
      const vendorsSnapshot = await getDocs(vendorsRef);
      
      const vendorsList = await Promise.all(vendorsSnapshot.docs.map(async docSnapshot => {
        const data = docSnapshot.data();
        let location = data.location || {};
        
        // Only geocode if we have an address and no coordinates
        if (data.address && (!location.lat || !location.lng)) {
          console.log('Geocoding address for vendor:', data.companyName);
          const geocoded = await geocodeAddress(data.address);
          if (geocoded) {
            location = geocoded;
          }
        }

        // Process services to ensure we have a clean array
        let processedServices = [];
        let serviceCategories = [];
        if (Array.isArray(data.services)) {
          processedServices = data.services.filter(service => 
            service !== null && (typeof service === 'object' || typeof service === 'string')
          );
          
          // Extract service names and add them to categories
          serviceCategories = processedServices
            .map(service => typeof service === 'object' ? service.name : service)
            .filter(Boolean);
        }

        // Combine existing categories with service categories
        const combinedCategories = Array.from(new Set([
          ...(data.categories || []),
          ...serviceCategories
        ]));

        return {
          id: docSnapshot.id,
          uid: docSnapshot.id,
          companyName: data.companyName || data.vendorName,
          logo: data.logo || '',
          categories: combinedCategories,
          location: {
            lat: location.lat || 34.0448,
            lng: location.lng || -118.2654,
            address: location.address || data.address
          },
          phoneNumber: data.phoneNumber,
          email: data.email,
          website: data.website,
          moq: data.moq,
          clients: data.clients,
          description: data.description || data.bio || data.notes,
          services: processedServices,
          specializations: data.specializations || [],
          socialMedia: data.socialMedia || {}
        };
      }));

      console.log('Processed vendors:', vendorsList);
      setVendors(vendorsList);
      setFilteredVendors(vendorsList);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setMapError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const onMapLoad = (map) => {
    setMapRef(map);
  };

  const mapOptions = {
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    zoomControl: window.innerWidth > 768,
    gestureHandling: 'greedy',
    styles: [
      {
        featureType: "poi",
        elementType: "all",
        stylers: [
          { visibility: "off" }
        ]
      }
    ]
  };

  const renderMapView = () => (
    <div className="map-container">
      <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          zoom={13}
          center={defaultCenter}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {filteredVendors.map((vendor) => (
            <Marker
              key={vendor.id}
              position={{
                lat: vendor.location.lat,
                lng: vendor.location.lng
              }}
              onClick={() => {
                setSelectedVendor(vendor);
                // On mobile, scroll the vendor card into view
                if (window.innerWidth <= 768) {
                  const card = document.querySelector(`[data-vendor-id="${vendor.id}"]`);
                  if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                }
              }}
            />
          ))}
          
          {selectedVendor && (
            <InfoWindow
              position={{
                lat: selectedVendor.location.lat,
                lng: selectedVendor.location.lng
              }}
              onCloseClick={() => setSelectedVendor(null)}
            >
              <div className="info-window">
                <h3>{selectedVendor.companyName}</h3>
                <p>{selectedVendor.categories.join(', ')}</p>
                {selectedVendor.location.address && (
                  <p className="address">{selectedVendor.location.address}</p>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );

  const renderListView = () => (
    <div className="list-container">
      <div className="vendor-grid">
        {filteredVendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            isSelected={selectedVendor?.id === vendor.id}
            onClick={() => setSelectedVendor(vendor)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="main-content">
      <div className="view-toggle-container">
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${view === 'map' ? 'active' : ''}`}
            onClick={() => setView('map')}
          >
            <FaMapMarkedAlt /> Map View
          </button>
          <button 
            className={`toggle-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            <FaList /> List View
          </button>
          {userProfile?.userType === 'vendor' && (
            <button 
              className={`toggle-btn ${view === 'leads' ? 'active' : ''}`}
              onClick={() => setView('leads')}
            >
              <FaStream /> Lead Zone
            </button>
          )}
        </div>
      </div>

      <div className="search-filters">
        <div className="filter-buttons">
          <button 
            className={selectedTypes.length === 0 ? 'active' : ''} 
            onClick={() => handleTypeFilter('All')}
          >
            All
          </button>
          <button 
            className={selectedTypes.includes('Fabric Vendor') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Fabric Vendor')}
          >
            Fabric Vendor
          </button>
          <button 
            className={selectedTypes.includes('Dye House') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Dye House')}
          >
            Dye House
          </button>
          <button 
            className={selectedTypes.includes('Cut & Sew Manufacturer') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Cut & Sew Manufacturer')}
          >
            Cut & Sew Manufacturer
          </button>
          <button 
            className={selectedTypes.includes('Supplies & Hardware') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Supplies & Hardware')}
          >
            Supplies & Hardware
          </button>
          <button 
            className={selectedTypes.includes('Blank Vendors') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Blank Vendors')}
          >
            Blank Vendors
          </button>
          <button 
            className={selectedTypes.includes('Screen Printing') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Screen Printing')}
          >
            Screen Printing
          </button>
          <button 
            className={selectedTypes.includes('Embroidery') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Embroidery')}
          >
            Embroidery
          </button>
          <button 
            className={selectedTypes.includes('DTG Printer') ? 'active' : ''} 
            onClick={() => handleTypeFilter('DTG Printer')}
          >
            DTG Printer
          </button>
          <button 
            className={selectedTypes.includes('DTF Transfers') ? 'active' : ''} 
            onClick={() => handleTypeFilter('DTF Transfers')}
          >
            DTF Transfers
          </button>
          <button 
            className={selectedTypes.includes('3PL Fullfilment') ? 'active' : ''} 
            onClick={() => handleTypeFilter('3PL Fullfilment')}
          >
            3PL Fullfilment
          </button>
          <button 
            className={selectedTypes.includes('Hat Vendor') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Hat Vendor')}
          >
            Hat Vendor
          </button>
          <button 
            className={selectedTypes.includes('Rhinestone Vendor') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Rhinestone Vendor')}
          >
            Rhinestone Vendor
          </button>
          <button 
            className={selectedTypes.includes('Patch Vendor') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Patch Vendor')}
          >
            Patch Vendor
          </button>
          <button 
            className={selectedTypes.includes('Photo Studios') ? 'active' : ''} 
            onClick={() => handleTypeFilter('Photo Studios')}
          >
            Photo Studios
          </button>
        </div>
      </div>

      {view === 'map' && (
        <div className="map-and-cards-container">
          <div className="vendor-cards-section">
            <div className="vendor-section-header">
              <input
                type="text"
                className="search-input"
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            {isLoading ? (
              <div className="loading">Loading vendors...</div>
            ) : (
              <div className="vendor-grid">
                {filteredVendors.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    isSelected={selectedVendor?.id === vendor.id}
                    onClick={() => {
                      setSelectedVendor(vendor);
                      if (mapRef) {
                        mapRef.panTo({
                          lat: vendor.location.lat,
                          lng: vendor.location.lng
                        });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="map-section">
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              zoom={13}
              center={defaultCenter}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                zoomControl: true,
                styles: [
                  {
                    featureType: "poi",
                    elementType: "all",
                    stylers: [
                      { visibility: "off" }
                    ]
                  }
                ]
              }}
              onLoad={onMapLoad}
            >
              {filteredVendors.map((vendor) => (
                <Marker
                  key={vendor.id}
                  position={{
                    lat: vendor.location.lat,
                    lng: vendor.location.lng
                  }}
                  onClick={() => setSelectedVendor(vendor)}
                  icon={getMarkerIcon(vendor.categories)}
                />
              ))}
              
              {selectedVendor && (
                <InfoWindow
                  position={{
                    lat: selectedVendor.location.lat,
                    lng: selectedVendor.location.lng
                  }}
                  onCloseClick={() => setSelectedVendor(null)}
                >
                  <div>
                    <h3>{selectedVendor.companyName}</h3>
                    <p>{selectedVendor.categories.join(', ')}</p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </div>
        </div>
      )}
      
      {view === 'list' && (
        <div className="list-view-container">
          {isLoading ? (
            <div className="loading">Loading vendors...</div>
          ) : (
            <div className="list-vendor-grid">
              {filteredVendors.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  isSelected={selectedVendor?.id === vendor.id}
                  onClick={() => setSelectedVendor(vendor)}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {view === 'leads' && <LeadZone />}
    </div>
  );
};

export default MapPage; 