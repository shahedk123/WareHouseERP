import { useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

export const useParties = () => {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchParties = useCallback(async (type = null) => {
    try {
      setLoading(true);
      setError(null);
      const params = type ? `?type=${type}` : '';
      const response = await api.get(`/api/erp/parties${params}`);
      setParties(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createParty = useCallback(async (data) => {
    try {
      const response = await api.post('/api/erp/parties', data);
      setParties(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const updateParty = useCallback(async (id, data) => {
    try {
      const response = await api.put(`/api/erp/parties/${id}`, data);
      setParties(prev => prev.map(p => p.id === id ? response.data : p));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const deleteParty = useCallback(async (id) => {
    try {
      await api.delete(`/api/erp/parties/${id}`);
      setParties(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  const getCustomers = useCallback(() => {
    return parties.filter(p => p.type === 'customer' || p.type === 'both');
  }, [parties]);

  const getSuppliers = useCallback(() => {
    return parties.filter(p => p.type === 'supplier' || p.type === 'both');
  }, [parties]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  return {
    parties,
    loading,
    error,
    fetchParties,
    createParty,
    updateParty,
    deleteParty,
    getCustomers,
    getSuppliers,
  };
};
