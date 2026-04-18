/**
 * InvoiceView — view invoice details + download PDF with template selector
 * + upload reference bill for AI-powered template configuration
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { fmtCurrency } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

// ── Template metadata ────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'modern',
    label: 'Modern',
    desc: 'Colored header, clean layout — great for most businesses',
    preview: { bg: '#1a56db', text: 'white', accent: '#dbeafe' },
  },
  {
    id: 'classic',
    label: 'Classic',
    desc: 'Black & white, professional — timeless format',
    preview: { bg: '#111827', text: 'white', accent: '#f3f4f6' },
  },
  {
    id: 'vat',
    label: 'VAT / ZATCA',
    desc: 'Bilingual EN/Arabic, ZATCA-compliant, QR placeholder',
    preview: { bg: '#0f172a', text: 'white', accent: '#e0f2fe' },
  },
  {
    id: 'thermal',
    label: 'Thermal (80mm)',
    desc: 'Compact receipt for POS thermal printers',
    preview: { bg: '#374151', text: 'white', accent: '#f9fafb' },
  },
];

const STATUS_COLORS = { draft: 'warning', confirmed: 'info', paid: 'success', cancelled: 'error' };

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loadingInv, setLoadingInv] = useState(true);
  const [error, setError] = useState('');

  // Template settings (persisted in localStorage)
  const PREFS_KEY = 'wv-invoice-template-prefs';
  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
  };
  const [prefs, setPrefs] = useState(loadPrefs);
  const [template, setTemplate] = useState(prefs.template || 'modern');
  const [color, setColor]       = useState(prefs.color    || '#1a56db');
  const [footerText, setFooterText] = useState(prefs.footerText || '');

  // Save prefs whenever they change
  useEffect(() => {
    const p = { template, color, footerText };
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  }, [template, color, footerText]);

  // Reference bill upload / AI analysis
  const fileRef = useRef(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState(null);

  // Downloading
  const [downloading, setDownloading] = useState(false);

  // Load invoice
  useEffect(() => {
    if (!id) return;
    setLoadingInv(true);
    api.get(`/api/erp/invoices/${id}`)
      .then(r => setInvoice(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoadingInv(false));
  }, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ template, primaryColor: color });
      if (footerText) params.set('footerText', footerText);

      const res = await api.get(`/api/erp/invoices/${id}/pdf?${params}`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice?.invoice_number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PDF download failed: ' + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleAnalyze = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/api/erp/invoices/template/analyze', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const a = res.data.analysis;
      setAnalyzeResult(res.data);
      // Auto-apply suggestions
      if (a.suggested_template) setTemplate(a.suggested_template);
      if (a.primary_color)      setColor(a.primary_color);
      if (a.footer_text)        setFooterText(a.footer_text);
    } catch (e) {
      setAnalyzeResult({ ok: false, error: e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loadingInv) {
    return (
      <div style={{ padding: 24, color: '#6B7280', fontSize: 14 }}>Loading invoice…</div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: '#991B1B', marginBottom: 16 }}>Invoice not found: {error}</div>
        <Button variant="secondary" onClick={() => navigate('/invoices')}>← Back</Button>
      </div>
    );
  }

  const items = invoice.invoice_items || [];

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* ── Left: Invoice details ── */}
      <div style={{ flex: '1 1 420px', minWidth: 320 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => navigate('/invoices')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13 }}>
            ← Invoices
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>
            {invoice.invoice_number}
          </h1>
          <Badge variant={STATUS_COLORS[invoice.status] || 'default'}>
            {invoice.status}
          </Badge>
        </div>

        {/* Meta */}
        <div style={{ background: 'white', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14 }}>
            {[
              ['Type',       invoice.type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice'],
              ['Date',       fmtDate(invoice.invoice_date || invoice.date)],
              ['Due Date',   fmtDate(invoice.due_date)],
              ['Party',      invoice.party_name || '-'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ color: '#9CA3AF', fontSize: 11, marginBottom: 2 }}>{label.toUpperCase()}</div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Items */}
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Product', 'Qty', 'Rate', 'Amount'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Product' ? 'left' : 'right', fontWeight: 600, color: '#6B7280', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                    {item.hsn_code && <div style={{ fontSize: 11, color: '#9CA3AF' }}>HSN: {item.hsn_code}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{item.quantity} {item.unit}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmtCurrency(item.rate)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ padding: '12px 14px', borderTop: '2px solid #E5E7EB', fontSize: 13 }}>
            {[
              ['Subtotal', invoice.subtotal],
              invoice.discount_amount > 0 ? ['Discount', -invoice.discount_amount] : null,
              ['Taxable', invoice.taxable_amount],
              invoice.vat_amount > 0   ? ['VAT',  invoice.vat_amount]  : null,
              invoice.cgst_amount > 0  ? ['CGST', invoice.cgst_amount] : null,
              invoice.sgst_amount > 0  ? ['SGST', invoice.sgst_amount] : null,
            ].filter(Boolean).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#6B7280' }}>
                <span>{label}</span><span>{fmtCurrency(val)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #E5E7EB', fontWeight: 700, fontSize: 16, color: '#111827' }}>
              <span>Grand Total</span>
              <span>{fmtCurrency(invoice.grand_total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Template selector + Download ── */}
      <div style={{ flex: '0 0 300px', minWidth: 280 }}>
        <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
            PDF Template
          </h3>

          {/* Template cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', border: template === t.id ? `2px solid ${color}` : '1px solid #E5E7EB',
                  borderRadius: 6, background: template === t.id ? `${color}10` : 'white',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {/* Mini preview swatch */}
                <div style={{ width: 36, height: 36, borderRadius: 4, background: t.preview.bg, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ height: 10, background: t.preview.bg }} />
                  <div style={{ flex: 1, background: t.preview.accent, margin: '2px 2px 2px 2px', borderRadius: 2 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.3 }}>{t.desc}</div>
                </div>
                {template === t.id && (
                  <div style={{ marginLeft: 'auto', color, fontWeight: 700, fontSize: 14 }}>✓</div>
                )}
              </button>
            ))}
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Brand / Header Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{ width: 36, height: 36, padding: 2, border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer' }}
              />
              <input
                type="text"
                value={color}
                onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value); }}
                style={{ flex: 1, padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
              />
            </div>
            {/* Quick color presets */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {['#1a56db','#0f172a','#059669','#7c3aed','#dc2626','#b45309','#0891b2'].map(c => (
                <button key={c} onClick={() => setColor(c)} title={c}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: color === c ? '2px solid #111' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
                />
              ))}
            </div>
          </div>

          {/* Footer text */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Footer Message
            </label>
            <input
              type="text"
              value={footerText}
              onChange={e => setFooterText(e.target.value)}
              placeholder="Thank you for your business."
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          <Button variant="primary" fullWidth onClick={handleDownload} loading={downloading}>
            ⬇ Download PDF
          </Button>
        </div>

        {/* ── AI reference bill analyzer ── */}
        <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
            Match Your Existing Bill
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            Upload a photo or scan of your current printed invoice — AI will detect the layout style and colors and apply them automatically.
          </p>

          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleAnalyze} />

          <Button
            variant="secondary"
            fullWidth
            onClick={() => fileRef.current?.click()}
            loading={analyzing}
          >
            {analyzing ? 'Analyzing…' : '📷 Upload Reference Bill'}
          </Button>

          {analyzeResult && (
            <div style={{
              marginTop: 14, padding: '12px 14px', borderRadius: 6, fontSize: 12,
              background: analyzeResult.ok ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${analyzeResult.ok ? '#BBF7D0' : '#FECACA'}`,
              color: analyzeResult.ok ? '#166534' : '#991B1B',
            }}>
              {analyzeResult.ok ? (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ Settings applied from your bill</div>
                  <div>Template: <strong>{analyzeResult.analysis.suggested_template}</strong></div>
                  <div>Color: <strong style={{ fontFamily: 'monospace' }}>{analyzeResult.analysis.primary_color}</strong></div>
                  {analyzeResult.analysis.notes && (
                    <div style={{ marginTop: 6, color: '#4B5563', fontStyle: 'italic' }}>{analyzeResult.analysis.notes}</div>
                  )}
                </>
              ) : (
                <div>⚠️ Could not analyze: {analyzeResult.error || 'Unknown error'}. Default settings kept.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
