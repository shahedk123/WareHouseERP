import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';

export const useQueue = () => {
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch bills from API
  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/whatsapp/queue');
      setBills(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch today's stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/api/whatsapp/stats/today');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Claim a bill
  const claimBill = useCallback(async (ref) => {
    try {
      const response = await api.patch(`/api/whatsapp/queue/${ref}/claim`, {});
      // Update local state
      setBills(prev =>
        prev.map(bill => (bill.ref === ref ? response.data : bill))
      );
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Mark bill as done
  const doneBill = useCallback(async (ref) => {
    try {
      const response = await api.patch(`/api/whatsapp/queue/${ref}/done`, {});
      // Remove from local state
      setBills(prev => prev.filter(bill => bill.ref !== ref));
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Skip to next bill
  const skipBill = useCallback(async (ref) => {
    try {
      const response = await api.patch(`/api/whatsapp/queue/${ref}/skip`, {});
      // Update local state
      setBills(prev =>
        prev.map(bill => (bill.ref === ref ? response.data : bill))
      );
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Subscribe to realtime updates on pending_bills table
  useEffect(() => {
    fetchBills();
    fetchStats();

    const subscription = supabase
      .channel('pending_bills')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_bills',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBills(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setBills(prev =>
              prev.map(bill => (bill.id === payload.new.id ? payload.new : bill))
            );
          } else if (payload.eventType === 'DELETE') {
            setBills(prev => prev.filter(bill => bill.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchBills, fetchStats]);

  return {
    bills,
    stats,
    loading,
    error,
    fetchBills,
    fetchStats,
    claimBill,
    doneBill,
    skipBill,
  };
};
