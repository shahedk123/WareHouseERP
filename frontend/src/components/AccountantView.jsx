import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function groupByDate(items, dateField) {
  const groups = new Map();
  for (const item of items) {
    const label = formatDateLabel(item[dateField]);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function groupBillsByDate(bills) {
  const groups = new Map();
  for (const bill of bills) {
    const label = formatDateLabel(bill.oldest_ts);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(bill);
  }
  return Array.from(groups.entries()).map(([label, bills]) => ({ label, bills }));
}

function deduplicateMods(mods) {
  const seen = new Set();
  const unique = [];
  let dupCount = 0;
  for (const m of mods) {
    const key = `${m.action_type}|${(m.product_hint || '').toLowerCase().trim()}|${m.quantity ?? ''}`;
    if (seen.has(key)) { dupCount++; continue; }
    seen.add(key);
    unique.push(m);
  }
  return { unique, dupCount };
}

function DateGroupHeader({ label }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '10px 4px 4px' }}>
      {label}
    </div>
  );
}

// ── Bill card (list item, no expanded rows) ─────────────────────────────────
function BillCard({ bill, isSelected, onSelect, t }) {
  const { unique: mods, dupCount } = deduplicateMods(bill.modifications);
  const pendingCount = mods.filter(m => !m.resolved && !m.rejected).length;
  const allDone = pendingCount === 0;
  const stale = !allDone && mods.some(
    m => !m.resolved && !m.rejected && (Date.now() - new Date(m.created_at)) > 2 * 60 * 60 * 1000
  );
  const pickerNames = [...new Set(bill.modifications.map(m => m.picker_name).filter(Boolean))].join(', ');

  return (
    <div
      onClick={() => onSelect(bill)}
      style={{
        borderRadius: 12,
        border: `1px solid ${isSelected ? 'var(--bl)' : allDone ? 'var(--gr3)' : stale ? 'var(--am3)' : 'var(--bd)'}`,
        background: isSelected ? 'var(--bl2)' : 'white',
        boxShadow: isSelected ? '0 0 0 2px var(--bl3)' : 'var(--sh)',
        padding: '11px 13px',
        marginBottom: 7,
        cursor: 'pointer',
        transition: 'all 0.13s'
      }}
      onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'var(--card2)')}
      onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'white')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, color: isSelected ? 'var(--bl)' : 'var(--t3)' }}>
          {bill.bill_number}
        </span>
        <span style={{
          background: allDone ? 'var(--gr3)' : stale ? 'var(--am3)' : 'var(--card3)',
          color: allDone ? 'var(--gr)' : stale ? 'var(--am)' : 'var(--t3)',
          padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700
        }}>
          {allDone ? `✓ ${t('done')}` : stale ? `⚠ ${pendingCount} ${t('left')}` : `${pendingCount} ${t('left')}`}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 1 }}>{bill.customer_name}</div>
      {bill.customer_sub && <div style={{ fontSize: 10, color: 'var(--t2)' }}>{bill.customer_sub}</div>}
      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4, display: 'flex', gap: 6 }}>
        <span>{mods.length} {t('mods')}</span>
        {dupCount > 0 && <span style={{ color: 'var(--am)' }}>· {dupCount} dup</span>}
        <span>· {pickerNames || t('unknownPicker')}</span>
      </div>
    </div>
  );
}

