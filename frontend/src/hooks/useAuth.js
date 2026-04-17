import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem('wv-user-id');
    const userRole = localStorage.getItem('wv-user-role');
    const userName = localStorage.getItem('wv-user-name');

    if (userId && userRole) {
      setUser({ id: userId, role: userRole, name: userName });
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email) => {
    try {
      setLoading(true);
      setError(null);

      // Get user by email (simplified - expects backend to return user list)
      const response = await api.get('/api/users');
      const foundUser = response.data.find(u => u.email === email);

      if (!foundUser) {
        throw new Error('User not found');
      }

      localStorage.setItem('wv-user-id', foundUser.id);
      localStorage.setItem('wv-user-role', foundUser.role);
      localStorage.setItem('wv-user-name', foundUser.name);

      setUser({ id: foundUser.id, role: foundUser.role, name: foundUser.name });
      return foundUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wv-user-id');
    localStorage.removeItem('wv-user-role');
    localStorage.removeItem('wv-user-name');
    setUser(null);
  }, []);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAccountant = user?.role === 'accountant';
  const isPicker = user?.role === 'picker';

  return {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    isManager,
    isAccountant,
    isPicker,
  };
};
