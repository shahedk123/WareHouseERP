import React from 'react';

export default function StatCard({ label, value, sub, color = '#2563EB', bg = '#EFF4FF', border = '#DBEAFE' }) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07)'
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
