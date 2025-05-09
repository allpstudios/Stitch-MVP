import React, { useState } from 'react';
import MapToggle from '../components/MapToggle';
import LeadZone from '../components/LeadZone';
import VendorMap from '../components/VendorMap'; // assuming this exists
import VendorList from '../components/VendorList'; // assuming this exists

const MapPage = () => {
  const [view, setView] = useState('map');

  return (
    <div className="map-page">
      <div className="map-header">
        <MapToggle view={view} setView={setView} />
      </div>
      
      {view === 'map' && <VendorMap />}
      {view === 'list' && <VendorList />}
      {view === 'leads' && <LeadZone />}
    </div>
  );
};

export default MapPage; 