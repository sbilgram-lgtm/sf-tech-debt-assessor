import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { getAuthStatus } from './services/api';

function AppInner({ authenticated, instanceUrl }: { authenticated: boolean; instanceUrl: string | null }) {
  const location = useLocation();
  const showHeader = authenticated && location.pathname !== '/login';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {showHeader && <Header authenticated={authenticated} instanceUrl={instanceUrl} />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/" element={<Navigate to={authenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </div>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getAuthStatus()
      .then(status => {
        setAuthenticated(status.authenticated);
        setInstanceUrl(status.instanceUrl);
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#7f8c8d' }}>
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <AppInner authenticated={authenticated} instanceUrl={instanceUrl} />
    </Router>
  );
}

export default App;
