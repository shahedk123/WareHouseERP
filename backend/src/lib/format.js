// Pure functions. Plain text only. No markdown. Unicode: ─ ═ • ✅ ⏳ ⚠ 📊 🔔 👤

const fmtTime = d => new Date(d).toLocaleTimeString('en-IN',
  { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtDate = d => new Date(d).toLocaleDateString('en-IN',
  { weekday: 'short', day: 'numeric', month: 'short' });
const minsAgo = ts => Math.floor((Date.now() - new Date(ts)) / 60000);
const fmtAge = m => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const bar = (n, max, len = 8) => {
  const f = Math.round((n / max) * len);
  return '█'.repeat(f) + '░'.repeat(len - f);
};

const fmtCurrency = (amount, currency = 'INR') => {
  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0 });
  return fmt.format(amount);
};

// STATUS — for all roles
function statusMsg(data, role) {
  const pendingLines = data.bills
    .filter(b => b.state === 'pending' || b.state === 'claimed')
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))
    .map(b => {
      const mins = minsAgo(b.submitted_at);
      const stale = mins >= 120 ? ' ⚠' : '';
      const who = b.state === 'claimed' ? ` (${b.claimed_by_name})` : '';
      return `  ⏳ #${b.ref_number}  ${b.picker_name}  ${fmtAge(mins)}${who}${stale}`;
    });

  const lines = [
    `📊 Queue Status — ${fmtTime(new Date())}`,
    '─────────────────────────────',
    `Today: ${data.total} bills  ✅ ${data.done}  ⏳ ${data.pending + data.claimed}`,
    '',
  ];
  if (pendingLines.length) {
    lines.push('Pending:', ...pendingLines);
  } else {
    lines.push('✅ All clear — nothing pending!');
  }
  lines.push(
    '',
    `Dashboard: ${process.env.FRONTEND_URL}/queue`
  );
  if (role === 'accountant' || role === 'manager') {
    lines.push(
      '─────────────────────────────',
      'CLAIM [ref] · DONE [ref] · NEXT · SKIP [ref]'
    );
  }
  return lines.join('\n');
}

// STATS — for all roles (now includes ERP data)
function statsMsg(data) {
  const maxPicker = Math.max(...data.pickers.map(p => p.count), 1);
  const maxAcct = Math.max(...data.accountants.map(a => a.resolved), 1);
  return [
    `📊 Today — ${fmtDate(new Date())}`,
    '════════════════════════════',
    `WA Bills in:   ${data.total}`,
    `✅ Done:       ${data.done} (${pct(data.done, data.total)}%)`,
    `⏳ Pending:    ${data.pending}`,
    `⚠ Stale>2h:   ${data.stale}`,
    '',
    data.invoicesCreated !== undefined ? [
      `ERP Invoices:  ${data.invoicesCreated}`,
      `Sales Value:   ${fmtCurrency(data.salesValue)}`,
      ''
    ] : [],
    `Avg resolve: ${data.avg_minutes} min`,
    `Fastest:     ${data.fastest_minutes} min`,
    `Slowest:     ${data.slowest_minutes} min`,
    '',
    'Pickers:',
    ...data.pickers.map(p =>
      `${p.name.padEnd(14)} ${bar(p.count, maxPicker)} ${p.count}`),
    '',
    'Accountants:',
    ...data.accountants.map(a =>
      `${a.name.padEnd(14)} ${bar(a.resolved, maxAcct)} ${a.resolved} done  ${a.avg_minutes}m avg`),
    '════════════════════════════',
    `Full stats: ${process.env.FRONTEND_URL}/dashboard`,
  ].flat().join('\n');
}

// WEEK
function weekMsg(days) {
  const rows = days.map(d => {
    const label = fmtDate(d.date).padEnd(13);
    return `${label} ${String(d.total).padStart(2)}  ✅${d.done}  avg ${d.avg_minutes}m`;
  });
  const tot = days.reduce((a, d) => a + d.total, 0);
  const don = days.reduce((a, d) => a + d.done, 0);
  return [
    '📊 This Week',
    '════════════════════════════',
    ...rows,
    '────────────────────────────',
    `Total: ${tot} bills  ✅ ${don} (${pct(don, tot)}%)`,
    '════════════════════════════',
  ].join('\n');
}

