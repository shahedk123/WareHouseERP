import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email.trim()) {
      setFormError('Email is required');
      return;
    }

    try {
      await login(email);
      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || 'Login failed');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'white',
          borderRadius: '12px',
          padding: '40px 32px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              marginBottom: '16px',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700, color: '#111827' }}>
            WarehouseOS
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            ERP + WhatsApp Integration
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@warehouse.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#D1D5DB';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {(formError || error) && (
            <div
              style={{
                padding: '12px 16px',
                background: '#FEE2E2',
                color: '#991B1B',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              {formError || error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#9CA3AF' }}>
          Demo: Use any registered email address
        </div>
      </div>
    </div>
  );
}
