const DEFAULT_BASE_URL =
  import.meta.env.MODE === 'development' ? 'http://127.0.0.1:5000' : '';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;
const BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : '';

function buildUrl(path) {
  if (!path.startsWith('/')) {
    return `${BASE_URL}/${path}`;
  }
  return `${BASE_URL}${path}`;
}

const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function resolveApiUrl(path) {
  if (!path) {
    return '';
  }
  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }
  if (!BASE_URL) {
    return path.startsWith('/') ? path : `/${path}`;
  }
  return buildUrl(path);
}

async function request(path, options = {}) {
  const url = BASE_URL ? buildUrl(path) : path;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers
  });

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function apiGet(path, { signal } = {}) {
  return request(path, { method: 'GET', signal });
}

export function apiPost(path, body, { signal } = {}) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    signal
  });
}

export function apiPatch(path, body, { signal } = {}) {
  return request(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    signal
  });
}

export function apiDelete(path, { signal } = {}) {
  return request(path, {
    method: 'DELETE',
    signal
  });
}

export function apiPut(path, body, { signal } = {}) {
  return request(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    signal
  });
}

export async function apiUpload(path, formData, { signal } = {}) {
  const url = BASE_URL ? buildUrl(path) : path;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    signal
  });

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function withFallback(fetcher, fallbackValue) {
  try {
    return await fetcher();
  } catch (error) {
    if (typeof fallbackValue === 'function') {
      return fallbackValue(error);
    }
    return fallbackValue;
  }
}
