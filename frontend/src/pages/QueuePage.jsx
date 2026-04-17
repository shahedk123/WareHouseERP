import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import BillCard from '../components/BillCard';
import PhotoModal from '../components/PhotoModal';
import { useRealtime } from '../hooks/useRealtime';

const API = import.meta.env.VITE_API_URL || '';

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function QueuePage() {
  const [pending, setPending] = useState([]);
  const [done, setDone] = useState([]);
  const [tab, setTab] = useState('pending');
  const [filter, setFilter] = useState('all');
  const [modalBill, setModalBill] = useState(null);
  const [myName, setMyName] = useState(() => localStorage.getItem('wv-name') || '');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifPerm, setNotifPerm] = useState(Notification.permission);

  // Load accountant users for selector
  useEffect(() => {
    axios.get(`${API}/api/users`)
      .then(r => setUsers(r.data.filter(u => u.role === 'accountant' || u.role === 'manager')))
      .catch(() => {});
  }, []);

  // Load pending bills
  const fetchPending = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/bills?state=pending&state=claimed`);
      setPending(r.data.bills || []);
    } catch (e) { console.error(e); }
  }, []);

  // Load done today
  const fetchDone = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/bills?state=done`);
      setDone(r.data.bills || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    Promise.all([fetchPending(), fetchDone()]).finally(() => setLoading(false));
  }, [fetchPending, fetchDone]);

  // Tab title count
  useEffect(() => {
    document.title = pending.length > 0 ? `(${pending.length}) Queue` : 'Queue';
    return () => { document.title = 'WarehouseVoice'; };
  }, [pending.length]);

  // Realtime
  useRealtime(
    (newRow) => {
      // New bill
      setPending(prev => {
        if (prev.find(b => b.id === newRow.id)) return prev;
        // Browser notification if unfocused
        if (document.hidden && notifPerm === 'granted') {
          new Notification(`New bill #${newRow.ref_number} — ${newRow.picker_name}`);
        }
        return [...prev, newRow].sort((a, b) =>
          new Date(a.submitted_at) - new Date(b.submitted_at));
      });
    },
    (updated) => {
      if (updated.state === 'done') {
        setPending(prev => prev.filter(b => b.id !== updated.id));
        setDone(prev => [updated, ...prev]);
      } else {
        setPending(prev => prev.map(b => b.id === updated.id ? updated : b));
      }
    },
    (old) => {
      setPending(prev => prev.filter(b => b.id !== old.id));
    }
  );

  const handleSelectName = (name) => {
    setMyName(name);
    localStorage.setItem('wv-name', name);
  };

  const myUser = users.find(u => u.name === myName);

  const handleClaim = async (bill) => {
    try {
      const r = await axios.patch(`${API}/api/bills/${bill.ref_number}/claim`, {
        accountant_wa: myUser?.wa_number || null,
        accountant_name: myName
      });
      setPending(prev => prev.map(b => b.id === r.data.bill.id ? r.data.bill : b));
    } catch (e) { alert('Failed to claim. Try again.'); }
  };

  const handleDone = async (bill) => {
    try {
      await axios.patch(`${API}/api/bills/${bill.ref_number}/done`, {
        accountant_wa: myUser?.wa_number || null,
        accountant_name: myName
      });
      setPending(prev => prev.filter(b => b.id !== bill.id));
      fetchDone();
    } catch (e) { alert('Failed to mark done. Try again.'); }
  };

  const handleSkip = async (bill) => {
    try {
      const r = await axios.patch(`${API}/api/bills/${bill.ref_number}/skip`, {
        accountant_wa: myUser?.wa_number || null
      });
      // Move to bottom
      setPending(prev => {
        const rest = prev.filter(b => b.id !== bill.id);
        return [...rest, r.data.bill];
      });
    } catch (e) { alert('Failed to skip. Try again.'); }
  };

  const requestNotif = async () => {
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  // Filter pending bills
  const filteredPending = pending.filter(b => {
    if (filter === 'unclaimed') return b.state === 'pending';
    if (filter === 'mine') return b.claimed_by_name === myName;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{
        background: 'white', borderBottom: '1px solid #E2E8F0',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#2563EB' }}>WarehouseVoice</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Live dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#16A34A',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>Live</span>
          </div>
          {/* Notification permission */}
          {notifPerm === 'default' && (
            <button
              onClick={requestNotif}
              style={{
                background: '#EFF4FF', border: '1px solid #DBEAFE', borderRadius: 8,
                padding: '5px 10px', fontSize: 11, color: '#2563EB', cursor: 'pointer'
              }}
            >
              🔔 Enable alerts
            </button>
          )}
          {/* Name selector */}
          <select
            value={myName}
            onChange={e => handleSelectName(e.target.value)}
            style={{
              background: myName ? '#F0FDF4' : '#FEF3C7',
              border: `1px solid ${myName ? '#DCFCE7' : '#FEF3C7'}`,
              borderRadius: 8, padding: '6px 10px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            <option value="">— Select your name —</option>
            {users.map(u => (
              <option key={u.id} value={u.name}>{u.name}</option>
            ))}
          </select>
        </div>
      </header>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #E2E8F0' }}>
          {[
            { id: 'pending', label: `Pending${pending.length > 0 ? ` (${pending.length})` : ''}` },
            { id: 'done', label: `Done Today${done.length > 0 ? ` (${done.length})` : ''}` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#2563EB' : 'transparent'}`,
                marginBottom: -2, padding: '10px 16px', fontSize: 13, fontWeight: 700,
                color: tab === t.id ? '#2563EB' : '#64748B', cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Pending tab */}
        {tab === 'pending' && (
          <>
            {/* Filter row */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['all', 'unclaimed', 'mine'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    background: filter === f ? '#2563EB' : '#F1F5F9',
                    color: filter === f ? 'white' : '#475569',
                    border: 'none', borderRadius: 8, padding: '6px 14px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {f === 'all' ? 'All' : f === 'unclaimed' ? 'Unclaimed' : 'Mine'}
                </button>
              ))}
            </div>

            {loading && (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: 40 }}>
                Loading queue...
              </div>
            )}

            {!loading && filteredPending.length === 0 && (
              <div style={{
                textAlign: 'center', color: '#94A3B8',
                padding: 60, fontSize: 15, fontWeight: 600
              }}>
                ✅ All clear — nothing pending
              </div>
            )}

            {filteredPending.map(bill => (
              <BillCard
                key={bill.id}
                bill={bill}
                myName={myName}
                onViewPhoto={setModalBill}
                onClaim={handleClaim}
                onDone={handleDone}
                onSkip={handleSkip}
              />
            ))}
          </>
        )}

        {/* Done Today tab */}
        {tab === 'done' && (
          <>
            {done.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: 60 }}>
                No bills resolved today yet
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                      {['Ref', 'Picker', 'Submitted', 'Resolved by', 'Duration'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {done.map(b => {
                      const dur = b.resolved_at
                        ? Math.round((new Date(b.resolved_at) - new Date(b.submitted_at)) / 60000)
                        : null;
                      return (
                        <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>#{b.ref_number}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.picker_name}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtTime(b.submitted_at)}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>{b.resolved_by_name || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#16A34A', fontWeight: 700 }}>{dur !== null ? `${dur}m` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo modal */}
      {modalBill && (
        <PhotoModal
          bill={modalBill}
          myName={myName}
          onClose={() => setModalBill(null)}
          onClaim={b => { handleClaim(b); setModalBill(null); }}
          onDone={b => { handleDone(b); setModalBill(null); }}
        />
      )}
    </div>
  );
}
