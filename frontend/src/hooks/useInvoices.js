import { useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

export const useInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInvoices = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams(filters);
      const response = await api.get(`/api/erp/invoices?${params}`);
      setInvoices(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createInvoice = useCallback(async (data) => {
    try {
      const response = await api.post('/api/erp/invoices', data);
      setInvoices(prev => [...prev, response.data.invoice]);
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const getInvoice = useCallback(async (id) => {
    try {
      const response = await api.get(`/api/erp/invoices/${id}`);
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const confirmInvoice = useCallback(async (id) => {
    try {
      const response = await api.put(`/api/erp/invoices/${id}/confirm`, {});
      setInvoices(prev => prev.map(inv => inv.id === id ? response.data : inv));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const cancelInvoice = useCallback(async (id) => {
    try {
      const response = await api.put(`/api/erp/invoices/${id}/cancel`, {});
      setInvoices(prev => prev.map(inv => inv.id === id ? response.data : inv));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const downloadPDF = useCallback(async (id) => {
    try {
      const response = await api.get(`/api/erp/invoices/${id}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      throw err;
    }
  }, []);

  const recordPayment = useCallback(async (id, amount, paymentMethod = 'cash') => {
    try {
      const response = await api.post(`/api/erp/invoices/${id}/payment`, {
        amount,
        payment_method: paymentMethod,
      });
      setInvoices(prev => prev.map(inv => inv.id === id ? response.data : inv));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchInvoices({ type: 'sale' });
  }, [fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    fetchInvoices,
    createInvoice,
    getInvoice,
    confirmInvoice,
    cancelInvoice,
    downloadPDF,
    recordPayment,
  };
};
