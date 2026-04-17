import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProducts } from '../hooks/useProducts';
import { useInvoices } from '../hooks/useInvoices';
import { useStock } from '../hooks/useStock';
import { fmtCurrency, fmtDate } from '../lib/format';
import StatCard from '../components/StatCard';
import api from '../lib/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const { products } = useProducts();
  const { invoices } = useInvoices();
  const { stockSummary } = useStock();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    inStock: 0,
    lowStock: 0,
    recentInvoices: [],
    todaysSales: 0,
  });

  useEffect(() => {
    const calculateStats = async () => {
      try {
        const response = await api.get('/api/settings');
        const settings = response.data;

        const totalValue = stockSummary.reduce((sum, p) => sum + (p.current_stock * (p.selling_rate || 0)), 0);
        const inStock = stockSummary.filter(p => p.current_stock > 0).length;
        const lowStock = stockSummary.filter(p => p.status === 'low_stock').length;

        const todayInvoices = invoices.filter(inv => {
          const invDate = new Date(inv.date);
          const today = new Date();
          return invDate.toDateString() === today.toDateString() && inv.type === 'sale';
        });
        const todaysSales = todayInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);

        setStats({
          totalProducts: products.length,
          totalValue,
          inStock,
          lowStock,
          recentInvoices: invoices.slice(0, 5),
          todaysSales,
        });
      } catch (err) {
        console.error('Error calculating stats:', err);
      }
    };

    calculateStats();
  }, [products, invoices, stockSummary]);

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 700, color: '#111827' }}>
        Dashboard
      </h1>
      <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#6B7280' }}>
        Welcome back, {user?.name}
      </p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard
          label="Total Products"
          value={stats.totalProducts}
          icon="📦"
          trend={null}
        />
        <StatCard
          label="Stock Value"
          value={fmtCurrency(stats.totalValue)}
          icon="💰"
          trend={null}
        />
        <StatCard
          label="In Stock"
          value={stats.inStock}
          icon="✅"
          trend={null}
        />
        <StatCard
          label="Low Stock Items"
          value={stats.lowStock}
          icon="⚠️"
          trend={null}
        />
        <StatCard
          label="Today's Sales"
          value={fmtCurrency(stats.todaysSales)}
          icon="📈"
          trend={null}
        />
      </div>

      {/* Recent Invoices */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: '#111827' }}>
          Recent Invoices
        </h2>
        {stats.recentInvoices.length === 0 ? (
          <p style={{ margin: 0, color: '#9CA3AF', fontSize: '14px' }}>No invoices yet</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: '#6B7280' }}>Invoice</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: '#6B7280' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: '#6B7280' }}>Amount</th>
                  <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: '#6B7280' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentInvoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 0', color: '#111827' }}>{inv.invoice_number}</td>
                    <td style={{ padding: '12px 0', color: '#6B7280' }}>{fmtDate(inv.date)}</td>
                    <td style={{ padding: '12px 0', color: '#111827', fontWeight: 600 }}>{fmtCurrency(inv.grand_total)}</td>
                    <td style={{ padding: '12px 0' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        background: inv.status === 'paid' ? '#DCFCE7' : '#DBEAFE',
                        color: inv.status === 'paid' ? '#166534' : '#0C4A6E',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
