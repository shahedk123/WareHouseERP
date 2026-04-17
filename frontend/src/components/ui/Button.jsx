import React from 'react';

const BUTTON_VARIANTS = {
  primary: {
    bg: '#3B82F6',
    text: 'white',
    hover: '#2563EB',
    active: '#1D4ED8',
  },
  secondary: {
    bg: '#E5E7EB',
    text: '#374151',
    hover: '#D1D5DB',
    active: '#9CA3AF',
  },
  danger: {
    bg: '#EF4444',
    text: 'white',
    hover: '#DC2626',
    active: '#B91C1C',
  },
  success: {
    bg: '#10B981',
    text: 'white',
    hover: '#059669',
    active: '#047857',
  },
};

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  type = 'button',
  loading = false,
  ...props
}) => {
  const colors = BUTTON_VARIANTS[variant];
  const padding = size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '8px 16px';
  const fontSize = size === 'sm' ? '13px' : size === 'lg' ? '16px' : '14px';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: disabled ? '#D1D5DB' : colors.bg,
        color: disabled ? '#9CA3AF' : colors.text,
        border: 'none',
        borderRadius: '6px',
        padding,
        fontSize,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        transition: 'all 0.15s',
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = colors.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = colors.bg;
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = colors.active;
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = colors.hover;
        }
      }}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
};
