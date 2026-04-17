import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(800 / img.width, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function StepIndicator({ step }) {
  const steps = ['Scan Bill', 'Record', 'Send'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 20, padding: '0 8px' }}>
      {steps.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        return (
          <React.Fragment key={num}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13, transition: 'all 0.25s',
                background: done ? 'var(--gr)' : active ? 'var(--bl)' : 'transparent',
                color: done || active ? 'white' : 'var(--t4)',
                border: done || active ? 'none' : '2px solid var(--t4)',
                boxShadow: active ? '0 0 0 3px var(--bl3)' : 'none'
              }}>
                {done ? '✓' : num}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: done ? 'var(--gr)' : active ? 'var(--bl)' : 'var(--t4)', transition: 'all 0.25s' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? 'var(--gr)' : 'var(--t4)', margin: '0 6px', marginBottom: 18, transition: 'background 0.25s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ActionBadge({ type }) {
  const styles = {
    ADD: { background: 'var(--gr3)', color: 'var(--gr)' },
    REMOVE: { background: 'var(--rd3)', color: 'var(--rd)' },
    REPLACE: { background: 'var(--pu3)', color: 'var(--pu)' }
  };
  return (
    <span style={{ ...styles[type], fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
      {type}
    </span>
  );
}

export default function PickerView({ t, isRtl, lang, isMobile }) {
  const [step, setStep] = useState(1);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [billId, setBillId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [locationPhone, setLocationPhone] = useState('');
  const [confirmedBill, setConfirmedBill] = useState(null);
  const [recordState, setRecordState] = useState('idle'); // idle|recording|processing|done
  const [transcript, setTranscript] = useState('');
  const [doneCount, setDoneCount] = useState(0);
  const [queue, setQueue] = useState([]);
  const [sendState, setSendState] = useState('idle');
  const [showNewBillModal, setShowNewBillModal] = useState(false);
  const [modalBillId, setModalBillId] = useState('');
  const [modalCustomer, setModalCustomer] = useState('');
  const [modalLocation, setModalLocation] = useState('');
  const [removingId, setRemovingId] = useState(null);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // ── Step 1: Photo & OCR ──
  const handlePhotoSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    setOcrResult(null);

    const compressed = await compressImage(file);
    const previewUrl = URL.createObjectURL(compressed);
    setPhotoPreview(previewUrl);

    try {
      const fd = new FormData();
      fd.append('photo', compressed, 'bill.jpg');
      const res = await axios.post(`${API}/api/ocr`, fd);
      setOcrResult(res.data);
      setBillId(res.data.bill_number || '');
      setCustomerName(res.data.customer_name || '');
      setLocationPhone(res.data.customer_location || '');
    } catch {
      setOcrResult({ bill_number: null, customer_name: null, customer_location: null });
    } finally {
      setPhotoLoading(false);
    }
  }, []);

  const handleRetake = () => {
    setPhotoPreview(null);
    setOcrResult(null);
    setBillId('');
    setCustomerName('');
    setLocationPhone('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirm = () => {
    if (!billId.trim() || !customerName.trim()) return;
    setConfirmedBill({
      bill_number: billId.trim(),
      customer_name: customerName.trim(),
      customer_sub: locationPhone.trim(),
      photo_url: ocrResult?.photo_url || null,
      photo_storage_path: ocrResult?.photo_storage_path || null
    });
    setStep(2);
  };

  // ── Step 2: Recording (improved audio constraints) ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = e => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = handleRecordingStop;
      mediaRecorderRef.current = recorder;
      recorder.start(100); // collect chunks every 100ms for quality
      setRecordState('recording');
      setTranscript('');
    } catch (err) {
      alert(t('micDenied') + ': ' + err.message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    setRecordState('processing');
  };

  const handleRecordingStop = async () => {
    const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current.mimeType });
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'recording.webm');
      fd.append('language', lang);
      const res = await axios.post(`${API}/api/transcribe`, fd);
      const ops = res.data.operations || [];
      setTranscript(res.data.transcript);
      const newItems = ops.map(op => ({
        id: crypto.randomUUID(),
        action_type: op.action_type,
        product_hint: op.product_hint,
        quantity: op.quantity,
        matched_product_code: op.matched_product_code || null,
        matched_product_name: op.matched_product_name || null,
        matched_product_unit: op.matched_product_unit || null,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setQueue(prev => [...prev, ...newItems]);
      setDoneCount(ops.length);
      setRecordState('done');
      setTimeout(() => setRecordState('idle'), 1200);
    } catch {
      setRecordState('idle');
    }
  };

  const handleRecordBtn = () => {
    if (recordState === 'idle' || recordState === 'done') startRecording();
    else if (recordState === 'recording') stopRecording();
  };

  const removeQueueItem = (id) => {
    setRemovingId(id);
    setTimeout(() => {
      setQueue(prev => prev.filter(i => i.id !== id));
      setRemovingId(null);
    }, 200);
  };

  // ── Step 3: Send ──
  const handleSend = async () => {
    if (!queue.length || !confirmedBill) return;
    setSendState('sending');
    try {
      await axios.post(`${API}/api/modifications`, {
        ...confirmedBill,
        picker_name: 'Picker',
        operations: queue.map(item => ({
          raw_statement: item.product_hint,
          action_type: item.action_type,
          product_hint: item.product_hint,
          quantity: item.quantity,
          matched_product_code: item.matched_product_code
        }))
      });
      setSendState('sent');
      setQueue([]);
      setTranscript('');
      setStep(2);
      setTimeout(() => setSendState('idle'), 1500);
    } catch {
      setSendState('idle');
      alert(t('sendFailed'));
    }
  };

  // ── New Bill ──
  const openNewBillModal = () => {
    setModalBillId('');
    setModalCustomer('');
    setModalLocation('');
    setShowNewBillModal(true);
  };

  // Option A: reset and go to scan step
  const handleScanNewBill = () => {
    setConfirmedBill(null);
    setQueue([]);
    setStep(1);
    setPhotoPreview(null);
    setOcrResult(null);
    setBillId('');
    setCustomerName('');
    setLocationPhone('');
    setRecordState('idle');
    setTranscript('');
    setSendState('idle');
    setShowNewBillModal(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Option B: enter manually
  const handleStartNewBill = () => {
    if (!modalBillId.trim() || !modalCustomer.trim()) return;
    setConfirmedBill({
      bill_number: modalBillId.trim(),
      customer_name: modalCustomer.trim(),
      customer_sub: modalLocation.trim(),
      photo_url: null,
      photo_storage_path: null
    });
    setQueue([]);
    setStep(2);
    setPhotoPreview(null);
    setOcrResult(null);
    setBillId('');
    setCustomerName('');
    setLocationPhone('');
    setRecordState('idle');
    setTranscript('');
    setShowNewBillModal(false);
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--card2)',
    border: '1.5px solid var(--bd2)',
    borderRadius: 10,
    padding: '11px 13px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--t1)',
    transition: 'border-color 0.15s'
  };

  return (
    <div style={{
      maxWidth: 520,
      margin: '0 auto',
      padding: isMobile ? '12px 10px' : '16px 12px',
      direction: isRtl ? 'rtl' : 'ltr',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      height: '100%'
    }}>
      <StepIndicator step={step} />

      {/* ── Step 1: Scan Bill ── */}
      {step === 1 && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handlePhotoSelect}
          />

          {!photoPreview && !photoLoading && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'var(--card)', borderRadius: 20, border: '2px dashed var(--bd2)',
                padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bl2)'; e.currentTarget.style.borderColor = 'var(--bl)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.borderColor = 'var(--bd2)'; }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--bl2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--bl)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, color: 'var(--t1)' }}>{t('scanBill')}</div>
              <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 14 }}>{t('scanSub')}</div>
              <span style={{ background: 'var(--bl3)', color: 'var(--bl)', padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {t('noTypingNeeded')}
              </span>
            </div>
          )}

          {photoLoading && (
            <div style={{ background: 'var(--card)', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: 'var(--sh)' }}>
              <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 8 }}>{t('uploadingReading')}</div>
              <div style={{ width: 40, height: 40, border: '3px solid var(--bl3)', borderTopColor: 'var(--bl)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {photoPreview && !photoLoading && ocrResult && (
            <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--sh)', overflow: 'hidden' }}>
              <div style={{ position: 'relative' }}>
                <img src={photoPreview} alt="Bill" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: 'var(--card2)', display: 'block' }} />
                <button
                  onClick={handleRetake}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'white', color: 'var(--rd)', border: '1px solid var(--rd3)', borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 12 }}
                >
                  {t('retake')}
                </button>
              </div>
              <div style={{ padding: '16px 16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: ocrResult.bill_number ? 'var(--gr2)' : 'var(--am2)', border: `1px solid ${ocrResult.bill_number ? 'var(--gr3)' : 'var(--am3)'}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: ocrResult.bill_number ? 'var(--gr)' : 'var(--am)' }}>
                    {ocrResult.bill_number ? `✓ ${t('fieldsExtracted')}` : `⚠ ${t('couldNotRead')}`}
                  </span>
                </div>
                {[
                  { label: t('billId'), value: billId, setter: setBillId, mono: true },
                  { label: t('customer'), value: customerName, setter: setCustomerName },
                  { label: t('locationPhone'), value: locationPhone, setter: setLocationPhone }
                ].map(({ label, value, setter, mono }) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                    <input
                      value={value}
                      onChange={e => setter(e.target.value)}
                      style={{ ...inputStyle, fontFamily: mono ? 'JetBrains Mono, monospace' : undefined }}
                      onFocus={e => e.target.style.borderColor = 'var(--bl)'}
                      onBlur={e => e.target.style.borderColor = 'var(--bd2)'}
                    />
                  </div>
                ))}
                <button
                  onClick={handleConfirm}
                  disabled={!billId.trim() || !customerName.trim()}
                  style={{
                    width: '100%', padding: 16, borderRadius: 14, background: 'var(--bl)', color: 'white',
                    fontWeight: 800, fontSize: 15, minHeight: 56, boxShadow: 'var(--sh2)', marginTop: 4,
                    opacity: (!billId.trim() || !customerName.trim()) ? 0.4 : 1,
                    cursor: (!billId.trim() || !customerName.trim()) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {t('confirmStart')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Steps 2 & 3 ── */}
      {(step === 2 || step === 3) && confirmedBill && (
        <>
          {/* Bill bar */}
          <div style={{ background: 'var(--bl2)', border: '1.5px solid var(--bl3)', borderRadius: 16, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--bl)', marginBottom: 2 }}>{confirmedBill.bill_number}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{confirmedBill.customer_name}</div>
              {confirmedBill.customer_sub && <div style={{ fontSize: 11, color: 'var(--t2)' }}>{confirmedBill.customer_sub}</div>}
            </div>
            <button
              onClick={openNewBillModal}
              style={{ background: 'var(--rd2)', border: '1px solid var(--rd3)', color: 'var(--rd)', borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: 12 }}
            >
              {t('newBill')}
            </button>
          </div>

          {/* Record hint */}
          <div style={{ background: 'var(--bl2)', borderLeft: '3px solid var(--bl)', borderRadius: 10, padding: '10px 13px', fontSize: 12, color: 'var(--t2)', marginBottom: 12 }}>
            {t('recordHint')}
          </div>

          {/* Record button */}
          {(() => {
            const states = {
              idle: { bg: 'var(--bl)', color: 'white', text: t('tapRecord'), border: 'none' },
              recording: { bg: 'var(--rd)', color: 'white', text: t('recording'), border: 'none' },
              processing: { bg: 'var(--am2)', color: 'var(--am)', text: t('processing'), border: '2px solid var(--am3)' },
              done: { bg: 'var(--gr2)', color: 'var(--gr)', text: `${doneCount} ${t('added')}`, border: '2px solid var(--gr3)' }
            };
            const s = states[recordState];
            return (
              <button
                onClick={handleRecordBtn}
                disabled={recordState === 'processing'}
                style={{ width: '100%', minHeight: 68, borderRadius: 16, background: s.bg, color: s.color, border: s.border || 'none', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12, boxShadow: recordState === 'idle' ? 'var(--sh2)' : 'var(--sh)' }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', background: 'currentColor',
                  animation: recordState === 'recording' ? 'blink-dot 0.7s ease-in-out infinite' : recordState === 'processing' ? 'pulse-dot 1.2s ease-in-out infinite' : 'none'
                }} />
                {s.text}
              </button>
            );
          })()}

          {/* Transcript — "What you said" section */}
          {transcript && (
            <div style={{ background: 'var(--card)', border: '1.5px solid var(--bl3)', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: 'var(--bl2)', borderBottom: '1px solid var(--bl3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bl)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bl)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('whatYouSaid')}</span>
                </div>
                <button
                  onClick={() => setTranscript('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: '10px 13px', fontSize: 13, color: 'var(--t1)', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{transcript}"
              </div>
            </div>
          )}

          {/* Queue */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--t3)', fontWeight: 700 }}>{t('queue')}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--bl)', fontWeight: 600 }}>{queue.length} {t('items')}</div>
              </div>
              {queue.length >= 2 && (
                <button
                  onClick={() => setQueue([])}
                  style={{ background: 'var(--rd2)', border: '1px solid var(--rd3)', color: 'var(--rd)', fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '4px 10px' }}
                >
                  {t('clearAll')}
                </button>
              )}
            </div>

            {queue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--t3)', border: '1.5px dashed var(--bd2)', borderRadius: 14, background: 'var(--card)' }}>
                {t('noItemsYet')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {queue.map(item => (
                  <div
                    key={item.id}
                    className={removingId === item.id ? 'animate-fade-out-right' : 'animate-fade-in-up'}
                    style={{ background: 'white', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--sh)', minHeight: 60, display: 'flex' }}
                  >
                    <div style={{ width: 5, background: item.action_type === 'ADD' ? 'var(--gr)' : item.action_type === 'REMOVE' ? 'var(--rd)' : 'var(--pu)', flexShrink: 0 }} />
                    <div style={{ flex: 1, padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 5 }}>{item.product_hint}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <ActionBadge type={item.action_type} />
                        {item.quantity != null && (
                          <span style={{ background: 'var(--card3)', color: 'var(--t2)', fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                            ×{item.quantity}
                          </span>
                        )}
                        <span style={{ background: 'var(--card3)', color: 'var(--t3)', fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4 }}>
                          {item.ts}
                        </span>
                      </div>
                    </div>
                    <div
                      onClick={() => removeQueueItem(item.id)}
                      style={{ width: 52, background: 'var(--rd2)', borderLeft: '1px solid var(--rd3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', transition: 'background 0.12s', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--rd3)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--rd2)'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rd)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      <span style={{ fontSize: 9, color: 'var(--rd)', fontWeight: 700 }}>{t('deleteItem')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={queue.length === 0 || sendState === 'sending'}
            style={{
              width: '100%', padding: 20, borderRadius: 18, background: 'var(--gr)', color: 'white',
              fontWeight: 800, fontSize: 16, minHeight: 66, boxShadow: queue.length === 0 ? 'none' : 'var(--sh2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              opacity: queue.length === 0 ? 0.3 : 1,
              cursor: queue.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {sendState === 'sent' ? `✓ ${t('sent')}` : t('sendAll')}
          </button>
        </>
      )}

      {/* ── New Bill Modal ── */}
      {showNewBillModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowNewBillModal(false)}
        >
          <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 340, boxShadow: 'var(--sh2)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{t('newBillTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--rd)', fontWeight: 600, marginBottom: 16 }}>{t('newBillWarning')}</div>

            {/* Primary: Scan */}
            <button
              onClick={handleScanNewBill}
              style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: 'var(--bl)', color: 'white', fontWeight: 800, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {t('scanNewBill')}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--bd2)' }} />
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>{t('orEnterManually')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--bd2)' }} />
            </div>

            {/* Manual entry */}
            {[
              { label: t('billId'), value: modalBillId, setter: setModalBillId, mono: true },
              { label: t('customer'), value: modalCustomer, setter: setModalCustomer },
              { label: t('locationPhone'), value: modalLocation, setter: setModalLocation }
            ].map(({ label, value, setter, mono }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <input
                  value={value}
                  onChange={e => setter(e.target.value)}
                  style={{ ...inputStyle, fontFamily: mono ? 'JetBrains Mono, monospace' : undefined }}
                  onFocus={e => e.target.style.borderColor = 'var(--bl)'}
                  onBlur={e => e.target.style.borderColor = 'var(--bd2)'}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => setShowNewBillModal(false)}
                style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: 'var(--card2)', color: 'var(--t2)', fontWeight: 700, fontSize: 14, border: '1px solid var(--bd2)' }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleStartNewBill}
                disabled={!modalBillId.trim() || !modalCustomer.trim()}
                style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: 'var(--bl)', color: 'white', fontWeight: 700, fontSize: 14, opacity: (!modalBillId.trim() || !modalCustomer.trim()) ? 0.4 : 1 }}
              >
                {t('startBill')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