// ── Other match popup ────────────────────────────────────────────────────────
function OtherMatchPopup({ mod, currentCode, onSelect, onClose }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/api/catalog?q=${encodeURIComponent(mod.product_hint || '')}`)
      .then(r => setResults((r.data || []).filter(p => p.code !== currentCode).slice(0, 8)))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [mod.id]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', background: 'var(--bl2)', borderBottom: '1px solid var(--bl3)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--bl)', marginBottom: 2 }}>Other Matches</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>"{mod.product_hint}"</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--t3)', padding: '0 4px', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '10px 10px', maxHeight: 360, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: 12 }}>Searching...</div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: 12 }}>No alternatives found</div>
          ) : results.map(p => (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              style={{ display: 'flex', alignItems: 'center', padding: '9px 10px', borderRadius: 8, marginBottom: 5, cursor: 'pointer', border: '1px solid var(--bd)', background: 'white', transition: 'all 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bl2)', e.currentTarget.style.borderColor = 'var(--bl3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white', e.currentTarget.style.borderColor = 'var(--bd)')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{p.name_en}</div>
                {p.name_ml && <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'Noto Sans Malayalam, sans-serif' }}>{p.name_ml}</div>}
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{p.category}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--t2)', fontWeight: 600, background: 'var(--card2)', padding: '1px 5px', borderRadius: 4 }}>{p.code}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bl)', marginTop: 3 }}>{p.unit}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Bill detail table ────────────────────────────────────────────────────────
function BillDetailTable({ bill, onModResolved, onModRejected, t, isMobile, onBack }) {
  const { unique: mods, dupCount } = deduplicateMods(bill.modifications);
  const [productDetails, setProductDetails] = useState({}); // code → product
  const [overrides, setOverrides] = useState({});           // mod.id → product
  const [otherMatchMod, setOtherMatchMod] = useState(null);
  const [acting, setActing] = useState(false);

  const pendingMods = mods.filter(m => !m.resolved && !m.rejected);
  const doneCount = mods.filter(m => m.resolved).length;

  // Fetch catalog details for all NLU-suggested codes
  useEffect(() => {
    setOverrides({});
    const codes = [...new Set(mods.map(m => m.nlu_product_code).filter(Boolean))];
    if (!codes.length) return;
    Promise.all(
      codes.map(code =>
        axios.get(`${API}/api/catalog?q=${encodeURIComponent(code)}`)
          .then(r => ({ code, product: r.data?.[0] || null }))
          .catch(() => ({ code, product: null }))
      )
    ).then(results => {
      const map = {};
      results.forEach(({ code, product }) => { if (product) map[code] = product; });
      setProductDetails(map);
    });
  }, [bill.bill_number]);

  const getProduct = (mod) =>
    overrides[mod.id] || (mod.nlu_product_code ? productDetails[mod.nlu_product_code] : null);

  const resolvePayload = (mod) => {
    const p = getProduct(mod);
    return {
      product_name: p?.name_en || null,
      product_code: p?.code || mod.nlu_product_code || null,
      product_unit: p?.unit || null,
      resolved_by: 'Accountant'
    };
  };

  const handleResolveAll = async () => {
    if (acting) return;
    setActing(true);
    for (const mod of pendingMods) {
      try {
        await axios.patch(`${API}/api/modifications/${mod.id}/resolve`, resolvePayload(mod));
        onModResolved(mod.id);
      } catch {}
    }
    setActing(false);
  };

  const handleRejectAll = async () => {
    if (acting) return;
    setActing(true);
    for (const mod of pendingMods) {
      try {
        await axios.patch(`${API}/api/modifications/${mod.id}/reject`, { rejected_by: 'Accountant' });
        onModRejected(mod.id);
      } catch {}
    }
    setActing(false);
  };

  const COL = isMobile
    ? '1fr 64px 36px 52px 76px'
    : '1fr 90px 48px 66px 90px';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg)' }}>
      {/* Mobile back */}
      {isMobile && onBack && (
        <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', background: 'white', borderBottom: '1px solid var(--bd)', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bl)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--bl)' }}>{t('bills')}</span>
        </div>
      )}

      {/* Bill header */}
      <div style={{ padding: '14px 18px 12px', background: 'white', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>{bill.bill_number}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.02em' }}>{bill.customer_name}</div>
        {bill.customer_sub && <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 1 }}>{bill.customer_sub}</div>}
        {dupCount > 0 && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--am)', fontWeight: 600 }}>⚠ {dupCount} duplicate recording{dupCount > 1 ? 's' : ''} hidden</div>
        )}
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1, height: 4, background: 'var(--t4)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--gr)', borderRadius: 2, width: `${mods.length ? (doneCount / mods.length) * 100 : 0}%`, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, flexShrink: 0 }}>{doneCount}/{mods.length} {t('verified')}</span>
        </div>
      </div>

      {/* Bill photo */}
      {bill.photo_url && (
        <div style={{ padding: '10px 12px 0' }}>
          <img src={bill.photo_url} alt="bill" style={{ width: '100%', maxHeight: 110, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--card2)', display: 'block' }} />
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--bd)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>

          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: COL, background: 'var(--card2)', borderBottom: '2px solid var(--bd)' }}>
            {['Product', 'Code', 'Qty', 'Unit', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', padding: '8px 10px', textAlign: i >= 2 ? 'center' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {mods.map((mod, idx) => {
            const product = getProduct(mod);
            const isPending = !mod.resolved && !mod.rejected;
            const actionColor = mod.action_type === 'ADD' ? 'var(--gr)' : mod.action_type === 'REMOVE' ? 'var(--rd)' : 'var(--pu)';

            return (
              <div
                key={mod.id}
                style={{
                  display: 'grid', gridTemplateColumns: COL,
                  borderBottom: idx < mods.length - 1 ? '1px solid var(--bd)' : 'none',
                  opacity: (mod.resolved || mod.rejected) ? 0.4 : 1,
                  background: mod.resolved ? 'var(--gr2)' : mod.rejected ? 'var(--rd2)' : 'white',
                  transition: 'opacity 0.2s, background 0.2s'
                }}
              >
                {/* Product name */}
                <div style={{ padding: '10px 10px', borderLeft: `3px solid ${actionColor}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.3 }}>
                    {product ? product.name_en : mod.product_hint}
                  </div>
                  {product?.name_ml && (
                    <div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'Noto Sans Malayalam, sans-serif' }}>{product.name_ml}</div>
                  )}
                  <div style={{ marginTop: 2, display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: actionColor }}>
                      {mod.action_type}
                    </span>
                    {mod.resolved && <span style={{ fontSize: 9, color: 'var(--gr)', fontWeight: 700 }}>· ✓ resolved</span>}
                    {mod.rejected && <span style={{ fontSize: 9, color: 'var(--rd)', fontWeight: 700 }}>· ✕ rejected</span>}
                    {isPending && !product && <span style={{ fontSize: 9, color: 'var(--am)', fontWeight: 600 }}>· no match</span>}
                  </div>
                </div>

                {/* Code */}
                <div style={{ padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                  {(product?.code || mod.nlu_product_code) ? (
                    <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: 'var(--t1)', background: 'var(--card2)', padding: '2px 5px', borderRadius: 4 }}>
                      {product?.code || mod.nlu_product_code}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--t4)' }}>—</span>
                  )}
                </div>

                {/* Qty */}
                <div style={{ padding: '10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--t1)' }}>
                    {mod.quantity ?? '—'}
                  </span>
                </div>

                {/* Unit */}
                <div style={{ padding: '10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: product ? 'var(--bl)' : 'var(--t4)' }}>
                    {product?.unit || '—'}
                  </span>
                </div>

                {/* Other Match */}
                <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isPending && (
                    <button
                      onClick={() => setOtherMatchMod(mod)}
                      style={{
                        fontSize: 9, fontWeight: 700, background: overrides[mod.id] ? 'var(--gr2)' : 'var(--card2)',
                        border: `1px solid ${overrides[mod.id] ? 'var(--gr3)' : 'var(--bd2)'}`,
                        borderRadius: 6, padding: '4px 7px', cursor: 'pointer',
                        color: overrides[mod.id] ? 'var(--gr)' : 'var(--t2)',
                        whiteSpace: 'nowrap', lineHeight: 1.4, textAlign: 'center'
                      }}
                    >
                      {overrides[mod.id] ? '✓ Changed' : 'Other\nMatch'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      {pendingMods.length > 0 && (
        <div style={{ padding: '12px 14px', background: 'white', borderTop: '1px solid var(--bd)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={handleResolveAll}
            disabled={acting}
            style={{ flex: 2, padding: 14, background: 'var(--gr)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.6 : 1 }}
          >
            ✓ {t('resolveAll')} ({pendingMods.length})
          </button>
          <button
            onClick={handleRejectAll}
            disabled={acting}
            style={{ flex: 1, padding: 14, background: 'var(--rd2)', color: 'var(--rd)', border: '1px solid var(--rd3)', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.6 : 1 }}
          >
            ✕ {t('rejectAll')}
          </button>
        </div>
      )}

      {/* Other match popup */}
      {otherMatchMod && (
        <OtherMatchPopup
          mod={otherMatchMod}
          currentCode={getProduct(otherMatchMod)?.code || otherMatchMod.nlu_product_code}
          onSelect={product => {
            setOverrides(prev => ({ ...prev, [otherMatchMod.id]: product }));
            setOtherMatchMod(null);
          }}
          onClose={() => setOtherMatchMod(null)}
        />
      )}
    </div>
  );
}

// ── Main AccountantView ──────────────────────────────────────────────────────
export default function AccountantView({ t, isRtl, lang, isMobile }) {
  const [bills, setBills] = useState([]);
  const [resolvedMods, setResolvedMods] = useState([]);
  const [rejectedMods, setRejectedMods] = useState([]);
  const [tab, setTab] = useState('pending');
  const [selectedBill, setSelectedBill] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const csvInputRef = useRef(null);

  const fetchPending = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/modifications`);
      setBills(r.data.bills || []);
    } catch {}
  }, []);

  const fetchResolved = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/modifications/resolved`);
      setResolvedMods(r.data.modifications || []);
    } catch {}
  }, []);

  const fetchRejected = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/modifications/rejected`);
      setRejectedMods(r.data.modifications || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPending();
    const id = setInterval(fetchPending, 5000);
    const handleVisibility = () => { if (!document.hidden) fetchPending(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [fetchPending]);

  useEffect(() => {
    if (tab === 'resolved') fetchResolved();
    if (tab === 'rejected') fetchRejected();
  }, [tab, fetchResolved, fetchRejected]);

  // Keep selectedBill in sync when bills data refreshes
  useEffect(() => {
    if (!selectedBill) return;
    const updated = bills.find(b => b.bill_number === selectedBill.bill_number);
    if (updated) setSelectedBill(updated);
  }, [bills]);

  const pendingCount = bills.reduce((sum, b) => {
    const { unique } = deduplicateMods(b.modifications);
    return sum + unique.filter(m => !m.resolved && !m.rejected).length;
  }, 0);

  const staleCount = bills.reduce((sum, b) => {
    const { unique } = deduplicateMods(b.modifications);
    return sum + unique.filter(m => !m.resolved && !m.rejected && (Date.now() - new Date(m.created_at)) > 2 * 60 * 60 * 1000).length;
  }, 0);

  const handleModResolved = (modId) => {
    setBills(prev => prev.map(b => ({
      ...b,
      modifications: b.modifications.map(m => m.id === modId ? { ...m, resolved: true } : m)
    })));
    fetchPending();
  };

  const handleModRejected = (modId) => {
    setBills(prev => prev.map(b => ({
      ...b,
      modifications: b.modifications.map(m => m.id === modId ? { ...m, rejected: true } : m)
    })));
    fetchPending();
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    setCsvResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${API}/api/catalog/upload`, fd);
      setCsvResult({ count: r.data.inserted, error: null });
    } catch {
      setCsvResult({ count: 0, error: true });
    } finally {
      setCsvUploading(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const billDateGroups = groupBillsByDate(bills);
  const resolvedDateGroups = groupByDate(resolvedMods, 'resolved_at');
  const rejectedDateGroups = groupByDate(rejectedMods, 'rejected_at');

  const navH = isMobile ? 50 : 54;
  const showList   = !isMobile || !selectedBill;
  const showDetail = !isMobile || !!selectedBill;

  return (
    <div style={{ display: 'flex', height: `calc(100dvh - ${navH}px)`, overflow: 'hidden', direction: isRtl ? 'rtl' : 'ltr' }}>

      {/* ── Sidebar / Bill list ── */}
      <div style={{ width: isMobile ? '100%' : 290, flexShrink: 0, borderRight: isMobile ? 'none' : '1px solid var(--bd)', background: 'white', display: showList ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '10px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>{t('bills')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gr)', animation: 'live-pulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 10, color: 'var(--gr)', fontWeight: 700 }}>{t('live')}</span>
            </div>
            <button
              onClick={() => setShowCsvUpload(v => !v)}
              title="Catalog upload"
              style={{ background: showCsvUpload ? 'var(--bl2)' : 'transparent', border: `1px solid ${showCsvUpload ? 'var(--bl3)' : 'transparent'}`, borderRadius: 6, padding: '3px 5px', cursor: 'pointer', color: showCsvUpload ? 'var(--bl)' : 'var(--t4)', display: 'flex', alignItems: 'center' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '8px 12px', gap: 4 }}>
          {['pending', 'resolved', 'rejected'].map(tabId => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, border: 'none',
                background: tab === tabId
                  ? tabId === 'rejected' ? 'var(--rd2)' : 'var(--bl2)'
                  : 'transparent',
                color: tab === tabId
                  ? tabId === 'rejected' ? 'var(--rd)' : 'var(--bl)'
                  : 'var(--t3)',
                cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}
            >
              {tabId === 'pending' ? t('pending') : tabId === 'resolved' ? t('resolved') : t('rejectedTab')}
              {tabId === 'pending' && pendingCount > 0 && (
                <span style={{ background: 'var(--am3)', color: 'var(--am)', borderRadius: 99, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* CSV upload (gear-gated) */}
        {showCsvUpload && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
            <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={csvUploading}
              style={{ width: '100%', padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, background: csvUploading ? 'var(--card2)' : 'var(--bl2)', color: csvUploading ? 'var(--t3)' : 'var(--bl)', border: '1px solid var(--bl3)', cursor: csvUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {csvUploading ? t('uploadingCsv') : t('uploadCatalogCsv')}
            </button>
            {csvResult && (
              <div style={{ marginTop: 5, fontSize: 10, fontWeight: 600, textAlign: 'center', color: csvResult.error ? 'var(--rd)' : 'var(--gr)' }}>
                {csvResult.error ? t('uploadFailed') : `✓ ${csvResult.count} ${t('catalogUpdated')}`}
              </div>
            )}
            <div style={{ marginTop: 4, fontSize: 9, color: 'var(--t4)', textAlign: 'center', lineHeight: 1.4 }}>{t('csvFormat')}</div>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {tab === 'pending' && (
            <>
              {staleCount > 0 && (
                <div style={{ padding: '9px 12px', background: 'var(--am2)', border: '1px solid var(--am3)', borderRadius: 8, fontSize: 11, color: 'var(--am)', fontWeight: 700, marginBottom: 8 }}>
                  ⚠ {staleCount} {t('staleAlert')}
                </div>
              )}
              {bills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--t3)' }}>{t('noPendingBills')}</div>
              ) : (
                billDateGroups.map(({ label, bills: dateBills }) => (
                  <div key={label}>
                    <DateGroupHeader label={label} />
                    {dateBills.map(bill => (
                      <BillCard
                        key={bill.bill_number}
                        bill={bill}
                        isSelected={selectedBill?.bill_number === bill.bill_number}
                        onSelect={setSelectedBill}
                        t={t}
                      />
                    ))}
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'resolved' && (
            <>
              {resolvedMods.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--t3)' }}>{t('noResolvedItems')}</div>
              ) : (
                resolvedDateGroups.map(({ label, items }) => (
                  <div key={label}>
                    <DateGroupHeader label={label} />
                    {items.map(m => (
                      <div key={m.id} style={{ background: 'white', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px', marginBottom: 6, boxShadow: 'var(--sh)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--bl)', fontWeight: 600 }}>{m.bill_number}</span>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, background: 'var(--gr3)', color: 'var(--gr)', fontWeight: 700 }}>{timeAgo(m.resolved_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{m.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{m.product_hint}</div>
                        <div style={{ fontSize: 11, color: 'var(--gr)', fontWeight: 600 }}>✓ {m.matched_product_code} · {m.matched_product_name}</div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'rejected' && (
            <>
              {rejectedMods.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--t3)' }}>{t('noRejectedItems')}</div>
              ) : (
                rejectedDateGroups.map(({ label, items }) => (
                  <div key={label}>
                    <DateGroupHeader label={label} />
                    {items.map(m => (
                      <div key={m.id} style={{ background: 'white', border: '1px solid var(--rd3)', borderRadius: 10, padding: '10px 12px', marginBottom: 6, boxShadow: 'var(--sh)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--bl)', fontWeight: 600 }}>{m.bill_number}</span>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, background: 'var(--rd3)', color: 'var(--rd)', fontWeight: 700 }}>{timeAgo(m.rejected_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{m.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{m.product_hint}</div>
                        <div style={{ fontSize: 11, color: 'var(--rd)', fontWeight: 600 }}>✕ {t('rejectedBy')}: {m.rejected_by || 'Accountant'}</div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Detail panel ── */}
      {showDetail && (
        selectedBill ? (
          <BillDetailTable
            key={selectedBill.bill_number}
            bill={selectedBill}
            onModResolved={handleModResolved}
            onModRejected={handleModRejected}
            t={t}
            isMobile={isMobile}
            onBack={isMobile ? () => setSelectedBill(null) : undefined}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
            <div style={{ fontSize: 12 }}>Select a bill to review</div>
          </div>
        )
      )}
    </div>
  );
}
