import { NavLink } from 'react-router-dom';
import './Navigation.css';  // We'll create this file
import { isAlphaMode } from '../config/projectState';

const Navigation = () => {
  // If in alpha mode, only show Dashboard
  if (isAlphaMode()) {
    return (
      <nav className="main-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
      </nav>
    );
  }
  
  // In beta mode, show all navigation links except Profile
  return (
    <nav className="main-nav">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Map</NavLink>
      <NavLink to="/shop" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Shop</NavLink>
      <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
    </nav>
  );
};

export default Navigation; 