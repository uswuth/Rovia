import axios from 'axios';

let _accessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem('intellmeet_token') : null;

export const setAccessToken = (token: string | null) => {
  _accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('intellmeet_token', token);
    } else {
      localStorage.removeItem('intellmeet_token');
    }
  }
};

export const getAccessToken = () => {
  if (!_accessToken && typeof window !== 'undefined') {
    _accessToken = localStorage.getItem('intellmeet_token');
  }
  return _accessToken;
};

const client = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
type RefreshWaiter = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};
let refreshQueue: RefreshWaiter[] = [];

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    const isAuthEndpoint =
      original?.url?.includes('/auth/refresh-token') ||
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/signup');

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(client(original));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const { data } = await client.post<{ data: { accessToken: string } }>('/auth/refresh-token');
        const newToken = data.data.accessToken;
        setAccessToken(newToken);
        const queued = refreshQueue;
        refreshQueue = [];
        queued.forEach((waiter) => waiter.resolve(newToken));
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch (refreshErr) {
        // The refresh token is spent or invalid; the session cannot be recovered.
        // Every parked request must also settle — dropping the queue would leave
        // its callers pending forever (silent spinner hang).
        setAccessToken(null);
        const queued = refreshQueue;
        refreshQueue = [];
        queued.forEach((waiter) => waiter.reject(refreshErr));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export const api = client;
export default client;
