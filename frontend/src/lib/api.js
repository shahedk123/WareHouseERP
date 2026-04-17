import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const instance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Add auth headers from localStorage
instance.interceptors.request.use((config) => {
  const userId = localStorage.getItem('wv-user-id');
  const userRole = localStorage.getItem('wv-user-role');

  if (userId) {
    config.headers['x-user-id'] = userId;
  }
  if (userRole) {
    config.headers['x-user-role'] = userRole;
  }

  return config;
});

// Handle errors
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('wv-user-id');
      localStorage.removeItem('wv-user-role');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default instance;
