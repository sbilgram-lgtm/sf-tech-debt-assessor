import React, { useState } from 'react';

export const LoginPage: React.FC = () => {
  const [isSandbox, setIsSandbox] = useState(false);

  const handleLogin = () => {
    window.location.href = `/auth/login?sandbox=${isSandbox}`;
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '80vh',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '48px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        textAlign: 'center',
        maxWidth: '420px',
        width: '100%'
      }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '8px' }}>
          SF Tech Debt Assessor
        </h2>
        <p style={{ color: '#7f8c8d', marginBottom: '32px', fontSize: '0.9rem' }}>
          Connect your Salesforce org to assess technical debt across configuration, code, and data model.
        </p>

        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: '#555'
          }}>
            <input
              type="checkbox"
              checked={isSandbox}
              onChange={(e) => setIsSandbox(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Connect to Sandbox
          </label>
        </div>

        <button
          onClick={handleLogin}
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            padding: '14px 32px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2980b9')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3498db')}
        >
          Connect to Salesforce
        </button>

        <p style={{ marginTop: '24px', fontSize: '0.75rem', color: '#bdc3c7' }}>
          Requires a Connected App with API and Metadata access.
        </p>
      </div>
    </div>
  );
};
