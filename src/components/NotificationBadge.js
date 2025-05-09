import React from 'react';
import './NotificationBadge.css';

const NotificationBadge = ({ count }) => {
  if (!count || count === 0) return null;
  
  return (
    <div className="notification-badge">
      {count > 99 ? '99+' : count}
    </div>
  );
};

export default NotificationBadge; 