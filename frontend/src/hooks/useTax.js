import { useState, useCallback } from 'react';
import api from '../lib/api';

export const useTax = () => {
  const [gstSummary, setGstSummary] = useState(null);
  const [vatSummary, setVatSummary] = useState(null);
  const [gstr1, setGstr1] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGSTSummary = useCallback(async (fromDate, toDate) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const response = await api.get(`/api/erp/tax/gst-summary?${params}`);
      setGstSummary(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVATSummary = useCallback(async (fromDate, toDate) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const response = await api.get(`/api/erp/tax/vat-summary?${params}`);
      setVatSummary(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGSTR1 = useCallback(async (fromDate, toDate) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const response = await api.get(`/api/erp/tax/gstr1?${params}`);
      setGstr1(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    gstSummary,
    vatSummary,
    gstr1,
    loading,
    error,
    fetchGSTSummary,
    fetchVATSummary,
    fetchGSTR1,
  };
};
