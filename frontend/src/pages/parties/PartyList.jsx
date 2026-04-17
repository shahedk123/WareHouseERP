import React, { useState } from 'react';
import { useParties } from '../../hooks/useParties';
import { DataTable } from '../../components/ui/DataTable';
import { SearchInput } from '../../components/ui/SearchInput';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { fmtPhone, fmtCurrency } from '../../lib/format';
import PartyForm from './PartyForm';

export default function PartyListPage() {
  const { parties, fetchParties } = useParties();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);

  const filteredParties = parties.filter(p =>
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)) &&
    (typeFilter === '' || p.type === typeFilter || (p.type === 'both' && typeFilter))
  );

  const handleEdit = (party) => {
    setEditingParty(party);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingParty(null);
    fetchParties();
  };

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'phone',
      label: 'Phone',
      render: (value) => fmtPhone(value),
    },
    {
      key: 'type',
      label: 'Type',
      render: (value) => (
        <Badge variant={value === 'customer' ? 'customer' : 'supplier'}>
          {value?.charAt(0).toUpperCase() + value?.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (value) => fmtCurrency(value),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 700, color: '#111827' }}>
            Parties
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            Manage customers and suppliers
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditingParty(null);
            setIsFormOpen(true);
          }}
        >
          + Add Party
        </Button>
      </div>

      {/* Search & Filter */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search parties..."
            onClear={() => setSearchTerm('')}
          />
        </div>
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
          <option value="customer">Customers</option>
          <option value="supplier">Suppliers</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
        <DataTable
          columns={columns}
          data={filteredParties}
          emptyMessage="No parties found"
          onRowClick={handleEdit}
        />
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        title={editingParty ? 'Edit Party' : 'New Party'}
        size="md"
      >
        <PartyForm
          party={editingParty}
          onSuccess={handleFormClose}
          onCancel={handleFormClose}
        />
      </Modal>
    </div>
  );
}
