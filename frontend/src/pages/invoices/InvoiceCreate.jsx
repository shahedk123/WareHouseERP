import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../../hooks/useInvoices';
import { useProducts } from '../../hooks/useProducts';
import { useParties } from '../../hooks/useParties';
import { useStock } from '../../hooks/useStock';
import { calcLineItem, calcInvoiceTotals } from '../../lib/tax';
import { fmtCurrency, fmtDate } from '../../lib/format';
import { Button } from '../../components/ui/Button';

export default function InvoiceCreatePage() {
  const navigate = useNavigate();
  const { createInvoice } = useInvoices();
  const { products } = useProducts();
  const { getCustomers, getSuppliers } = useParties();
  const { stockSummary } = useStock();

  const [step, setStep] = useState(1);
  const [invoiceType, setInvoiceType] = useState('sale');
  const [form, setForm] = useState({
    partyId: '',
    date: fmtDate(new Date().toISOString().split('T')[0]),
    items: [],
    notes: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const parties = invoiceType === 'sale' ? getCustomers() : getSuppliers();
  const currentParty = parties.find(p => p.id === form.partyId);

  // Step 1: Select Party
  const handleSelectParty = (partyId) => {
    setForm(prev => ({ ...prev, partyId }));
    setStep(2);
  };

  // Step 2: Add Items
  const handleAddItem = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newItem = {
      productId,
      productCode: product.code,
      productName: product.name,
      quantity: 1,
      rate: invoiceType === 'sale' ? product.selling_rate : product.purchase_rate,
      discountPct: 0,
      tax_rate: product.tax_rate,
      tax_type: product.tax_type,
    };

    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    setForm(prev => ({ ...prev, items: newItems }));
  };

  const handleRemoveItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate totals
  const lineItems = form.items.map(item =>
    calcLineItem(
      item.quantity,
      item.rate,
      item.tax_rate,
      item.tax_type,
      item.discountPct
    )
  );
  const totals = calcInvoiceTotals(lineItems);

  // Step 3: Confirm
  const handleCreateInvoice = async () => {
    if (!form.partyId || form.items.length === 0) {
      setError('Please select a party and add items');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await createInvoice({
        type: invoiceType,
        partyId: form.partyId,
        date: form.date,
        items: form.items,
        notes: form.notes,
      });

      alert('Invoice created successfully!');
      navigate('/invoices');
    } catch (err) {
      setError(err.message || 'Error creating invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '28px', fontWeight: 700, color: '#111827' }}>
        Create Invoice
      </h1>

      {/* Steps */}
      <div style={{ marginBottom: '32px', display: 'flex', gap: '32px' }}>
        {[1, 2, 3].map(s => (
          <div
            key={s}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
            onClick={() => s < step && setStep(s)}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: step >= s ? '#3B82F6' : '#E5E7EB',
                color: step >= s ? 'white' : '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
              }}
            >
              {s}
            </div>
            <span style={{ color: step >= s ? '#111827' : '#9CA3AF', fontWeight: 500 }}>
              {['Party', 'Items', 'Confirm'][s - 1]}
            </span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: '#FEE2E2', color: '#991B1B', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Step 1: Type & Party */}
        {step === 1 && (
          <div>
            <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600 }}>
              Select Invoice Type & Party
            </h2>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px', display: 'block' }}>
                Invoice Type
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['sale', 'purchase'].map(type => (
                  <button
                    key={type}
                    onClick={() => setInvoiceType(type)}
                    style={{
                      padding: '12px 24px',
                      border: invoiceType === type ? '2px solid #3B82F6' : '2px solid #D1D5DB',
                      background: invoiceType === type ? '#EFF6FF' : 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      color: invoiceType === type ? '#1D4ED8' : '#374151',
                    }}
                  >
                    {type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', display: 'block' }}>
                Select {invoiceType === 'sale' ? 'Customer' : 'Supplier'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {parties.map(party => (
                  <button
                    key={party.id}
                    onClick={() => handleSelectParty(party.id)}
                    style={{
                      padding: '16px',
                      border: form.partyId === party.id ? '2px solid #3B82F6' : '1px solid #D1D5DB',
                      background: form.partyId === party.id ? '#EFF6FF' : 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                      {party.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      {party.phone || 'No phone'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Items */}
        {step === 2 && (
          <div>
            <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600 }}>
              Add Line Items
            </h2>

            {/* Add item dropdown */}
            <div style={{ marginBottom: '24px' }}>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItem(e.target.value);
                    e.target.value = '';
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="">Select a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name} (Stock: {p.current_stock}, ₹{p.selling_rate})
                  </option>
                ))}
              </select>
            </div>

            {/* Items table */}
            {form.items.length > 0 ? (
              <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#6B7280' }}>Product</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: 600, color: '#6B7280' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: 600, color: '#6B7280' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: 600, color: '#6B7280' }}>Discount %</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: 600, color: '#6B7280' }}>Amount</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#6B7280' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => {
                      const lineTotal = lineItems[idx];
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '12px', color: '#111827' }}>{item.productCode} - {item.productName}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value))}
                              style={{ width: '60px', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) => handleUpdateItem(idx, 'rate', parseFloat(e.target.value))}
                              style={{ width: '80px', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPct}
                              onChange={(e) => handleUpdateItem(idx, 'discountPct', parseFloat(e.target.value))}
                              style={{ width: '60px', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                            {fmtCurrency(lineTotal.grandTotal)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontWeight: 600 }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>
                No items added yet
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" onClick={() => setStep(3)} disabled={form.items.length === 0}>
                Review & Confirm
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div>
            <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600 }}>
              Review Invoice
            </h2>

            <div style={{ marginBottom: '24px', padding: '16px', background: '#F9FAFB', borderRadius: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div>
                  <div style={{ color: '#6B7280', marginBottom: '4px' }}>Party</div>
                  <div style={{ color: '#111827', fontWeight: 600 }}>{currentParty?.name}</div>
                </div>
                <div>
                  <div style={{ color: '#6B7280', marginBottom: '4px' }}>Date</div>
                  <div style={{ color: '#111827', fontWeight: 600 }}>{form.date}</div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div style={{ marginBottom: '24px', padding: '16px', background: '#F9FAFB', borderRadius: '6px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Subtotal:</span>
                <span>{fmtCurrency(totals.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Discount:</span>
                <span>-{fmtCurrency(totals.discountAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Taxable:</span>
                <span>{fmtCurrency(totals.taxableAmount)}</span>
              </div>
              {totals.cgst > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>CGST (9%):</span>
                  <span>{fmtCurrency(totals.cgst)}</span>
                </div>
              )}
              {totals.sgst > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>SGST (9%):</span>
                  <span>{fmtCurrency(totals.sgst)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: '8px', fontWeight: 600, fontSize: '16px' }}>
                <span>Grand Total:</span>
                <span>{fmtCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
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
