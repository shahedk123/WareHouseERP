import React, { useState, useRef } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { DataTable } from '../../components/ui/DataTable';
import { SearchInput } from '../../components/ui/SearchInput';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { fmtCurrency } from '../../lib/format';
import ProductForm from './ProductForm';
import api from '../../lib/api';

export default function ProductListPage() {
  const { products, groups, categories, loading, fetchProducts, deleteProduct } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Import XLS state
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Categories visible for selected group
  const visibleCategories = filterGroup
    ? categories.filter(c => c.group_id === filterGroup)
    : categories;

  const filteredProducts = products.filter(p => {
    if (filterGroup && p.group_id !== filterGroup) return false;
    if (filterCategory && p.category_id !== filterCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.name_alt && p.name_alt.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDelete = async (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(productId);
      } catch (err) {
        alert('Error deleting product: ' + err.message);
      }
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    fetchProducts();
  };

  // XLS import
  const handleImportClick = () => {
    setImportResult(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-selected

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/erp/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult({ ok: true, ...res.data });
      fetchProducts(); // refresh list
    } catch (err) {
      setImportResult({ ok: false, error: err.response?.data?.error || err.message });
    } finally {
      setImporting(false);
    }
  };

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    background: 'white',
    cursor: 'pointer',
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    {
      key: 'name_alt',
      label: 'Arabic',
      render: (v) => v ? <span style={{ direction: 'rtl', fontSize: '13px', color: '#6B7280' }}>{v}</span> : null,
    },
    {
      key: 'current_stock',
      label: 'Stock',
      render: (value, row) => (
        <span style={{
          fontWeight: 700,
          color: value > 0 ? '#166534' : '#991B1B',
        }}>
          {value} {row.unit}
        </span>
      ),
    },
    {
      key: 'selling_rate',
      label: 'Sale Rate',
      render: (value) => fmtCurrency(value),
    },
    {
      key: 'tax_rate',
      label: 'Tax',
      render: (value) => `${value}%`,
    },
    {
      key: 'active',
      label: 'Status',
      render: (value) => (
        <Badge variant={value ? 'success' : 'default'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#111827' }}>
            Products
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
            {products.length} products · {groups.length} groups
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="secondary"
            onClick={handleImportClick}
            loading={importing}
          >
            {importing ? 'Importing…' : '⬆ Import XLS'}
          </Button>
          <Button
            variant="primary"
            onClick={() => { setEditingProduct(null); setIsFormOpen(true); }}
          >
            + Add Product
          </Button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          background: importResult.ok ? '#DCFCE7' : '#FEE2E2',
          color: importResult.ok ? '#166534' : '#991B1B',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {importResult.ok ? (
            <span>
              ✅ Import complete — <strong>{importResult.imported}</strong> products,{' '}
              <strong>{importResult.groups}</strong> groups,{' '}
              <strong>{importResult.categories}</strong> categories
              {importResult.errors && ` (${importResult.errors.length} errors)`}
            </span>
          ) : (
            <span>❌ Import failed: {importResult.error}</span>
          )}
          <button
            onClick={() => setImportResult(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Filters row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px', maxWidth: '280px' }}>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name, code, Arabic…"
            onClear={() => setSearchTerm('')}
          />
        </div>

        <select
          value={filterGroup}
          onChange={e => { setFilterGroup(e.target.value); setFilterCategory(''); }}
          style={{ ...inputStyle, flex: '1 1 160px', maxWidth: '200px' }}
        >
          <option value="">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 160px', maxWidth: '200px' }}
          disabled={visibleCategories.length === 0}
        >
          <option value="">All Categories</option>
          {visibleCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {(filterGroup || filterCategory || searchTerm) && (
          <button
            onClick={() => { setFilterGroup(''); setFilterCategory(''); setSearchTerm(''); }}
            style={{ fontSize: '13px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear filters
          </button>
        )}

        <span style={{ fontSize: '13px', color: '#9CA3AF', marginLeft: 'auto' }}>
          {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
        <DataTable
          columns={columns}
          data={filteredProducts}
          loading={loading}
          emptyMessage="No products found"
          onRowClick={handleEdit}
        />
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        title={editingProduct ? 'Edit Product' : 'New Product'}
        size="md"
      >
        <ProductForm
          product={editingProduct}
          onSuccess={handleFormClose}
          onCancel={handleFormClose}
        />
      </Modal>
    </div>
  );
}
