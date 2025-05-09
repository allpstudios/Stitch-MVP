import React from 'react';
import { FaMapMarkerAlt, FaList, FaStream } from 'react-icons/fa';

const MapToggle = ({ view, setView }) => {
  return (
    <div className="view-toggle">
      <button 
        className={`toggle-btn ${view === 'map' ? 'active' : ''}`}
        onClick={() => setView('map')}
      >
        <FaMapMarkerAlt /> Map
      </button>
      <button 
        className={`toggle-btn ${view === 'list' ? 'active' : ''}`}
        onClick={() => setView('list')}
      >
        <FaList /> List
      </button>
      <button 
        className={`toggle-btn ${view === 'leads' ? 'active' : ''}`}
        onClick={() => setView('leads')}
      >
        <FaStream /> Lead Zone
      </button>
    </div>
  );
};

export default MapToggle; 