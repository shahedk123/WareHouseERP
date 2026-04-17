import React from 'react';

const roles = [
  {
    id: 'picker',
    color: 'var(--bl)', colorLight: 'var(--bl2)', colorBorder: 'var(--bl3)',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    )
  },
  {
    id: 'accountant',
    color: 'var(--gr)', colorLight: 'var(--gr2)', colorBorder: 'var(--gr3)',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    )
  },
  {
    id: 'manager',
    color: 'var(--pu)', colorLight: 'var(--pu2)', colorBorder: 'var(--pu3)',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )
  }
];

const ROLE_LABEL_KEY = { picker: 'rolePicker', accountant: 'roleAccountant', manager: 'roleManager' };
const ROLE_SUB_KEY   = { picker: 'rolePickerSub', accountant: 'roleAccountantSub', manager: 'roleManagerSub' };

export default function RoleSelect({ t, lang, setLang, isRtl, onSelect }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: '24px 16px',
      direction: isRtl ? 'rtl' : 'ltr'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bl)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em' }}>WarehouseVoice</div>
        </div>
      </div>

      {/* Language selector */}
      <div style={{ position: 'relative', marginBottom: 36 }}>
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          style={{ background: 'white', color: 'var(--t1)', border: '1.5px solid var(--bd2)', borderRadius: 10, padding: '9px 32px 9px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', boxShadow: 'var(--sh)' }}
        >
          <option value="en">English</option>
          <option value="ml">മലയാളം</option>
          <option value="ar">العربية</option>
        </select>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', margin: 0, letterSpacing: '-0.03em' }}>{t('chooseRole')}</h1>
        <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 8, lineHeight: 1.6 }}>{t('chooseRoleSub')}</p>
      </div>

      {/* Role cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 420 }}>
        {roles.map(role => (
          <button
            key={role.id}
            onClick={() => onSelect(role.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: 'white', border: `2px solid var(--bd)`, borderRadius: 18,
              padding: '18px 20px', cursor: 'pointer', textAlign: isRtl ? 'right' : 'left',
              boxShadow: 'var(--sh)', transition: 'all 0.15s', width: '100%'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = role.color;
              e.currentTarget.style.boxShadow = 'var(--sh2)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--bd)';
              e.currentTarget.style.boxShadow = 'var(--sh)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          >
            <div style={{
              width: 58, height: 58, borderRadius: 16, background: role.colorLight,
              border: `1.5px solid ${role.colorBorder}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: role.color, flexShrink: 0
            }}>
              {role.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', marginBottom: 3 }}>
                {t(ROLE_LABEL_KEY[role.id])}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>
                {t(ROLE_SUB_KEY[role.id])}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transform: isRtl ? 'rotate(180deg)' : 'none' }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
