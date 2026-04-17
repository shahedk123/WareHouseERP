import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams(filters);
      const response = await api.get(`/api/erp/products?${params}`);
      setProducts(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await api.get('/api/erp/products/groups/list');
      setGroups(response.data);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/api/erp/products/categories/list');
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  const createProduct = useCallback(async (data) => {
    try {
      const response = await api.post('/api/erp/products', data);
      setProducts(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const updateProduct = useCallback(async (id, data) => {
    try {
      const response = await api.put(`/api/erp/products/${id}`, data);
      setProducts(prev => prev.map(p => p.id === id ? response.data : p));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const deleteProduct = useCallback(async (id) => {
    try {
      await api.delete(`/api/erp/products/${id}`);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  const createGroup = useCallback(async (name, sortOrder = 0) => {
    try {
      const response = await api.post('/api/erp/products/groups', { name, sort_order: sortOrder });
      setGroups(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const fetchLowStock = useCallback(async () => {
    try {
      const response = await api.get('/api/erp/products/alerts/low-stock');
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchGroups();
    fetchCategories();
  }, [fetchProducts, fetchGroups, fetchCategories]);

  return {
    products,
    groups,
    categories,
    loading,
    error,
    fetchProducts,
    fetchGroups,
    fetchCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    createGroup,
    fetchLowStock,
  };
};
