import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../../hooks/useInvoices';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { fmtCurrency } from '../../lib/format';
import api from '../../lib/api';

const STATUS_VARIANT = { draft: 'warning', confirmed: 'info', paid: 'success', cancelled: 'error' };

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const { invoices, loading } = useInvoices();
  const [typeFilter,   setTypeFilter]   = useState('sale');
  const [statusFilter, setStatusFilter] = useState('');
  const [downloading,  setDownloading]  = useState(null); // invoice id being downloaded

  const filtered = invoices.filter(inv =>
    (!typeFilter   || inv.type   === typeFilter) &&
    (!statusFilter || inv.status === statusFilter)
  );

  const handleDownload = async (e, inv) => {
    e.stopPropagation();
    setDownloading(inv.id);
    try {
      // Read saved template prefs from localStorage
      const prefs = JSON.parse(localStorage.getItem('wv-invoice-template-prefs') || '{}');
      const params = new URLSearchParams({ template: prefs.template || 'modern' });
      if (prefs.color) params.set('primaryColor', prefs.color);

      const res = await api.get(`/api/erp/invoices/${inv.id}/pdf?${params}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${inv.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF error: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice No.',
      render: (v) => <span style={{ fontWeight: 600, color: '#1D4ED8' }}>{v}</span>,
    },
    {
      key: 'invoice_date',
      label: 'Date',
      render: (v, row) => fmtDate(v || row.date),
    },
    { key: 'party_name', label: 'Party' },
    {
      key: 'grand_total',
      label: 'Amount',
      render: (v) => <strong>{fmtCurrency(v)}</strong>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <Badge variant={STATUS_VARIANT[v] || 'default'}>
          {v?.charAt(0).toUpperCase() + v?.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (id, row) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${id}`); }}
            style={{
              padding: '4px 10px', fontSize: 12, fontWeight: 500,
              border: '1px solid #D1D5DB', borderRadius: 5,
              background: 'white', cursor: 'pointer', color: '#374151',
            }}
          >
            View
          </button>
          <button
            onClick={(e) => handleDownload(e, row)}
            disabled={downloading === id}
            style={{
              padding: '4px 10px', fontSize: 12, fontWeight: 500,
              border: '1px solid #3B82F6', borderRadius: 5,
              background: downloading === id ? '#EFF6FF' : '#EFF6FF',
              cursor: downloading === id ? 'wait' : 'pointer',
              color: '#1D4ED8',
            }}
          >
            {downloading === id ? '…' : '⬇ PDF'}
          </button>
        </div>
      ),
    },
  ];

  const selectStyle = {
    padding: '8px 12px', border: '1px solid #D1D5DB',
    borderRadius: 6, fontSize: 14, background: 'white',
  };

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#111827' }}>Invoices</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
            {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/invoices/create')}>
          + New Invoice
        </Button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          <option value="sale">Sales</option>
          <option value="purchase">Purchases</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {(typeFilter || statusFilter) && (
          <button onClick={() => { setTypeFilter(''); setStatusFilter(''); }}
            style={{ fontSize: 13, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear
          </button>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No invoices yet — create your first invoice"
          onRowClick={(row) => navigate(`/invoices/${row.id}`)}
        />
      </div>
    </div>
  );
}
