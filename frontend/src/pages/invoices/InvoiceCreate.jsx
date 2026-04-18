import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../../hooks/useInvoices';
import { useProducts } from '../../hooks/useProducts';
import { useParties } from '../../hooks/useParties';
import { calcLineItem, calcInvoiceTotals } from '../../lib/tax';
import { fmtCurrency } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import ProductPicker from '../../components/ui/ProductPicker';

export default function InvoiceCreatePage() {
  const navigate = useNavigate();
  const { createInvoice } = useInvoices();
  const { products, groups, categories } = useProducts();
  const { getCustomers, getSuppliers } = useParties();

  const [step, setStep] = useState(1);
  const [invoiceType, setInvoiceType] = useState('sale');
  const [form, setForm] = useState({
    partyId: '',
    date: new Date().toISOString().split('T')[0],
    items: [],
    notes: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const parties = invoiceType === 'sale' ? getCustomers() : getSuppliers();
  const currentParty = parties.find(p => p.id === form.partyId);

  const handleSelectParty = (partyId) => {
    setForm(prev => ({ ...prev, partyId }));
    setStep(2);
  };

  const handleAddProduct = (product) => {
    // Prevent duplicate — just increase qty if already in list
    const existingIdx = form.items.findIndex(i => i.productId === product.id);
    if (existingIdx >= 0) {
      const newItems = [...form.items];
      newItems[existingIdx].quantity += 1;
      setForm(prev => ({ ...prev, items: newItems }));
      return;
    }

    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productId:   product.id,
        productCode: product.code,
        productName: product.name,
        quantity:    1,
        rate:        invoiceType === 'sale' ? (product.selling_rate || 0) : (product.purchase_rate || 0),
        discountPct: 0,
        tax_rate:    product.tax_rate,
        tax_type:    product.tax_type,
      }],
    }));
  };

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    setForm(prev => ({ ...prev, items: newItems }));
  };

  const handleRemoveItem = (index) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const lineItems = form.items.map(item =>
    calcLineItem(item.quantity, item.rate, item.tax_rate, item.tax_type, item.discountPct)
  );
  const totals = calcInvoiceTotals(lineItems);

  const handleCreateInvoice = async () => {
    if (!form.partyId || form.items.length === 0) {
      setError('Please select a party and add at least one item');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await createInvoice({
        type:    invoiceType,
        partyId: form.partyId,
        date:    form.date,
        items:   form.items,
        notes:   form.notes,
      });
      navigate('/invoices');
    } catch (err) {
      setError(err.message || 'Error creating invoice');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' };

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: 700, color: '#111827' }}>
        Create Invoice
      </h1>

      {/* Step indicator */}
      <div style={{ marginBottom: '28px', display: 'flex', gap: '0' }}>
        {['Party', 'Items', 'Confirm'].map((label, i) => {
          const s = i + 1;
          const active = step === s;
          const done = step > s;
          return (
            <div
              key={s}
              onClick={() => s < step && setStep(s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: s < step ? 'pointer' : 'default',
                flex: s < 3 ? '1' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: done ? '#22C55E' : active ? '#3B82F6' : '#E5E7EB',
                  color: (done || active) ? 'white' : '#9CA3AF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '13px', flexShrink: 0,
                }}>
                  {done ? '✓' : s}
                </div>
                <span style={{ fontSize: '14px', fontWeight: active ? 600 : 400, color: active ? '#111827' : '#6B7280' }}>
                  {label}
                </span>
              </div>
              {s < 3 && (
                <div style={{ flex: 1, height: '1px', background: done ? '#22C55E' : '#E5E7EB', margin: '0 12px' }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: '#FEE2E2', color: '#991B1B', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* ── Step 1: Party ──────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: 600 }}>Select Type & Party</h2>

            {/* Invoice type toggle */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Invoice Type</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['sale', 'purchase'].map(type => (
                  <button
                    key={type}
                    onClick={() => { setInvoiceType(type); setForm(prev => ({ ...prev, partyId: '' })); }}
                    style={{
                      padding: '10px 22px',
                      border: invoiceType === type ? '2px solid #3B82F6' : '2px solid #D1D5DB',
                      background: invoiceType === type ? '#EFF6FF' : 'white',
                      borderRadius: '6px', cursor: 'pointer', fontWeight: 600,
                      color: invoiceType === type ? '#1D4ED8' : '#374151',
                    }}
                  >
                    {type === 'sale' ? '🧾 Sales Invoice' : '🛒 Purchase Invoice'}
                  </button>
                ))}
              </div>
            </div>

            {/* Party grid */}
            <div>
              <label style={labelStyle}>
                Select {invoiceType === 'sale' ? 'Customer' : 'Supplier'}
                {parties.length === 0 && (
                  <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 400, marginLeft: '8px' }}>
                    — no {invoiceType === 'sale' ? 'customers' : 'suppliers'} yet
                  </span>
                )}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {parties.map(party => (
                  <button
                    key={party.id}
                    onClick={() => handleSelectParty(party.id)}
                    style={{
                      padding: '14px', textAlign: 'left',
                      border: form.partyId === party.id ? '2px solid #3B82F6' : '1px solid #D1D5DB',
                      background: form.partyId === party.id ? '#EFF6FF' : 'white',
                      borderRadius: '6px', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#111827', marginBottom: '2px' }}>{party.name}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>{party.phone || 'No phone'}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Items ──────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>Add Line Items</h2>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>
                Party: <strong>{currentParty?.name}</strong>
              </span>
            </div>

            {/* ProductPicker */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Add Product</label>
              <ProductPicker
                products={products}
                groups={groups}
                categories={categories}
                onSelect={handleAddProduct}
                placeholder="Search by name, code, or Arabic…"
                showStock={invoiceType === 'sale'}
                showPrice
              />
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9CA3AF' }}>
                Click a product to add it to the invoice. Click again to increase quantity.
              </p>
            </div>

            {/* Items table */}
            {form.items.length > 0 ? (
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      {['Product', 'Qty', 'Rate', 'Disc %', 'Tax', 'Total', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Product' ? 'left' : 'right', fontWeight: 600, color: '#6B7280', fontSize: '12px' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => {
                      const line = lineItems[idx];
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 12px', color: '#111827' }}>
                            <div style={{ fontWeight: 500 }}>{item.productName}</div>
                            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{item.productCode}</div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <input type="number" min="1" value={item.quantity}
                              onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              style={{ width: '56px', padding: '4px 6px', border: '1px solid #D1D5DB', borderRadius: '4px', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <input type="number" step="0.01" value={item.rate}
                              onChange={e => handleUpdateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                              style={{ width: '72px', padding: '4px 6px', border: '1px solid #D1D5DB', borderRadius: '4px', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <input type="number" min="0" max="100" value={item.discountPct}
                              onChange={e => handleUpdateItem(idx, 'discountPct', parseFloat(e.target.value) || 0)}
                              style={{ width: '50px', padding: '4px 6px', border: '1px solid #D1D5DB', borderRadius: '4px', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6B7280', fontSize: '12px' }}>
                            {item.tax_rate}%
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {fmtCurrency(line?.grandTotal)}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <button onClick={() => handleRemoveItem(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '16px', lineHeight: 1 }}>
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E5E7EB' }}>
                      <td colSpan={5} style={{ padding: '12px', textAlign: 'right', color: '#6B7280', fontSize: '13px' }}>
                        {form.items.length} item{form.items.length !== 1 ? 's' : ''} · Taxable: {fmtCurrency(totals.taxableAmount)} · Tax: {fmtCurrency(totals.totalTax)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontSize: '16px', color: '#111827' }}>
                        {fmtCurrency(totals.grandTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', border: '2px dashed #E5E7EB', borderRadius: '8px', marginBottom: '20px' }}>
                No items yet — search and select products above
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button variant="primary" onClick={() => setStep(3)} disabled={form.items.length === 0}>
                Review & Confirm →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: 600 }}>Review Invoice</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '8px', fontSize: '14px' }}>
              <div>
                <div style={{ color: '#6B7280', marginBottom: '4px' }}>Type</div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{invoiceType === 'sale' ? 'Sales Invoice' : 'Purchase Invoice'}</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', marginBottom: '4px' }}>Party</div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{currentParty?.name}</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', marginBottom: '4px' }}>Date</div>
                <input type="date" value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  style={{ border: '1px solid #D1D5DB', borderRadius: '4px', padding: '4px 8px', fontSize: '14px' }}
                />
              </div>
              <div>
                <div style={{ color: '#6B7280', marginBottom: '4px' }}>Items</div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{form.items.length} line item{form.items.length !== 1 ? 's' : ''}</div>
              </div>
            </div>

            {/* Totals */}
            <div style={{ padding: '16px', background: '#F9FAFB', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
              {[
                ['Subtotal', totals.subtotal],
                ['Discount', -totals.discountAmount],
                ['Taxable Amount', totals.taxableAmount],
                ...(totals.vatAmount > 0 ? [['VAT', totals.vatAmount]] : []),
                ...(totals.cgst > 0 ? [['CGST', totals.cgst], ['SGST', totals.sgst]] : []),
              ].map(([label, amount]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#6B7280' }}>
                  <span>{label}</span>
                  <span>{fmtCurrency(amount)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: '10px', fontWeight: 700, fontSize: '16px', color: '#111827' }}>
                <span>Grand Total</span>
                <span>{fmtCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder="Any notes for this invoice…"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button variant="primary" onClick={handleCreateInvoice} loading={loading}>
                Create Invoice
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
