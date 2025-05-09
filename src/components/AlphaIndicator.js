import React from 'react';
import { isAlphaMode, restoreToBeta } from '../config/projectState';
import './AlphaIndicator.css';

const AlphaIndicator = () => {
  if (!isAlphaMode()) return null;
  
  const handleRestoreClick = () => {
    restoreToBeta();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };
  
  return (
    <div className="alpha-indicator">
      <span>ALPHA MODE</span>
      <div className="alpha-tooltip">
        This is an alpha version of the platform. Only core order management features are available.
        <br />
        <small>Press Ctrl+Shift+B to open the command input, then type "RESTORE TO BETA" and press Enter to restore all features.</small>
        <br />
        <button className="restore-button" onClick={handleRestoreClick}>
          Restore to Beta Mode
        </button>
      </div>
    </div>
  );
};

export default AlphaIndicator; 