import { useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

export const useStock = () => {
  const [stockSummary, setStockSummary] = useState([]);
  const [ledgers, setLedgers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStockSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/erp/reports/stock-summary');
      setStockSummary(response.data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStockLedger = useCallback(async (productId) => {
    try {
      const response = await api.get(`/api/erp/stock/ledger/${productId}`);
      setLedgers(prev => ({
        ...prev,
        [productId]: response.data,
      }));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const recordStockIn = useCallback(async (data) => {
    try {
      const response = await api.post('/api/erp/stock/in', data);
      // Refresh summary
      await fetchStockSummary();
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [fetchStockSummary]);

  const recordStockOut = useCallback(async (data) => {
    try {
      const response = await api.post('/api/erp/stock/out', data);
      // Refresh summary
      await fetchStockSummary();
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [fetchStockSummary]);

  const adjustStock = useCallback(async (data) => {
    try {
      const response = await api.post('/api/erp/stock/adjust', data);
      // Refresh summary
      await fetchStockSummary();
      return response.data;
    } catch (err) {
      throw err;
    }
  }, [fetchStockSummary]);

  useEffect(() => {
    fetchStockSummary();
  }, [fetchStockSummary]);

  return {
    stockSummary,
    ledgers,
    loading,
    error,
    fetchStockSummary,
    fetchStockLedger,
    recordStockIn,
    recordStockOut,
    adjustStock,
  };
};
