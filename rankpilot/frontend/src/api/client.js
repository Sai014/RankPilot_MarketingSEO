import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = await authHeaders();
  const config = {
    ...options,
    headers: { ...headers, ...options.headers },
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError('Network error — is the backend running?', 'network_error', 0);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('Invalid JSON response from server', 'parse_error', response.status);
  }

  if (!response.ok) {
    const detail = body.detail;
    const message =
      typeof detail === 'object' ? detail.error || JSON.stringify(detail) : detail || body.error || 'Request failed';
    const code = typeof detail === 'object' ? detail.code : body.code || 'api_error';
    throw new ApiError(message, code, response.status);
  }

  return body;
}

export const api = {
  health: () => request('/health'),

  // Domains
  listDomains: () => request('/api/domains'),
  createDomain: (data) => request('/api/domains', { method: 'POST', body: JSON.stringify(data) }),
  updateDomain: (id, data) => request(`/api/domains/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getDomain: (id) => request(`/api/domains/${id}`),
  deleteDomain: (id) => request(`/api/domains/${id}`, { method: 'DELETE' }),
  refreshDomain: (id) => request(`/api/domains/${id}/refresh`, { method: 'POST' }),

  // Pages
  listPages: (domainId, params = {}) => {
    const qs = new URLSearchParams({ domain_id: domainId, ...params });
    return request(`/api/pages?${qs}`);
  },
  updatePage: (pageId, data) =>
    request(`/api/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePage: (pageId) => request(`/api/pages/${pageId}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: (domainId) => request(`/api/dashboard/${domainId}`),

  // Projects
  listProjects: () => request('/api/projects'),
  createProject: (data) => request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id) => request(`/api/projects/${id}`),
  updateProject: (id, data) => request(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),

  // Legacy / tools (still available via API)
  crawlSitemap: (data) => request('/api/sitemap/crawl', { method: 'POST', body: JSON.stringify(data) }),
  trackSerp: (data) => request('/api/serp/track', { method: 'POST', body: JSON.stringify(data) }),
  auditPageSpeed: (data) => request('/api/pagespeed/audit', { method: 'POST', body: JSON.stringify(data) }),
  scrapeCompetitor: (data) => request('/api/competitors/scrape', { method: 'POST', body: JSON.stringify(data) }),
};

export { ApiError };
