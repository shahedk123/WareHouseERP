import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import StatCard from '../components/StatCard';
import PhotoModal from '../components/PhotoModal';
import { useRealtime } from '../hooks/useRealtime';

const API = import.meta.env.VITE_API_URL || '';

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtAge(ms) {
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const bar = (n, max, len = 10) => {
  const f = Math.round((n / Math.max(max, 1)) * len);
  return '█'.repeat(f) + '░'.repeat(len - f);
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [week, setWeek] = useState([]);
  const [pending, setPending] = useState([]);
  const [modalBill, setModalBill] = useState(null);
  const [pingedRefs, setPingedRefs] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, wRes, bRes] = await Promise.all([
        axios.get(`${API}/api/stats/today`),
        axios.get(`${API}/api/stats/week`),
        axios.get(`${API}/api/bills?state=pending&state=claimed`)
      ]);
      setStats(sRes.data);
      setWeek(wRes.data);
      setPending(bRes.data.bills || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Realtime updates to pending list
  useRealtime(
    (newRow) => setPending(prev =>
      prev.find(b => b.id === newRow.id) ? prev :
        [...prev, newRow].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))
    ),
    (updated) => {
      if (updated.state === 'done') {
        setPending(prev => prev.filter(b => b.id !== updated.id));
        setStats(s => s ? { ...s, done: s.done + 1, pending: Math.max(0, s.pending - 1) } : s);
      } else {
        setPending(prev => prev.map(b => b.id === updated.id ? updated : b));
      }
    },
    (old) => setPending(prev => prev.filter(b => b.id !== old.id))
  );

  const handlePing = async (ref) => {
    try {
      await axios.patch(`${API}/api/bills/${ref}/ping`);
      setPingedRefs(prev => new Set([...prev, ref]));
    } catch (e) { alert('Ping failed'); }
  };

  const stale = pending.filter(b => Date.now() - new Date(b.submitted_at) > 2 * 60 * 60 * 1000);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        <div style={{ color: '#94A3B8', fontSize: 14 }}>Loading dashboard...</div>
      </div>
    );
  }

  const clearanceRate = stats?.total > 0
    ? Math.round((stats.done / stats.total) * 100) : 0;
  const maxPicker = Math.max(...(stats?.pickers || []).map(p => p.count), 1);
  const maxAcct = Math.max(...(stats?.accountants || []).map(a => a.resolved), 1);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{
        background: 'white', borderBottom: '1px solid #E2E8F0',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#2563EB' }}>WarehouseVoice</span>
          <span style={{ marginLeft: 10, fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Manager Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>Live</span>
        </div>
      </header>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 4 metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard
            label="Bills Today"
            value={stats?.total ?? 0}
            sub="submitted today"
            color="#2563EB" bg="#EFF4FF" border="#DBEAFE"
          />
          <StatCard
            label="Done"
            value={stats?.done ?? 0}
            sub={`${clearanceRate}% clearance`}
            color="#16A34A" bg="#F0FDF4" border="#DCFCE7"
          />
          <StatCard
            label="Pending"
            value={stats?.pending ?? 0}
            sub={stale.length > 0 ? `⚠ ${stale.length} stale >2h` : 'all fresh'}
            color="#D97706" bg="#FFFBEB" border="#FEF3C7"
          />
          <StatCard
            label="Avg Time"
            value={stats?.avg_minutes ? `${stats.avg_minutes}m` : '—'}
            sub={stats?.avg_minutes ? (stats.avg_minutes < 30 ? 'good pace' : 'needs attention') : 'no data'}
            color="#7C3AED" bg="#F5F3FF" border="#EDE9FE"
          />
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Stale alerts */}
            {stale.length > 0 && (
              <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #FEF3C7', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>⚠</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>Needs intervention</span>
                  <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{stale.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stale.map(b => {
                    const ageMs = Date.now() - new Date(b.submitted_at);
                    const isPinged = pingedRefs.has(b.ref_number);
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFFBEB', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#D97706', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {b.picker_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.picker_name}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace' }}>
                            #{b.ref_number} · {b.state} · {fmtTime(b.submitted_at)}
                          </div>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: '#DC2626', flexShrink: 0 }}>
                          {fmtAge(ageMs)}
                        </span>
                        <button
                          onClick={() => !isPinged && handlePing(b.ref_number)}
                          style={{
                            background: isPinged ? '#DCFCE7' : '#EFF4FF',
                            border: `1px solid ${isPinged ? '#DCFCE7' : '#DBEAFE'}`,
                            borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 700,
                            color: isPinged ? '#16A34A' : '#2563EB',
                            cursor: isPinged ? 'default' : 'pointer', flexShrink: 0
                          }}
                        >
                          {isPinged ? '✓ Pinged' : 'Ping Accountant'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending list */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>📋 Pending Queue</div>
              {pending.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24 }}>✅ All clear</div>
              ) : (
                <div>
                  {pending.map(b => {
                    const ageMs = Date.now() - new Date(b.submitted_at);
                    const isStaleRow = ageMs > 2 * 60 * 60 * 1000;
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '9px 0', borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer'
                        }}
                        onClick={() => setModalBill(b)}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563EB', minWidth: 56 }}>#{b.ref_number}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{b.picker_name}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{fmtAge(ageMs)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 7px',
                          background: b.state === 'claimed' ? '#EDE9FE' : isStaleRow ? '#FEE2E2' : '#F1F5F9',
                          color: b.state === 'claimed' ? '#7C3AED' : isStaleRow ? '#DC2626' : '#64748B'
                        }}>
                          {b.state === 'claimed' ? `📝 ${b.claimed_by_name}` : isStaleRow ? '⚠ stale' : 'pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Picker activity */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>👷 Picker Activity</div>
              {!stats?.pickers?.length ? (
                <div style={{ color: '#94A3B8', fontSize: 13 }}>No activity today</div>
              ) : (
                <div style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre', color: '#0F172A', lineHeight: 1.9 }}>
                  {stats.pickers.map(p =>
                    `${p.name.padEnd(12)} ${bar(p.count, maxPicker)} ${p.count}`
                  ).join('\n')}
                </div>
              )}
            </div>

            {/* Accountant performance */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>👤 Accountant Performance</div>
              {!stats?.accountants?.length ? (
                <div style={{ color: '#94A3B8', fontSize: 13 }}>No resolutions today</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.accountants.map(a => (
                    <div key={a.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{a.avg_minutes}m avg</div>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#16A34A' }}>{a.resolved} done</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Week table */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>📅 This Week</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    {['Day', 'Total', 'Done', 'Avg'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 6px', color: '#94A3B8', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {week.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <td style={{ padding: '6px 6px', fontWeight: 600 }}>{fmtDate(d.date)}</td>
                      <td style={{ padding: '6px 6px', fontFamily: 'monospace' }}>{d.total}</td>
                      <td style={{ padding: '6px 6px', fontFamily: 'monospace', color: '#16A34A', fontWeight: 700 }}>{d.done}</td>
                      <td style={{ padding: '6px 6px', fontFamily: 'monospace', color: '#7C3AED' }}>{d.avg_minutes}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Photo modal (read-only) */}
      {modalBill && (
        <PhotoModal
          bill={modalBill}
          readOnly
          onClose={() => setModalBill(null)}
        />
      )}
    </div>
  );
}
