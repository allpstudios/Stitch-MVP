import React from 'react';
import './StatsCard.css';

const StatsCard = ({ title, value, icon, color }) => {
  return (
    <div className="stats-card">
      <div className="stats-icon" style={{ background: color }}>
        {icon}
      </div>
      <div className="stats-info">
        <h3>{value}</h3>
        <p>{title}</p>
      </div>
    </div>
  );
};

export default StatsCard; 