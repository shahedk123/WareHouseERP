import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NAV_ITEMS = [
  { path: '/dashboard', label: '📊 Dashboard', roles: ['admin', 'manager', 'accountant'] },
  { path: '/products', label: '📦 Products', roles: ['admin', 'manager', 'accountant'] },
  { path: '/parties', label: '👥 Parties', roles: ['admin', 'manager', 'accountant'] },
  { path: '/stock/in', label: '📥 Stock In', roles: ['admin', 'manager', 'accountant'] },
  { path: '/invoices', label: '📄 Invoices', roles: ['admin', 'manager', 'accountant'] },
  { path: '/invoices/create', label: '✏️ New Invoice', roles: ['admin', 'manager', 'accountant'] },
  { path: '/tax/gst', label: '🏛️ GST Summary', roles: ['admin', 'manager', 'accountant'] },
  { path: '/reports/stock', label: '📈 Reports', roles: ['admin', 'manager', 'accountant'] },
  { path: '/queue', label: '📱 WhatsApp Queue', roles: ['admin', 'manager', 'accountant', 'picker'] },
];

export default function AppLayout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!user) return children;

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? '260px' : '60px',
          background: '#1F2937',
          color: 'white',
          padding: '20px 0',
          transition: 'width 0.3s',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                WarehouseOS
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                ERP + WhatsApp
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              padding: '4px 6px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              minHeight: '28px',
            }}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        {/* Nav Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  padding: sidebarOpen ? '12px 16px' : '12px',
                  color: isActive ? '#3B82F6' : 'rgba(255,255,255,0.7)',
                  background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                  textDecoration: 'none',
                  borderLeft: isActive ? '3px solid #3B82F6' : '3px solid transparent',
                  transition: 'all 0.15s',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sidebarOpen ? item.label : item.label.charAt(0)}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, padding: '0 16px' }}>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: sidebarOpen ? '12px 16px' : '12px',
              background: 'rgba(239,68,68,0.1)',
              color: '#FCA5A5',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
            }}
          >
            {sidebarOpen ? '🚪 Logout' : '🚪'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
