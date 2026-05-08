import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Header.css';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="main-header">
      <div className="header-container">
        <Link to="/" className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="32" height="32" rx="8" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M12 20L18 26L28 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="logo-text">
            <span className="logo-main">Performance</span>
            <span className="logo-sub">Tracker</span>
          </span>
        </Link>

        <nav className="header-nav">
          {user && (
            <>
              <span className="header-email">{user.username}</span>
              <button className="btn-logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Déconnexion
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
