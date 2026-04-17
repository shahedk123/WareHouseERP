import React, { useState, useEffect } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { Button } from '../../components/ui/Button';

export default function ProductForm({ product, onSuccess, onCancel }) {
  const { createProduct, updateProduct } = useProducts();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    unit: 'bags',
    tax_rate: 5,
    tax_type: 'GST',
    purchase_rate: 0,
    selling_rate: 0,
    reorder_qty: 100,
  });

  useEffect(() => {
    if (product) {
      setForm({
        code: product.code || '',
        name: product.name || '',
        unit: product.unit || 'bags',
        tax_rate: product.tax_rate || 5,
        tax_type: product.tax_type || 'GST',
        purchase_rate: product.purchase_rate || 0,
        selling_rate: product.selling_rate || 0,
        reorder_qty: product.reorder_qty || 100,
      });
    }
  }, [product]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (product) {
        await updateProduct(product.id, form);
      } else {
        await createProduct(form);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error saving product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ padding: '12px 16px', background: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          Product Code *
        </label>
        <input
          type="text"
          value={form.code}
          onChange={(e) => handleChange('code', e.target.value)}
          required
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          Product Name *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          required
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            Unit
          </label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => handleChange('unit', e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            Tax Type
          </label>
          <select
            value={form.tax_type}
            onChange={(e) => handleChange('tax_type', e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
          >
            <option value="GST">GST</option>
            <option value="VAT">VAT</option>
            <option value="EXEMPT">Exempt</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            Tax Rate (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={form.tax_rate}
            onChange={(e) => handleChange('tax_rate', parseFloat(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            Reorder Qty
          </label>
          <input
            type="number"
            min="0"
            value={form.reorder_qty}
            onChange={(e) => handleChange('reorder_qty', parseInt(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            Purchase Rate (₹)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.purchase_rate}
            onChange={(e) => handleChange('purchase_rate', parseFloat(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            Selling Rate (₹) *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.selling_rate}
            onChange={(e) => handleChange('selling_rate', parseFloat(e.target.value))}
            required
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={loading}>
          {product ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
