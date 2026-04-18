/**
 * ProductPicker
 *
 * Hierarchical product selector used in invoices, stock-in, stock-out, etc.
 *
 * Flow: [Group dropdown] → [Category dropdown] → [Search input] → [Results list]
 *
 * Props:
 *   products   - full product list from useProducts()
 *   groups     - group list from useProducts()
 *   categories - category list from useProducts()
 *   onSelect(product) - called when user picks a product
 *   placeholder - text shown before selection
 *   showStock  - whether to show stock in results (default true)
 *   showPrice  - whether to show price in results (default true)
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';

export default function ProductPicker({
  products = [],
  groups = [],
  categories = [],
  onSelect,
  placeholder = 'Search or filter products…',
  showStock = true,
  showPrice = true,
}) {
  const [groupId, setGroupId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // When group changes, reset category
  const handleGroupChange = (val) => {
    setGroupId(val);
    setCategoryId('');
    setOpen(true);
  };

  // Categories filtered to selected group
  const visibleCategories = useMemo(() =>
    groupId ? categories.filter(c => c.group_id === groupId) : categories,
    [categories, groupId]
  );

  // Products filtered by group + category + search
  const filtered = useMemo(() => {
    let list = products;
    if (groupId)    list = list.filter(p => p.group_id === groupId);
    if (categoryId) list = list.filter(p => p.category_id === categoryId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.name_alt && p.name_alt.toLowerCase().includes(q))
      );
    }
    return list.slice(0, 80); // cap at 80 results for performance
  }, [products, groupId, categoryId, search]);

  const handleSelect = (product) => {
    onSelect(product);
    setSearch('');
    setOpen(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
    background: 'white',
  };

  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Row 1: Group + Category filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <select
          value={groupId}
          onChange={e => handleGroupChange(e.target.value)}
          style={{ ...selectStyle, flex: 1 }}
        >
          <option value="">All Groups</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setOpen(true); }}
          style={{ ...selectStyle, flex: 1 }}
          disabled={visibleCategories.length === 0}
        >
          <option value="">All Categories</option>
          {visibleCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Row 2: Search input */}
      <input
        type="text"
        value={search}
        placeholder={placeholder}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={{
          ...inputStyle,
          borderColor: open ? '#3B82F6' : '#D1D5DB',
          boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
          outline: 'none',
        }}
      />

      {/* Results dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'white',
          border: '1px solid #D1D5DB',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
          maxHeight: '320px',
          overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
              No products found
            </div>
          ) : (
            <>
              <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9CA3AF', borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
                {filtered.length} product{filtered.length !== 1 ? 's' : ''}{filtered.length === 80 ? ' (showing first 80)' : ''}
              </div>
              {filtered.map(p => (
                <button
                  key={p.id}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: 'none',
                    borderBottom: '1px solid #F9FAFB',
                    background: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    gap: '8px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {/* Left: code + name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', background: '#F3F4F6', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                        {p.code}
                      </span>
                      <span style={{ fontSize: '14px', color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                    </div>
                    {p.name_alt && (
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px', direction: 'rtl', textAlign: 'right' }}>
                        {p.name_alt}
                      </div>
                    )}
                  </div>

                  {/* Right: stock + price */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {showStock && (
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: p.current_stock > 0 ? '#166534' : '#991B1B',
                        background: p.current_stock > 0 ? '#DCFCE7' : '#FEE2E2',
                        padding: '2px 8px',
                        borderRadius: '12px',
                      }}>
                        {p.current_stock} {p.unit}
                      </span>
                    )}
                    {showPrice && (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D4ED8', minWidth: '60px', textAlign: 'right' }}>
                        {p.selling_rate != null ? `${Number(p.selling_rate).toFixed(2)}` : '—'}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
