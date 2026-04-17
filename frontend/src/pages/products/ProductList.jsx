import React, { useState } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { DataTable } from '../../components/ui/DataTable';
import { SearchInput } from '../../components/ui/SearchInput';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { fmtCurrency } from '../../lib/format';
import ProductForm from './ProductForm';

export default function ProductListPage() {
  const { products, loading, fetchProducts, deleteProduct } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDelete = async (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(productId);
        alert('Product deleted successfully');
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

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    {
      key: 'current_stock',
      label: 'Stock',
      render: (value) => <strong>{value}</strong>,
    },
    {
      key: 'selling_rate',
      label: 'Rate',
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
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 700, color: '#111827' }}>
            Products
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            Manage product catalog
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditingProduct(null);
            setIsFormOpen(true);
          }}
        >
          + Add Product
        </Button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px', maxWidth: '300px' }}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search products..."
          onClear={() => setSearchTerm('')}
        />
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