// HELP
function helpMsg(role) {
  const lines = [
    'WarehouseOS — Commands',
    '─────────────────────────',
    '📷 Send photo    Submit a bill',
    'FIND [query]     Search products',
    'STATUS           Queue + counts',
    'STATS            Today\'s stats',
    'WEEK             7-day summary',
    'HELP             This menu',
  ];
  if (role === 'accountant' || role === 'manager') {
    lines.push(
      '─────────────────────────',
      'CLAIM [ref]      Claim a bill',
      'DONE [ref]       Mark resolved',
      'SKIP [ref]       Move to bottom',
      'NEXT             Next unclaimed bill',
      'IN qty code      Record stock in',
      'OUT qty code     Record stock out',
    );
  }
  if (role === 'manager') {
    lines.push('PING [ref]       Remind accountant');
  }
  lines.push(
    '─────────────────────────',
    `Web: ${process.env.FRONTEND_URL}`
  );
  return lines.join('\n');
}

// Stale alert
function staleAlertMsg(bill) {
  const mins = minsAgo(bill.submitted_at);
  return [
    `⚠ Stale Bill — ${fmtTime(new Date())}`,
    '─────────────────────────',
    `#${bill.ref_number} · ${bill.picker_name}`,
    `Submitted ${fmtAge(mins)} ago — still ${bill.state}`,
    '─────────────────────────',
    `Reply CLAIM ${bill.ref_number} to take it.`,
    `Or PING ${bill.ref_number} to remind accountant.`,
  ].join('\n');
}

// Daily summary
function dailySummaryMsg(data) {
  const maxPicker = Math.max(...(data.pickers.map(p => p.count)), 1);
  const pendingNote = data.pending > 0
    ? `\n⚠ Still pending: ${data.pending} bill${data.pending > 1 ? 's' : ''}`
    : '\n✅ All bills cleared today!';
  return [
    `📊 Daily Summary — ${fmtDate(new Date())}`,
    '════════════════════════════',
    `Bills: ${data.total}  ✅ Done: ${data.done}  ⏳ Pending: ${data.pending}`,
    `Avg resolve time: ${data.avg_minutes} min`,
    '',
    'Pickers:',
    ...data.pickers.map(p =>
      `${p.name.padEnd(14)} ${bar(p.count, maxPicker)} ${p.count}`),
    '',
    'Accountants:',
    ...data.accountants.map(a =>
      `${a.name.padEnd(14)} ${a.resolved} resolved`),
    pendingNote,
    '════════════════════════════',
    'Good night 🌙',
  ].join('\n');
}

// Photo submission confirmation for picker
function pickerConfirmMsg(ref, todayStats) {
  return [
    `✅ Received — Ref #${ref}`,
    'Accountant has been notified.',
    '',
    `Your bills today: ${todayStats.submitted} submitted  ✅ ${todayStats.done}  ⏳ ${todayStats.pending}`,
  ].join('\n');
}

// New bill caption for accountants
function newBillCaption(ref, pickerName) {
  return [
    `🗒 New Bill — Ref #${ref}`,
    `👤 ${pickerName} · ${fmtTime(new Date())}`,
    '',
    `Reply: CLAIM ${ref} to take it`,
    `Reply: DONE ${ref} after recording stock`,
  ].join('\n');
}

// New bill alert for managers
function newBillManagerAlert(ref, pickerName, pendingCount) {
  return [
    `🗒 #${ref} submitted by ${pickerName} · ${fmtTime(new Date())}`,
    `Queue: ${pendingCount} pending`,
  ].join('\n');
}

// Done reply to accountant
function doneReplyMsg(ref, resolveMinutes, pendingBills) {
  const lines = [
    `✅ #${ref} done — ${resolveMinutes} min`,
    '',
    `Pending in queue: ${pendingBills.length}`,
  ];
  for (const b of pendingBills.slice(0, 3)) {
    const who = b.state === 'claimed' ? ` (claimed by ${b.claimed_by_name})` : ' (unclaimed)';
    lines.push(`  • #${b.ref_number} — ${b.picker_name} — ${fmtAge(minsAgo(b.submitted_at))}${who}`);
  }
  if (pendingBills.length > 0) lines.push('', 'Reply NEXT for oldest unclaimed.');
  return lines.join('\n');
}

