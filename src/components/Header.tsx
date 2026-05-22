import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/api';

interface HeaderProps {
  authenticated: boolean;
  instanceUrl?: string | null;
}

export const Header: React.FC<HeaderProps> = ({ authenticated, instanceUrl }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header style={{
      backgroundColor: '#2c3e50',
      color: 'white',
      padding: '16px 32px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600 }}>
          SF Tech Debt Assessor
        </h1>
        <span style={{ fontSize: '0.75rem', backgroundColor: '#3498db', padding: '2px 8px', borderRadius: '10px' }}>
          Service Cloud
        </span>
      </div>
      {authenticated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {instanceUrl && (
            <span style={{ fontSize: '0.8rem', color: '#bdc3c7' }}>{instanceUrl}</span>
          )}
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #bdc3c7',
              color: '#bdc3c7',
              padding: '6px 14px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </header>
  );
};
