import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RoleSelect from './components/RoleSelect.jsx';
import PickerView from './components/PickerView.jsx';
import AccountantView from './components/AccountantView.jsx';
import ManagerView from './components/ManagerView.jsx';
import QueuePage from './pages/QueuePage.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import LoginPage from './pages/Login.jsx';
import ProductListPage from './pages/products/ProductList.jsx';
import InvoiceListPage from './pages/invoices/InvoiceList.jsx';
import InvoiceCreatePage from './pages/invoices/InvoiceCreate.jsx';
import StockInPage from './pages/stock/StockIn.jsx';
import GSTSummaryPage from './pages/tax/GSTSummary.jsx';
import PartyListPage from './pages/parties/PartyList.jsx';
import StockSummaryPage from './pages/reports/StockSummary.jsx';
import { useLanguage } from './useLanguage.js';

const ROLE_COLORS = { picker: '#2563EB', accountant: '#16A34A', manager: '#7C3AED' };
const ROLE_LABEL  = { picker: 'rolePicker', accountant: 'roleAccountant', manager: 'roleManager' };

function App() {
  const [role, setRole] = useState(() => localStorage.getItem('wv-role') || null);
  const { lang, setLang, t, isRtl } = useLanguage();

  // Track viewport width for responsive layout decisions
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const handle = () => setVw(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  const isMobile = vw < 768;

  const selectRole = (r) => {
    localStorage.setItem('wv-role', r);
    setRole(r);
  };

  const clearRole = () => {
    localStorage.removeItem('wv-role');
    setRole(null);
  };

  if (!role) {
    return <RoleSelect t={t} lang={lang} setLang={setLang} isRtl={isRtl} onSelect={selectRole} />;
  }

  const navColor = ROLE_COLORS[role] || '#2563EB';

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      direction: isRtl ? 'rtl' : 'ltr',
      paddingTop: 'var(--safe-top)',
      paddingBottom: 'var(--safe-bottom)'
    }}>
      {/* Navbar */}
      <nav style={{
        height: isMobile ? 50 : 54,
        background: navColor,
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 10px' : '0 14px',
        gap: isMobile ? 6 : 10,
        flexShrink: 0,
        zIndex: 100
      }}>
        {/* Logo + role label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          {/* Hide app name on very small screens to save space */}
          {!isMobile && (
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 12, letterSpacing: '-0.02em', lineHeight: 1.1 }}>WarehouseVoice</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(ROLE_LABEL[role])}</div>
            </div>
          )}
          {isMobile && (
            <div style={{ color: 'white', fontWeight: 800, fontSize: 13, letterSpacing: '-0.02em' }}>
              {t(ROLE_LABEL[role])}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Language selector */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 8,
              padding: isMobile ? '5px 22px 5px 8px' : '6px 26px 6px 10px',
              fontSize: isMobile ? 11 : 11,
              fontWeight: 600,
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
              minHeight: 34
            }}
          >
            <option value="en" style={{ color: '#0F172A', background: 'white' }}>EN</option>
            <option value="ml" style={{ color: '#0F172A', background: 'white' }}>ML</option>
            <option value="ar" style={{ color: '#0F172A', background: 'white' }}>AR</option>
          </select>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {/* Switch role button */}
        <button
          onClick={clearRole}
          title={t('switchRole')}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'white',
            borderRadius: 8,
            padding: isMobile ? '5px 8px' : '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            minHeight: 34
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          {/* Only show text on desktop */}
          {!isMobile && t('switchRole')}
        </button>
      </nav>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {role === 'picker'     && <PickerView     t={t} isRtl={isRtl} lang={lang} isMobile={isMobile} />}
        {role === 'accountant' && <AccountantView t={t} isRtl={isRtl} lang={lang} isMobile={isMobile} />}
        {role === 'manager'    && <ManagerView    t={t} isRtl={isRtl} lang={lang} isMobile={isMobile} />}
      </div>
    </div>
  );
}

export default function AppRoot() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* WhatsApp */}
        <Route path="/queue" element={<QueuePage />} />

        {/* ERP */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/invoices" element={<InvoiceListPage />} />
        <Route path="/invoices/create" element={<InvoiceCreatePage />} />
        <Route path="/stock/in" element={<StockInPage />} />
        <Route path="/tax/gst" element={<GSTSummaryPage />} />
        <Route path="/parties" element={<PartyListPage />} />
        <Route path="/reports/stock" element={<StockSummaryPage />} />

        {/* Legacy WhatsApp Views */}
        <Route path="/" element={<App />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}