// Done notification for manager
function doneManagerMsg(ref, accountantName, resolveMinutes, pendingCount) {
  return [
    `✅ #${ref} done by ${accountantName} (${resolveMinutes} min)`,
    `Pending: ${pendingCount} remaining`,
  ].join('\n');
}

// Done notification for picker
function donePickerMsg(ref, resolveMinutes) {
  return [
    `✅ #${ref} resolved.`,
    `Resolved in ${resolveMinutes} min.`,
  ].join('\n');
}

// Claim reply
function claimReplyMsg(ref) {
  return [
    `📝 #${ref} claimed by you.`,
    `Record stock movement then reply DONE ${ref}.`,
  ].join('\n');
}

// Claim notification to other accountants
function claimNotifyMsg(ref, claimerName) {
  return `📝 #${ref} claimed by ${claimerName}.`;
}

// Skip reply
function skipReplyMsg(ref, next) {
  const lines = [`⏭ #${ref} moved to bottom of queue.`];
  if (next) {
    lines.push('', `Next unclaimed: #${next.ref_number} — ${next.picker_name} — ${fmtAge(minsAgo(next.submitted_at))}`);
    lines.push(`Reply CLAIM ${next.ref_number} to take it.`);
  } else {
    lines.push('', 'No other unclaimed bills right now.');
  }
  return lines.join('\n');
}

// Next bill caption
function nextBillCaption(bill) {
  return [
    `Next — Ref #${bill.ref_number}`,
    `👤 ${bill.picker_name} · ${fmtTime(bill.submitted_at)} · ${fmtAge(minsAgo(bill.submitted_at))} ago`,
    '',
    `Reply CLAIM ${bill.ref_number} to take it.`,
    `Reply DONE ${bill.ref_number} after recording stock.`,
  ].join('\n');
}

// Ping — to accountants (from manager)
function pingAccountantMsg(ref, pickerName, age, state) {
  return [
    `🔔 Manager reminder — #${ref}`,
    `${pickerName} submitted ${fmtAge(age)} ago — still ${state}`,
    `Please reply DONE ${ref} after recording stock.`,
  ].join('\n');
}

// Ping reply to manager
function pingReplyMsg(ref) {
  return `✓ Accountants reminded about #${ref}.`;
}

// Stock entry response
function stockEntryMsg(type, qty, unit, product) {
  return [
    `✅ Stock updated: ${type} ${qty} ${unit} ${product.name}`,
    `New stock: ${product.current_stock} ${unit}`,
    '',
    'Send another IN/OUT or reply DONE to mark bill complete.',
  ].join('\n');
}

// Product not found
function productNotFoundMsg(code, suggestions) {
  const lines = [
    `❌ Product code not found: ${code}`,
    '',
    'Use FIND to search:',
    '  FIND cement',
    '  FIND steel rod',
  ];
  if (suggestions && suggestions.length > 0) {
    lines.push('', 'Similar products:');
    for (const p of suggestions.slice(0, 5)) {
      lines.push(`  ${p.code} — ${p.name} (${p.current_stock} ${p.unit})`);
    }
  }
  return lines.join('\n');
}

// Find results
function findMsg(results) {
  if (results.length === 0) {
    return 'No products found. Try a different search.';
  }
  const lines = [`📦 Found ${results.length} product(s):`];
  for (const p of results.slice(0, 10)) {
    lines.push(`${p.code.padEnd(10)} ${p.name.padEnd(25)} Stock: ${String(p.current_stock).padStart(5)} ${p.unit}`);
  }
  if (results.length > 10) {
    lines.push(`... and ${results.length - 10} more`);
  }
  lines.push('', 'Use IN or OUT with the product code.');
  return lines.join('\n');
}

module.exports = {
  statusMsg, statsMsg, weekMsg, helpMsg, staleAlertMsg, dailySummaryMsg,
  pickerConfirmMsg, newBillCaption, newBillManagerAlert,
  doneReplyMsg, doneManagerMsg, donePickerMsg,
  claimReplyMsg, claimNotifyMsg, skipReplyMsg, nextBillCaption,
  pingAccountantMsg, pingReplyMsg,
  stockEntryMsg, productNotFoundMsg, findMsg,
  fmtTime, fmtDate, fmtAge, minsAgo, fmtCurrency, pct, bar
};
