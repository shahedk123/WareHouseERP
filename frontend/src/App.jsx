import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Auth
import LoginPage from './pages/Login.jsx';

// Layout
import AppLayout from './layouts/AppLayout.jsx';

// ERP pages
import DashboardPage from './pages/Dashboard.jsx';
import ProductListPage from './pages/products/ProductList.jsx';
import PartyListPage from './pages/parties/PartyList.jsx';
import InvoiceListPage from './pages/invoices/InvoiceList.jsx';
import InvoiceCreatePage from './pages/invoices/InvoiceCreate.jsx';
import StockInPage from './pages/stock/StockIn.jsx';
import GSTSummaryPage from './pages/tax/GSTSummary.jsx';
import StockSummaryPage from './pages/reports/StockSummary.jsx';

// WhatsApp queue (legacy)
import QueuePage from './pages/QueuePage.jsx';

// Protected route wrapper
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F9FAFB',
        fontSize: 14,
        color: '#6B7280'
      }}>
        Loading…
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function AppRoot() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected ERP routes — wrapped in AppLayout sidebar */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="parties" element={<PartyListPage />} />
          <Route path="invoices" element={<InvoiceListPage />} />
          <Route path="invoices/create" element={<InvoiceCreatePage />} />
          <Route path="stock/in" element={<StockInPage />} />
          <Route path="tax/gst" element={<GSTSummaryPage />} />
          <Route path="reports/stock" element={<StockSummaryPage />} />
          <Route path="queue" element={<QueuePage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
