import React, { useState } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { useParties } from '../../hooks/useParties';
import { useStock } from '../../hooks/useStock';
import { Button } from '../../components/ui/Button';
import { fmtCurrency } from '../../lib/format';

export default function StockInPage() {
  const { products } = useProducts();
  const { getSuppliers } = useParties();
  const { recordStockIn, loading } = useStock();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    productId: '',
    quantity: '',
    rate: '',
    supplierId: '',
    refNumber: '',
  });

  const selectedProduct = products.find(p => p.id === form.productId);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'productId' && selectedProduct) {
      setForm(prev => ({ ...prev, rate: selectedProduct.purchase_rate }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.productId || !form.quantity || !form.rate) {
      setError('Please fill all required fields');
      return;
    }

    try {
      await recordStockIn({
        productId: form.productId,
        quantity: parseInt(form.quantity),
        rate: parseFloat(form.rate),
        supplierId: form.supplierId || null,
        refNumber: form.refNumber,
      });

      setSuccess('Stock recorded successfully!');
      setForm({ productId: '', quantity: '', rate: '', supplierId: '', refNumber: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '600px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 700, color: '#111827' }}>
          Stock In
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: '14px', color: '#6B7280' }}>
          Record incoming stock from suppliers
        </p>

        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: '#FEE2E2', color: '#991B1B', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '12px 16px', background: '#DCFCE7', color: '#166534', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Product *
              </label>
              <select
                value={form.productId}
                onChange={(e) => handleChange('productId', e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              >
                <option value="">Select a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => handleChange('quantity', e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                  Rate (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.rate}
                  onChange={(e) => handleChange('rate', e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Supplier
              </label>
              <select
                value={form.supplierId}
                onChange={(e) => handleChange('supplierId', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              >
                <option value="">Select a supplier...</option>
                {getSuppliers().map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Reference Number
              </label>
              <input
                type="text"
                value={form.refNumber}
                onChange={(e) => handleChange('refNumber', e.target.value)}
                placeholder="PO-001"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            {form.quantity && form.rate && (
              <div style={{ padding: '16px', background: '#F9FAFB', borderRadius: '6px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Total Value:</span>
                  <strong>{fmtCurrency(parseInt(form.quantity) * parseFloat(form.rate))}</strong>
                </div>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Record Stock In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
