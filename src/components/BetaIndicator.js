import React from 'react';
import { isBetaMode, switchToAlpha } from '../config/projectState';
import './BetaIndicator.css';

const BetaIndicator = () => {
  if (!isBetaMode()) return null;
  
  const handleSwitchToAlpha = () => {
    switchToAlpha();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };
  
  return (
    <div className="beta-indicator">
      <span>BETA MODE</span>
      <div className="beta-tooltip">
        This is the full beta version of the platform with all features enabled.
        <br />
        <button className="switch-button" onClick={handleSwitchToAlpha}>
          Switch to Alpha Mode
        </button>
      </div>
    </div>
  );
};

export default BetaIndicator; 