const API_BASE = '';

async function fetchApi(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'API request failed');
  }
  return res.json();
}

export async function getAuthStatus() {
  return fetchApi('/auth/status');
}

export async function logout() {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function getAutomationData() {
  return fetchApi('/api/assess/automation');
}

export async function getValidationRules() {
  return fetchApi('/api/assess/validation-rules');
}

export async function getApexData() {
  return fetchApi('/api/assess/apex');
}

export async function getDataModelData() {
  return fetchApi('/api/assess/data-model');
}

export async function getServiceCloudData() {
  return fetchApi('/api/assess/service-cloud');
}
