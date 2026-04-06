const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const getHeaders = (token?: string | null) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const handleResponse = async (res: Response) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const authApi = {
  register: (body: { full_name: string; email: string; password: string }) =>
    fetch(`${BASE_URL}/auth/register`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse),

  login: (body: { email: string; password: string }) =>
    fetch(`${BASE_URL}/auth/login`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse),

  getMe: (token: string) =>
    fetch(`${BASE_URL}/auth/me`, { headers: getHeaders(token) }).then(handleResponse),
};

export const programsApi = {
  getAll: (token: string) =>
    fetch(`${BASE_URL}/programs`, { headers: getHeaders(token) }).then(handleResponse),

  getById: (id: number, token: string) =>
    fetch(`${BASE_URL}/programs/${id}`, { headers: getHeaders(token) }).then(handleResponse),
};

export const eligibilityApi = {
  check: (body: object, token: string) =>
    fetch(`${BASE_URL}/eligibility/check`, { method: 'POST', headers: getHeaders(token), body: JSON.stringify(body) }).then(handleResponse),

  checkAll: (body: object, token: string) =>
    fetch(`${BASE_URL}/eligibility/check-all`, { method: 'POST', headers: getHeaders(token), body: JSON.stringify(body) }).then(handleResponse),

  getResults: (token: string) =>
    fetch(`${BASE_URL}/eligibility/results`, { headers: getHeaders(token) }).then(handleResponse),
};

export const applicationsApi = {
  submit: (program_id: number, token: string) =>
    fetch(`${BASE_URL}/applications`, { method: 'POST', headers: getHeaders(token), body: JSON.stringify({ program_id }) }).then(handleResponse),

  getMy: (token: string) =>
    fetch(`${BASE_URL}/applications/my`, { headers: getHeaders(token) }).then(handleResponse),
};

export const profileApi = {
  get: (token: string) =>
    fetch(`${BASE_URL}/profile`, { headers: getHeaders(token) }).then(handleResponse),

  update: (body: object, token: string) =>
    fetch(`${BASE_URL}/profile`, { method: 'PUT', headers: getHeaders(token), body: JSON.stringify(body) }).then(handleResponse),
};
