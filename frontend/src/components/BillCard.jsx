import React from 'react';

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtAge(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

export default function BillCard({ bill, myName, onViewPhoto, onClaim, onDone, onSkip, readOnly = false }) {
  const ageMs = Date.now() - new Date(bill.submitted_at).getTime();
  const isStale = ageMs > 2 * 60 * 60 * 1000;
  const isMine = bill.claimed_by_name === myName;
  const isClaimed = bill.state === 'claimed';
  const isPending = bill.state === 'pending';

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      border: '1px solid #E2E8F0',
      borderLeft: isStale ? '4px solid #D97706' : '4px solid transparent',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
      padding: '12px 14px',
      marginBottom: 10
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563EB' }}>
            #{bill.ref_number}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{bill.picker_name}</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{fmtTime(bill.submitted_at)} · {fmtAge(ageMs)}</span>
        </div>
        {isStale && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#DC2626',
            background: '#FEE2E2', borderRadius: 6, padding: '2px 7px'
          }}>
            ⚠ {fmtAge(ageMs)}
          </span>
        )}
        {isClaimed && !isMine && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#7C3AED',
            background: '#EDE9FE', borderRadius: 6, padding: '2px 7px'
          }}>
            📝 {bill.claimed_by_name}
          </span>
        )}
        {isClaimed && isMine && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#2563EB',
            background: '#EFF4FF', borderRadius: 6, padding: '2px 7px'
          }}>
            📝 Mine
          </span>
        )}
      </div>

      {/* Photo thumbnail + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Thumbnail */}
        <button
          onClick={() => onViewPhoto(bill)}
          style={{
            width: 120, height: 90, borderRadius: 8, overflow: 'hidden',
            border: '1px solid #E2E8F0', background: '#F8FAFC',
            cursor: 'pointer', padding: 0, flexShrink: 0
          }}
        >
          <img
            src={bill.photo_url}
            alt="Bill"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </button>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <button
            onClick={() => onViewPhoto(bill)}
            style={{
              background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '7px 12px', fontSize: 12, fontWeight: 600,
              color: '#475569', cursor: 'pointer'
            }}
          >
            View Photo
          </button>

          {!readOnly && (
            <>
              {/* Pending: show Claim + Done + Skip */}
              {isPending && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onClaim(bill)}
                    style={{
                      flex: 1, background: '#EFF4FF', border: '1px solid #DBEAFE',
                      borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 700,
                      color: '#2563EB', cursor: 'pointer'
                    }}
                  >
                    Claim
                  </button>
                  <button
                    onClick={() => onDone(bill)}
                    style={{
                      flex: 1, background: '#F0FDF4', border: '1px solid #DCFCE7',
                      borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 700,
                      color: '#16A34A', cursor: 'pointer'
                    }}
                  >
                    Done ✓
                  </button>
                  <button
                    onClick={() => onSkip(bill)}
                    style={{
                      background: '#F8FAFC', border: '1px solid #E2E8F0',
                      borderRadius: 8, padding: '7px 10px', fontSize: 12,
                      color: '#94A3B8', cursor: 'pointer'
                    }}
                  >
                    Skip
                  </button>
                </div>
              )}

              {/* Claimed by me: Done + Release */}
              {isClaimed && isMine && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onDone(bill)}
                    style={{
                      flex: 1, background: '#16A34A', border: 'none',
                      borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 700,
                      color: 'white', cursor: 'pointer'
                    }}
                  >
                    Done ✓
                  </button>
                  <button
                    onClick={() => onSkip(bill)}
                    style={{
                      background: '#F8FAFC', border: '1px solid #E2E8F0',
                      borderRadius: 8, padding: '7px 12px', fontSize: 12,
                      color: '#94A3B8', cursor: 'pointer'
                    }}
                  >
                    Release
                  </button>
                </div>
              )}

              {/* Claimed by someone else */}
              {isClaimed && !isMine && (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  📝 Claimed by {bill.claimed_by_name}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
