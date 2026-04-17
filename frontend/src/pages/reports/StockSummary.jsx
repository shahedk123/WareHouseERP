import React, { useState } from 'react';
import { useStock } from '../../hooks/useStock';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { fmtCurrency } from '../../lib/format';

export default function StockSummaryPage() {
  const { stockSummary, loading } = useStock();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = stockSummary.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: stockSummary.length,
    inStock: stockSummary.filter(p => p.status === 'ok').length,
    lowStock: stockSummary.filter(p => p.status === 'low_stock').length,
    outOfStock: stockSummary.filter(p => p.status === 'out_of_stock').length,
    totalValue: stockSummary.reduce((sum, p) => sum + (p.current_stock * (p.selling_rate || 0)), 0),
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Product' },
    {
      key: 'current_stock',
      label: 'Stock',
      render: (value) => <strong>{value}</strong>,
    },
    {
      key: 'selling_rate',
      label: 'Rate',
      render: (value) => fmtCurrency(value),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        let variant = 'default';
        if (value === 'ok') variant = 'in-stock';
        else if (value === 'low_stock') variant = 'low-stock';
        else if (value === 'out_of_stock') variant = 'out-of-stock';

        return (
          <Badge variant={variant}>
            {value === 'ok' ? 'In Stock' : value === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
          </Badge>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '28px', fontWeight: 700, color: '#111827' }}>
        Stock Summary
      </h1>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>Total Products</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>{stats.total}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>In Stock</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#10B981' }}>{stats.inStock}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>Low Stock</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#F59E0B' }}>{stats.lowStock}</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>Total Value</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{fmtCurrency(stats.totalValue)}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
          style={{
            maxWidth: '300px',
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No products found"
        />
      </div>
    </div>
  );
}
