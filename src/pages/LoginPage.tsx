import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'sf_tda_credentials';

const CATEGORIES = [
  { icon: '⚙️',  name: 'Configuration',          checks: 13 },
  { icon: '💻',  name: 'Code Quality',            checks: 21 },
  { icon: '🗄️',  name: 'Data Model',              checks: 4  },
  { icon: '🎧',  name: 'Service Cloud',           checks: 69 },
  { icon: '🔒',  name: 'Sharing & Security',      checks: 24 },
  { icon: '🔌',  name: 'Integrations',            checks: 9  },
  { icon: '🧪',  name: 'Test Coverage',           checks: 4  },
  { icon: '📊',  name: 'Org Limits',              checks: 3  },
  { icon: '🔁',  name: 'Duplicate Rules',         checks: 4  },
  { icon: '📈',  name: 'Reports & Dashboards',    checks: 3  },
  { icon: '📧',  name: 'Email Templates',         checks: 3  },
  { icon: '⚡',  name: 'Platform Events',         checks: 3  },
  { icon: '📦',  name: 'Managed Packages',        checks: 3  },
  { icon: '🔧',  name: 'Custom Metadata',         checks: 3  },
  { icon: '📋',  name: 'Record Types & Layouts',  checks: 4  },
  { icon: '🤖',  name: 'Einstein & AI',           checks: 9  },
  { icon: '🌐',  name: 'Experience Cloud',        checks: 12 },
  { icon: '🛡️',  name: 'Connected App Security',  checks: 10 },
  { icon: '⚡',  name: 'LWC & Components',        checks: 39 },
  { icon: '🎨',  name: 'OmniStudio',             checks: 26 },
  { icon: '🚀',  name: 'Performance',             checks: 16 },
];

const TOTAL_CHECKS = CATEGORIES.reduce((sum, c) => sum + c.checks, 0);

export const LoginPage: React.FC = () => {
  const [loginUrl, setLoginUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth_failed') {
      setError('Authentication failed. Check your Client ID, Client Secret, and Callback URL in your Connected App.');
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { loginUrl: u, clientId: id, clientSecret: s } = JSON.parse(saved);
        if (u) setLoginUrl(u);
        if (id) setClientId(id);
        if (s) setClientSecret(s);
      }
    } catch {}
  }, []);

  const handleLogin = () => {
    if (!loginUrl.trim() || !clientId.trim() || !clientSecret.trim()) {
      setError('All three fields are required.');
      return;
    }
    let url = loginUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    url = url.replace(/\/$/, '');

    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ loginUrl: url, clientId: clientId.trim(), clientSecret: clientSecret.trim() }));
      } catch {}
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    const params = new URLSearchParams({ loginUrl: url, clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    window.location.href = `/auth/login?${params.toString()}`;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #dde1e7',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    marginTop: '5px',
    outline: 'none',
    color: '#2c3e50',
    backgroundColor: '#fafbfc',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#5a6472',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: '0 0 60%',
        background: 'linear-gradient(145deg, #032D60 0%, #0070D2 60%, #1589EE 100%)',
        color: 'white',
        padding: '52px 56px',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          {/* Wordmark */}
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.85, letterSpacing: '0.05em' }}>
              SALESFORCE TECH DEBT ASSESSOR
            </span>
          </div>

          <h1 style={{
            fontSize: '2.4rem',
            fontWeight: 700,
            margin: '0 0 8px',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}>
            Know your org's<br />health in minutes.
          </h1>

          <p style={{ fontSize: '0.9rem', opacity: 0.75, margin: '0 0 6px', fontWeight: 400 }}>
            by <strong style={{ opacity: 1 }}>Steven Bilgram</strong>, Success Architect
          </p>

          <p style={{
            fontSize: '0.95rem',
            lineHeight: 1.65,
            opacity: 0.88,
            maxWidth: '520px',
            marginTop: '20px',
          }}>
            Connects securely to your Salesforce org via OAuth and runs a comprehensive
            read-only scan across <strong>{TOTAL_CHECKS} checks</strong> in {CATEGORIES.length} categories —
            surfacing technical debt, security gaps, and configuration anti-patterns with
            prioritised recommendations.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex',
          gap: '32px',
          marginBottom: '36px',
          paddingBottom: '28px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
        }}>
          {[
            { value: TOTAL_CHECKS, label: 'Total Checks' },
            { value: CATEGORIES.length, label: 'Categories' },
            { value: '100%', label: 'Read-Only' },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px', letterSpacing: '0.03em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Category grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}>
          {CATEGORIES.map(cat => (
            <div key={cat.name} style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px 14px',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{cat.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {cat.name}
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  opacity: 0.65,
                  marginTop: '1px',
                }}>
                  {cat.checks} check{cat.checks !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{
          marginTop: '28px',
          fontSize: '0.72rem',
          opacity: 0.5,
          lineHeight: 1.5,
        }}>
          Read-only OAuth access · No data stored · Credentials saved locally only
        </p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: '0 0 40%',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#1a2332',
            margin: '0 0 6px',
          }}>
            Connect your org
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#7f8c8d', margin: '0 0 32px', lineHeight: 1.5 }}>
            Enter your Connected App credentials to authenticate via Salesforce OAuth.
          </p>

          {error && (
            <div style={{
              backgroundColor: '#fdf0ed',
              border: '1px solid #e74c3c',
              borderRadius: '6px',
              padding: '10px 14px',
              marginBottom: '20px',
              fontSize: '0.82rem',
              color: '#c0392b',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              Org / Sandbox URL
              <input
                type="text"
                placeholder="https://company--uat.sandbox.my.salesforce.com"
                value={loginUrl}
                onChange={e => { setLoginUrl(e.target.value); setError(''); }}
                style={inputStyle}
              />
            </label>
            <p style={{ fontSize: '0.72rem', color: '#aaa', margin: '4px 0 0' }}>
              Use your org's My Domain URL
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              Client ID (Consumer Key)
              <input
                type="text"
                placeholder="3MVG9..."
                value={clientId}
                onChange={e => { setClientId(e.target.value); setError(''); }}
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>
              Client Secret (Consumer Secret)
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={clientSecret}
                onChange={e => { setClientSecret(e.target.value); setError(''); }}
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#0070D2' }}
            />
            <label htmlFor="remember" style={{ fontSize: '0.8rem', color: '#5a6472', cursor: 'pointer' }}>
              Remember credentials on this device
            </label>
          </div>

          <button
            onClick={handleLogin}
            style={{
              background: 'linear-gradient(135deg, #0070D2 0%, #1589EE 100%)',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              letterSpacing: '0.01em',
              boxShadow: '0 2px 8px rgba(0,112,210,0.35)',
              transition: 'opacity 0.15s, transform 0.1s',
            }}
            onMouseOver={e => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Connect to Salesforce →
          </button>

          <p style={{ marginTop: '20px', fontSize: '0.72rem', color: '#bdc3c7', lineHeight: 1.6, textAlign: 'center' }}>
            Need a Connected App?{' '}
            <a
              href="https://github.com/sbilgram-lgtm/sf-tech-debt-assessor#setup"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#0070D2', textDecoration: 'none', fontWeight: 500 }}
            >
              See the setup guide →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
