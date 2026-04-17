import React from 'react';

export const DataTable = ({ columns, data, onRowClick, loading, emptyMessage = 'No data found' }) => {
  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
        Loading...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: '#374151',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                borderBottom: '1px solid #F3F4F6',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (onRowClick) e.currentTarget.style.backgroundColor = '#F9FAFB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {columns.map((col) => (
                <td
                  key={`${rowIdx}-${col.key}`}
                  style={{
                    padding: '12px 16px',
                    color: '#111827',
                  }}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
