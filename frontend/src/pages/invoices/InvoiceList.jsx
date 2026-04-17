import React, { useState } from 'react';
import { useInvoices } from '../../hooks/useInvoices';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { fmtCurrency, fmtDate } from '../../lib/format';

export default function InvoiceListPage() {
  const { invoices, loading, fetchInvoices, downloadPDF } = useInvoices();
  const [typeFilter, setTypeFilter] = useState('sale');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredInvoices = invoices.filter(inv =>
    (typeFilter === '' || inv.type === typeFilter) &&
    (statusFilter === '' || inv.status === statusFilter)
  );

  const handleDownload = async (id) => {
    try {
      await downloadPDF(id);
    } catch (err) {
      alert('Error downloading PDF: ' + err.message);
    }
  };

  const columns = [
    { key: 'invoice_number', label: 'Invoice Number' },
    {
      key: 'date',
      label: 'Date',
      render: (value) => fmtDate(value),
    },
    {
      key: 'grand_total',
      label: 'Amount',
      render: (value) => <strong>{fmtCurrency(value)}</strong>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge variant={value}>
          {value?.charAt(0).toUpperCase() + value?.slice(1)}
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 700, color: '#111827' }}>
          Invoices
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
          Manage sales and purchase invoices
        </p>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        >
          <option value="">All Types</option>
          <option value="sale">Sales</option>
          <option value="purchase">Purchases</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <Button variant="primary">+ New Invoice</Button>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
        <DataTable
          columns={columns}
          data={filteredInvoices}
          loading={loading}
          emptyMessage="No invoices found"
        />
      </div>
    </div>
  );
}
