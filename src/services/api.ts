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

export async function getSharingSecurityData() {
  return fetchApi('/api/assess/sharing-security');
}

export async function getIntegrationData() {
  return fetchApi('/api/assess/integrations');
}

export async function getTestCoverageData() {
  return fetchApi('/api/assess/test-coverage');
}

export async function getOrgLimitsData() {
  return fetchApi('/api/assess/org-limits');
}

export async function getDuplicateRulesData() {
  return fetchApi('/api/assess/duplicate-rules');
}

export async function getReportsDashboardsData() {
  return fetchApi('/api/assess/reports-dashboards');
}

export async function getEmailTemplatesData() {
  return fetchApi('/api/assess/email-templates');
}

export async function getPlatformEventsData() {
  return fetchApi('/api/assess/platform-events');
}

export async function getManagedPackagesData() {
  return fetchApi('/api/assess/managed-packages');
}

export async function getCustomMetadataData() {
  return fetchApi('/api/assess/custom-metadata');
}

export async function getRecordTypesLayoutsData() {
  return fetchApi('/api/assess/record-types-layouts');
}

export async function getEinsteinAIData() {
  return fetchApi('/api/assess/einstein-ai');
}


export async function getExperienceCloudData() {
  return fetchApi('/api/assess/experience-cloud');
}

export async function getConnectedAppSecurityData() {
  return fetchApi('/api/assess/connected-app-security');
}

export async function getLwcData() {
  return fetchApi('/api/assess/lwc');
}

export async function getOmniStudioData() {
  return fetchApi('/api/assess/omnistudio');
}

export async function getPerformanceData() {
  return fetchApi('/api/assess/performance');
}
