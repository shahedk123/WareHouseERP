import React, { useState, useEffect } from 'react';
import { useTax } from '../../hooks/useTax';
import { fmtCurrency, fmtDate } from '../../lib/format';
import { Button } from '../../components/ui/Button';

export default function GSTSummaryPage() {
  const { gstSummary, loading, fetchGSTSummary } = useTax();
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchGSTSummary(dateRange.from, dateRange.to);
  }, [dateRange, fetchGSTSummary]);

  const handleExport = () => {
    if (!gstSummary) return;
    const csv = [
      ['GST Summary Report'],
      ['From', dateRange.from, 'To', dateRange.to],
      [],
      ['Sales'],
      ['Total Taxable', fmtCurrency(gstSummary.sale?.total_taxable || 0)],
      ['CGST', fmtCurrency(gstSummary.sale?.total_cgst || 0)],
      ['SGST', fmtCurrency(gstSummary.sale?.total_sgst || 0)],
      ['Invoices', gstSummary.sale?.invoices || 0],
      [],
      ['Purchases'],
      ['Total Taxable', fmtCurrency(gstSummary.purchase?.total_taxable || 0)],
      ['CGST', fmtCurrency(gstSummary.purchase?.total_cgst || 0)],
      ['SGST', fmtCurrency(gstSummary.purchase?.total_sgst || 0)],
      ['Invoices', gstSummary.purchase?.invoices || 0],
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst-summary-${dateRange.from}-${dateRange.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 700, color: '#111827' }}>
            GST Summary
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            Tax reports for GST compliance
          </p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          📥 Export CSV
        </Button>
      </div>

      {/* Date Filters */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', background: 'white', padding: '16px', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>
            From Date
          </label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>
            To Date
          </label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Sales */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600, color: '#111827' }}>
            Sales
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #E5E7EB' }}>
              <span style={{ color: '#6B7280' }}>Total Taxable Amount</span>
              <span style={{ fontWeight: 600, color: '#111827' }}>
                {fmtCurrency(gstSummary?.sale?.total_taxable || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <span style={{ color: '#6B7280' }}>CGST (9%)</span>
              <span style={{ fontWeight: 600, color: '#10B981' }}>
                {fmtCurrency(gstSummary?.sale?.total_cgst || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <span style={{ color: '#6B7280' }}>SGST (9%)</span>
              <span style={{ fontWeight: 600, color: '#10B981' }}>
                {fmtCurrency(gstSummary?.sale?.total_sgst || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #E5E7EB', fontSize: '16px' }}>
              <span style={{ color: '#374151', fontWeight: 600 }}>Total GST</span>
              <span style={{ fontWeight: 700, color: '#1F2937' }}>
                {fmtCurrency((gstSummary?.sale?.total_cgst || 0) + (gstSummary?.sale?.total_sgst || 0))}
              </span>
            </div>
            <div style={{ marginTop: '8px', padding: '8px 12px', background: '#F3F4F6', borderRadius: '4px', color: '#6B7280', fontSize: '13px' }}>
              Invoices: {gstSummary?.sale?.invoices || 0}
            </div>
          </div>
        </div>

        {/* Purchases */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600, color: '#111827' }}>
            Purchases
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #E5E7EB' }}>
              <span style={{ color: '#6B7280' }}>Total Taxable Amount</span>
              <span style={{ fontWeight: 600, color: '#111827' }}>
                {fmtCurrency(gstSummary?.purchase?.total_taxable || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <span style={{ color: '#6B7280' }}>CGST (9%)</span>
              <span style={{ fontWeight: 600, color: '#3B82F6' }}>
                {fmtCurrency(gstSummary?.purchase?.total_cgst || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <span style={{ color: '#6B7280' }}>SGST (9%)</span>
              <span style={{ fontWeight: 600, color: '#3B82F6' }}>
                {fmtCurrency(gstSummary?.purchase?.total_sgst || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #E5E7EB', fontSize: '16px' }}>
              <span style={{ color: '#374151', fontWeight: 600 }}>Total GST</span>
              <span style={{ fontWeight: 700, color: '#1F2937' }}>
                {fmtCurrency((gstSummary?.purchase?.total_cgst || 0) + (gstSummary?.purchase?.total_sgst || 0))}
              </span>
            </div>
            <div style={{ marginTop: '8px', padding: '8px 12px', background: '#F3F4F6', borderRadius: '4px', color: '#6B7280', fontSize: '13px' }}>
              Invoices: {gstSummary?.purchase?.invoices || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
