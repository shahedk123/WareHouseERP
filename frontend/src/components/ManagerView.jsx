import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

export default function ManagerView({ t, isRtl, isMobile }) {
  const [metrics, setMetrics] = useState(null);
  const [pingedBills, setPingedBills] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/api/metrics`);
        setMetrics(r.data);
      } catch {}
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const navH = isMobile ? 50 : 54;

  if (!metrics) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: `calc(100dvh - ${navH}px)`, flexDirection: 'column', gap: 12, color: 'var(--t3)' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: 36, height: 36, border: '3px solid var(--bl3)', borderTopColor: 'var(--bl)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13 }}>{t('loadingMetrics')}</div>
      </div>
    );
  }

  const maxThroughput = Math.max(...(metrics.throughput_by_hour || []).map(h => h.resolved), 1);
  const clearanceRate = metrics.bills_today > 0
    ? Math.round((metrics.resolved_today / metrics.bills_today) * 100)
    : 0;
  const avgMin = metrics.avg_resolve_minutes || 0;
  const avgDisplay = avgMin === 0
    ? '—'
    : avgMin >= 60 ? `${Math.floor(avgMin / 60)}h ${avgMin % 60}m` : `${avgMin}m`;

  return (
    <div
      style={{
        padding: 16,
        background: 'var(--bg)',
        minHeight: `calc(100dvh - ${navH}px)`,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        direction: isRtl ? 'rtl' : 'ltr',
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── 4 metrics cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {/* Bills Today */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid var(--bd)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--bl)', lineHeight: 1.1 }}>{metrics.bills_today}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginTop: 4 }}>{t('billsToday')}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{t('billsProcessedToday')}</div>
        </div>

        {/* Resolved */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid var(--bd)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gr)', lineHeight: 1.1 }}>{metrics.resolved_today}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginTop: 4 }}>{t('resolvedLabel')}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{clearanceRate}% {t('clearanceRate')}</div>
        </div>

        {/* Pending Mods */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid var(--bd)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--am)', lineHeight: 1.1 }}>{metrics.pending_total}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginTop: 4 }}>{t('pendingMods')}</div>
          <div style={{ fontSize: 10, color: metrics.stale_count > 0 ? 'var(--rd)' : 'var(--t3)', marginTop: 2 }}>
            {metrics.stale_count > 0 ? `↓ ${metrics.stale_count} ${t('staleMore2h')}` : t('allFresh')}
          </div>
        </div>

        {/* Avg Resolve Time */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid var(--bd)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pu)', lineHeight: 1.1 }}>{avgDisplay}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginTop: 4 }}>{t('avgResolveTime')}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
            {avgMin === 0 ? '—' : avgMin < 30 ? t('goodPace') : t('needsAttention')}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 14, alignItems: 'start' }}>

        {/* ── Left column ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Card 1 — Needs intervention */}
          {metrics.stale_count > 0 && (
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid var(--am3)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--am)' }}>{t('needsIntervention')}</span>
                <span style={{ background: 'var(--am3)', color: 'var(--am)', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{metrics.stale_count}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {metrics.stale_bills.map(bill => {
                  const hrs = Math.floor(bill.age_minutes / 60);
                  const mins = bill.age_minutes % 60;
                  const initials = (bill.customer_name || bill.bill_number).slice(0, 2).toUpperCase();
                  const isPinged = pingedBills.has(bill.bill_number);
                  return (
                    <div key={bill.bill_number} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--am)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bill.customer_name || bill.bill_number}</div>
                        <div style={{ fontSize: 10, color: 'var(--t2)', fontFamily: 'monospace' }}>{bill.bill_number} · {bill.mod_count} mods · {t('submittedTime')}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--rd)', fontFamily: 'monospace', flexShrink: 0 }}>{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}</div>
                      <button
                        onClick={() => setPingedBills(prev => new Set([...prev, bill.bill_number]))}
                        style={{ background: isPinged ? 'var(--gr3)' : 'var(--bl2)', border: `1px solid ${isPinged ? 'var(--gr3)' : 'var(--bl3)'}`, borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 700, color: isPinged ? 'var(--gr)' : 'var(--bl)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        {isPinged ? t('pinged') : t('pingAccountant')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card 2 — Throughput bar chart */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--bd)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--t1)' }}>{t('throughputByHour')}</span>
            </div>
            {!metrics.throughput_by_hour?.length ? (
              <div style={{ fontSize: 13, color: 'var(--t3)', textAlign: 'center', padding: '12px 0' }}>{t('noResolvedToday')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {metrics.throughput_by_hour.map(({ hour, resolved }) => {
                  const pct = (resolved / maxThroughput) * 100;
                  const barColor = resolved <= 2 ? 'var(--rd)' : pct < 60 ? 'var(--am)' : 'var(--bl)';
                  return (
                    <div key={hour} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 36, fontSize: 10, fontFamily: 'monospace', color: 'var(--t3)', flexShrink: 0, textAlign: 'right' }}>{hour}:00</div>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--t5)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: 18, fontSize: 10, fontFamily: 'monospace', color: 'var(--t2)', textAlign: 'right', flexShrink: 0 }}>{resolved}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Card 3 — Accountant queue depth */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--bd)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>👤</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--t1)' }}>{t('accountantQueueDepth')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Accountant</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{metrics.resolved_today} {t('clearedToday')}</div>
              </div>
              <div style={{
                background: metrics.pending_total <= 5 ? 'var(--gr3)' : metrics.pending_total <= 10 ? 'var(--am3)' : 'var(--rd3)',
                color: metrics.pending_total <= 5 ? 'var(--gr)' : metrics.pending_total <= 10 ? 'var(--am)' : 'var(--rd)',
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 16,
                fontWeight: 800
              }}>
                {metrics.pending_total > 10 ? '⚠ ' : ''}{metrics.pending_total}
              </div>
            </div>
          </div>

          {/* Card 4 — Picker activity today */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--bd)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>👷</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--t1)' }}>{t('pickerActivityToday')}</span>
            </div>
            {!metrics.picker_activity?.length ? (
              <div style={{ fontSize: 13, color: 'var(--t3)', textAlign: 'center', padding: '8px 0' }}>{t('noPickersActive')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {metrics.picker_activity.map((p, idx) => {
                  const avatarColors = ['var(--bl)', 'var(--gr)', 'var(--pu)'];
                  const avatarBg = avatarColors[idx % 3];
                  const initials = p.picker_name.slice(0, 2).toUpperCase();
                  const maxSubmitted = Math.max(...metrics.picker_activity.map(x => x.submitted), 1);
                  return (
                    <div key={p.picker_name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarBg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.picker_name}</div>
                        <div style={{ width: 60, height: 4, background: 'var(--t4)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
                          <div style={{ width: `${(p.submitted / maxSubmitted) * 100}%`, height: '100%', background: 'var(--bl)', borderRadius: 2 }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>{p.submitted}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 5 — System alerts */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--bd)', padding: '14px 16px', boxShadow: 'var(--sh)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--t1)' }}>{t('systemAlerts')}</span>
            </div>
            {metrics.pending_total <= 10 && metrics.stale_count === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--gr)', fontWeight: 700 }}>{t('allSystemsNormal')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {metrics.stale_count > 0 && (
                  <div style={{ background: 'var(--am2)', border: '1px solid var(--am3)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--am)' }}>{t('staleMods')}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{metrics.stale_count} {t('staleDetail')}</div>
                  </div>
                )}
                {metrics.pending_total > 10 && (
                  <div style={{ background: 'var(--rd2)', border: '1px solid var(--rd3)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--rd)' }}>{t('highQueueDepth')}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{metrics.pending_total} {t('pendingModifications')}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
