import React, { useEffect } from 'react';

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function PhotoModal({ bill, onClose, onClaim, onDone, myName, readOnly = false }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!bill) return null;

  const isMine = bill.claimed_by_name === myName;
  const isPending = bill.state === 'pending';
  const isClaimed = bill.state === 'claimed';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between'
      }}
    >
      {/* Top info */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', padding: '14px 18px',
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#93C5FD', fontWeight: 700 }}>
            #{bill.ref_number}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>{bill.picker_name}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{fmtTime(bill.submitted_at)}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
            color: 'white', padding: '8px 14px', fontSize: 13, cursor: 'pointer'
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Photo */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <img
          src={bill.photo_url}
          alt={`Bill ${bill.ref_number}`}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain',
            touchAction: 'pinch-zoom'
          }}
          draggable={false}
        />
      </div>

      {/* Bottom actions */}
      {!readOnly && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', padding: '14px 18px',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', gap: 10, justifyContent: 'center'
          }}
        >
          {(isPending || (isClaimed && isMine)) && (
            <button
              onClick={() => { onDone(bill); onClose(); }}
              style={{
                background: '#16A34A', color: 'white', border: 'none',
                borderRadius: 10, padding: '12px 24px', fontSize: 14,
                fontWeight: 700, cursor: 'pointer'
              }}
            >
              ✓ Done
            </button>
          )}
          {isPending && (
            <button
              onClick={() => { onClaim(bill); onClose(); }}
              style={{
                background: '#2563EB', color: 'white', border: 'none',
                borderRadius: 10, padding: '12px 24px', fontSize: 14,
                fontWeight: 700, cursor: 'pointer'
              }}
            >
              Claim
            </button>
          )}
        </div>
      )}
    </div>
  );
}
