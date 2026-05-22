import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { getAuthStatus } from './services/api';

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
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#7f8c8d' }}>Loading...</div>;
  }

  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <Header authenticated={authenticated} instanceUrl={instanceUrl} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/" element={<Navigate to={authenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
