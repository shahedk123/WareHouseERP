import React from 'react';

const BADGE_COLORS = {
  // Status badges
  draft: { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#DBEAFE', text: '#0C4A6E' },
  paid: { bg: '#DCFCE7', text: '#166534' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },

  // Stock status
  'in-stock': { bg: '#DCFCE7', text: '#166534' },
  'low-stock': { bg: '#FEF3C7', text: '#92400E' },
  'out-of-stock': { bg: '#FEE2E2', text: '#991B1B' },

  // Role badges
  admin: { bg: '#EDE9FE', text: '#5B21B6' },
  manager: { bg: '#DDD6FE', text: '#4338CA' },
  accountant: { bg: '#DCFCE7', text: '#166534' },
  picker: { bg: '#DBEAFE', text: '#0C4A6E' },

  // Party type
  customer: { bg: '#DBEAFE', text: '#0C4A6E' },
  supplier: { bg: '#FEF3C7', text: '#92400E' },

  // Default
  default: { bg: '#F3F4F6', text: '#374151' },
};

export const Badge = ({ children, variant = 'default', size = 'md' }) => {
  const colors = BADGE_COLORS[variant] || BADGE_COLORS.default;
  const padding = size === 'sm' ? '4px 8px' : size === 'lg' ? '8px 12px' : '6px 10px';
  const fontSize = size === 'sm' ? '12px' : size === 'lg' ? '15px' : '13px';

  return (
    <span
      style={{
        display: 'inline-block',
        padding,
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: '4px',
        fontSize,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};
