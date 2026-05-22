import React, { useState, useEffect } from 'react';

export const LoginPage: React.FC = () => {
  const [loginUrl, setLoginUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth_failed') {
      setError('Authentication failed. Check your Client ID, Client Secret, and Callback URL in your Connected App.');
    }
  }, []);

  const handleLogin = () => {
    if (!loginUrl.trim() || !clientId.trim() || !clientSecret.trim()) {
      setError('All three fields are required.');
      return;
    }
    let url = loginUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    // strip trailing slash
    url = url.replace(/\/$/, '');
    const params = new URLSearchParams({ loginUrl: url, clientId, clientSecret });
    window.location.href = `/auth/login?${params.toString()}`;
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #dde1e7',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
    marginTop: '6px',
    outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#555',
    textAlign: 'left'
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
        maxWidth: '460px',
        width: '100%'
      }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '8px' }}>SF Tech Debt Assessor</h2>
        <p style={{ color: '#7f8c8d', marginBottom: '32px', fontSize: '0.9rem' }}>
          Enter your Salesforce org details to begin the assessment.
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fdf0ed',
            border: '1px solid #e74c3c',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            color: '#c0392b',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>
            Sandbox / Org URL
            <input
              type="text"
              placeholder="https://yourorg.sandbox.my.salesforce.com"
              value={loginUrl}
              onChange={e => { setLoginUrl(e.target.value); setError(''); }}
              style={fieldStyle}
            />
          </label>
          <p style={{ fontSize: '0.75rem', color: '#aaa', textAlign: 'left', margin: '4px 0 0' }}>
            Use your org's My Domain URL (e.g. https://company--uat.sandbox.my.salesforce.com)
          </p>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>
            Connected App Client ID (Consumer Key)
            <input
              type="text"
              placeholder="3MVG9..."
              value={clientId}
              onChange={e => { setClientId(e.target.value); setError(''); }}
              style={fieldStyle}
            />
          </label>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={labelStyle}>
            Connected App Client Secret (Consumer Secret)
            <input
              type="password"
              placeholder="••••••••••••••••"
              value={clientSecret}
              onChange={e => { setClientSecret(e.target.value); setError(''); }}
              style={fieldStyle}
            />
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
          onMouseOver={e => (e.currentTarget.style.backgroundColor = '#2980b9')}
          onMouseOut={e => (e.currentTarget.style.backgroundColor = '#3498db')}
        >
          Connect to Salesforce
        </button>

        <p style={{ marginTop: '20px', fontSize: '0.75rem', color: '#bdc3c7', lineHeight: '1.5' }}>
          Need help setting up a Connected App?{' '}
          <a href="https://github.com/sbilgram-lgtm/sf-tech-debt-assessor#setup" target="_blank" rel="noreferrer" style={{ color: '#3498db' }}>
            See the setup guide
          </a>
        </p>
      </div>
    </div>
  );
};
