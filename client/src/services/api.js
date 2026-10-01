const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'survey_builder_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, fieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request(path, { method = 'GET', body, auth = true, raw = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (raw) {
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.blob();
  }

  if (res.status === 204) return null;

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && auth) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new ApiError(res.status, payload.error || 'Request failed', payload.fieldErrors);
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  blob: (path) => request(path, { raw: true }),
};

// ---------- Auth ----------
export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  me: () => api.get('/auth/me'),
  updateProfile: (payload) => api.put('/auth/profile', payload),
  changePassword: (payload) => api.put('/auth/password', payload),
};

// ---------- Surveys ----------
export const surveyApi = {
  list: (filters) => api.get(`/surveys${toQuery(filters)}`),
  overview: () => api.get('/surveys/overview'),
  categories: () => api.get('/surveys/categories'),
  get: (id) => api.get(`/surveys/${id}`),
  create: (payload) => api.post('/surveys', payload),
  update: (id, payload) => api.patch(`/surveys/${id}`, payload),
  remove: (id) => api.del(`/surveys/${id}`),
  duplicate: (id) => api.post(`/surveys/${id}/duplicate`),
  setStatus: (id, status) => api.post(`/surveys/${id}/status/${status}`),
  rotateShareToken: (id) => api.post(`/surveys/${id}/share-token`),
};

// ---------- Questions ----------
export const questionApi = {
  list: (surveyId) => api.get(`/surveys/${surveyId}/questions`),
  create: (surveyId, payload) => api.post(`/surveys/${surveyId}/questions`, payload),
  update: (surveyId, questionId, payload) =>
    api.put(`/surveys/${surveyId}/questions/${questionId}`, payload),
  remove: (surveyId, questionId) => api.del(`/surveys/${surveyId}/questions/${questionId}`),
  reorder: (surveyId, questionIds) =>
    api.put(`/surveys/${surveyId}/questions/reorder`, { questionIds }),
};

// ---------- Responses, analytics, export ----------
export const responseApi = {
  list: (surveyId, params) => api.get(`/surveys/${surveyId}/responses${toQuery(params)}`),
  get: (surveyId, responseId) => api.get(`/surveys/${surveyId}/responses/${responseId}`),
  remove: (surveyId, responseId) => api.del(`/surveys/${surveyId}/responses/${responseId}`),
};

export const analyticsApi = {
  forSurvey: (surveyId) => api.get(`/surveys/${surveyId}/analytics`),
};

export const publicApi = {
  // Sent without an Authorization header unless the visitor is logged in
  survey: (token) => api.get(`/public/surveys/${token}`),
  submit: (token, answers) => api.post(`/public/surveys/${token}/responses`, { answers }),
};

/** Triggers a browser download for the owner export endpoints. */
export async function downloadExport(surveyId, format) {
  const blob = await api.blob(`/surveys/${surveyId}/export?format=${format}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `survey-${surveyId}-responses.${
    format === 'excel' ? 'xlsx' : format
  }`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toQuery(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries)}`;
}

export const shareUrlFor = (token) =>
  `${window.location.origin}/s/${token}`;

export { BASE as API_BASE };