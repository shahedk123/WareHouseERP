import React, { useState } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { useParties } from '../../hooks/useParties';
import { useStock } from '../../hooks/useStock';
import { Button } from '../../components/ui/Button';
import ProductPicker from '../../components/ui/ProductPicker';
import { fmtCurrency } from '../../lib/format';

export default function StockInPage() {
  const { products, groups, categories } = useProducts();
  const { getSuppliers } = useParties();
  const { recordStockIn, loading } = useStock();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({
    quantity: '',
    rate: '',
    supplierId: '',
    refNumber: '',
  });

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setForm(prev => ({ ...prev, rate: product.purchase_rate || '' }));
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setForm(prev => ({ ...prev, rate: '' }));
  };

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedProduct || !form.quantity || !form.rate) {
      setError('Please select a product and fill quantity + rate');
      return;
    }

    try {
      await recordStockIn({
        productId: selectedProduct.id,
        quantity: parseInt(form.quantity),
        rate: parseFloat(form.rate),
        supplierId: form.supplierId || null,
        refNumber: form.refNumber,
      });

      setSuccess(`Stock recorded: ${form.quantity} × ${selectedProduct.name}`);
      setSelectedProduct(null);
      setForm({ quantity: '', rate: '', supplierId: '', refNumber: '' });
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  };

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '640px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#111827' }}>
          Stock In
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: '14px', color: '#6B7280' }}>
          Record incoming stock from suppliers
        </p>

        <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: '#FEE2E2', color: '#991B1B', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: '12px 16px', background: '#DCFCE7', color: '#166534', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
              ✅ {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Product picker */}
            <div>
              <label style={labelStyle}>Product *</label>
              {selectedProduct ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  border: '2px solid #3B82F6',
                  borderRadius: '6px',
                  background: '#EFF6FF',
                }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', background: '#DBEAFE', padding: '1px 6px', borderRadius: '4px', marginRight: '8px' }}>
                      {selectedProduct.code}
                    </span>
                    <span style={{ fontWeight: 600, color: '#1D4ED8' }}>{selectedProduct.name}</span>
                    {selectedProduct.name_alt && (
                      <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '8px', direction: 'rtl' }}>
                        {selectedProduct.name_alt}
                      </span>
                    )}
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                      Current stock: <strong>{selectedProduct.current_stock} {selectedProduct.unit}</strong>
                      {' · '}Purchase rate: <strong>{fmtCurrency(selectedProduct.purchase_rate)}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearProduct}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '18px', padding: '0 4px' }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <ProductPicker
                  products={products}
                  groups={groups}
                  categories={categories}
                  onSelect={handleProductSelect}
                  placeholder="Search by name, code, or Arabic name…"
                  showStock
                  showPrice={false}
                />
              )}
            </div>

            {/* Qty + Rate */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => handleChange('quantity', e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={labelStyle}>Purchase Rate *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.rate}
                  onChange={e => handleChange('rate', e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Supplier */}
            <div>
              <label style={labelStyle}>Supplier</label>
              <select
                value={form.supplierId}
                onChange={e => handleChange('supplierId', e.target.value)}
                style={inputStyle}
              >
                <option value="">Select a supplier…</option>
                {getSuppliers().map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label style={labelStyle}>Reference Number</label>
              <input
                type="text"
                value={form.refNumber}
                onChange={e => handleChange('refNumber', e.target.value)}
                placeholder="PO-001"
                style={inputStyle}
              />
            </div>

            {/* Total preview */}
            {form.quantity && form.rate && (
              <div style={{ padding: '14px 16px', background: '#F9FAFB', borderRadius: '6px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6B7280' }}>Total Value:</span>
                  <strong style={{ color: '#111827', fontSize: '16px' }}>
                    {fmtCurrency(parseInt(form.quantity) * parseFloat(form.rate))}
                  </strong>
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
