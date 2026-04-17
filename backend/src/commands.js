const db = require('./db');
const storage = require('./storage');
const { sendText, sendImage, broadcast, broadcastImage, downloadMedia } = require('./whatsapp');
const format = require('./format');
const stats = require('./stats');

function isAccountant(u) { return u.role === 'accountant' || u.role === 'manager'; }
function isAccountantOrManager(u) { return u.role === 'accountant' || u.role === 'manager'; }

async function routeMessage(user, type, body, imageId) {
  const cmd = body.toUpperCase().trim();

  if (type === 'image') return handlePhotoSubmission(user, imageId);

  if (type === 'audio') {
    return sendText(user.wa_number,
      'Voice notes are not supported.\nPlease send a photo of the bill.\nSend HELP for commands.'
    );
  }

  if (cmd === 'STATUS') return handleStatus(user);
  if (cmd === 'STATS') return handleStats(user);
  if (cmd === 'WEEK') return handleWeek(user);
  if (cmd === 'HELP') return handleHelp(user);
  if (cmd === 'NEXT' && isAccountant(user)) return handleNext(user);

  const doneMatch = cmd.match(/^DONE\s+(WV\d+)$/);
  const claimMatch = cmd.match(/^CLAIM\s+(WV\d+)$/);
  const skipMatch = cmd.match(/^SKIP\s+(WV\d+)$/);
  const pingMatch = cmd.match(/^PING\s+(WV\d+)$/);

  if (doneMatch && isAccountantOrManager(user)) return handleDone(user, doneMatch[1]);
  if (claimMatch && isAccountantOrManager(user)) return handleClaim(user, claimMatch[1]);
  if (skipMatch && isAccountantOrManager(user)) return handleSkip(user, skipMatch[1]);
  if (pingMatch && user.role === 'manager') return handlePing(user, pingMatch[1]);

  return sendText(user.wa_number,
    'Command not recognised.\nSend HELP to see available commands.'
  );
}

async function handlePhotoSubmission(user, imageId) {
  try {
    // 1. Download image from Meta
    const buffer = await downloadMedia(imageId);

    // 2. Upload to Supabase Storage
    const storagePath = `bills/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    await storage.uploadPhoto(buffer, storagePath);

    // 3. Signed URL (7 day)
    const photoUrl = await storage.getSignedUrl(storagePath);

    // 4. Generate ref
    const ref = await db.nextRef();

    // 5. Insert bill
    await db.insertBill({
      ref_number: ref,
      picker_wa: user.wa_number,
      picker_name: user.name,
      photo_url: photoUrl,
      photo_storage_path: storagePath,
      state: 'pending',
      submitted_at: new Date().toISOString()
    });

    // 6. Log
    await db.logMessage('in', user.wa_number, 'image', '[photo]', ref);

    // 7. Confirm to picker
    const pickerBills = await db.getPickerBillsToday(user.wa_number);
    const submitted = pickerBills.length;
    const done = pickerBills.filter(b => b.state === 'done').length;
    const pending = pickerBills.filter(b => b.state !== 'done').length;
    await sendText(user.wa_number, format.pickerConfirmMsg(ref, { submitted, done, pending }));

    // 8. Notify all accountants (photo + caption)
    const accountants = await db.getUsersByRole('accountant');
    const caption = format.newBillCaption(ref, user.name);
    await broadcastImage(accountants.map(a => a.wa_number), photoUrl, caption);

    // 9. Alert managers
    const allPending = await db.getPendingBills();
    const managers = await db.getUsersByRole('manager');
    await broadcast(
      managers.map(m => m.wa_number),
      format.newBillManagerAlert(ref, user.name, allPending.length)
    );
  } catch (err) {
    console.error('handlePhotoSubmission error:', err);
    await sendText(user.wa_number,
      'Sorry, there was an error processing your photo. Please try again.'
    );
  }
}

async function handleDone(user, ref) {
  const bill = await db.getBillByRef(ref);
  if (!bill) {
    return sendText(user.wa_number,
      `Ref #${ref} not found. Check the number and try again.`
    );
  }
  if (bill.state === 'done') {
    const resolvedAt = bill.resolved_at ? format.fmtTime(bill.resolved_at) : '?';
    return sendText(user.wa_number,
      `✅ #${ref} was already marked done by ${bill.resolved_by_name} at ${resolvedAt}.`
    );
  }

  const now = new Date().toISOString();
  await db.updateBill(bill.id, {
    state: 'done',
    resolved_by_wa: user.wa_number,
    resolved_by_name: user.name,
    resolved_at: now
  });

  // Delete photo
  await storage.deletePhoto(bill.photo_storage_path);

  // Resolve time
  const resolveMinutes = Math.round(
    (new Date(now) - new Date(bill.submitted_at)) / 60000
  );

  // Reply to accountant with queue snapshot
  const pending = await db.getPendingBills();
  await sendText(user.wa_number, format.doneReplyMsg(ref, resolveMinutes, pending));

  // Notify picker
  await sendText(bill.picker_wa, format.donePickerMsg(ref, resolveMinutes));

  // Notify managers
  const managers = await db.getUsersByRole('manager');
  await broadcast(
    managers.map(m => m.wa_number),
    format.doneManagerMsg(ref, user.name, resolveMinutes, pending.length)
  );

  await db.logMessage('out', bill.picker_wa, 'text', `DONE ${ref}`, ref);
}

async function handleClaim(user, ref) {
  const bill = await db.getBillByRef(ref);
  if (!bill) {
    return sendText(user.wa_number, `Ref #${ref} not found.`);
  }
  if (bill.state === 'claimed') {
    return sendText(user.wa_number,
      `${bill.claimed_by_name} already claimed #${ref}.`
    );
  }
  if (bill.state === 'done') {
    return sendText(user.wa_number, `#${ref} is already resolved.`);
  }

  await db.updateBill(bill.id, {
    state: 'claimed',
    claimed_by_wa: user.wa_number,
    claimed_by_name: user.name,
    claimed_at: new Date().toISOString()
  });

  await sendText(user.wa_number, format.claimReplyMsg(ref));

  // Notify other accountants
  const accountants = await db.getUsersByRole('accountant');
  const others = accountants.filter(a => a.wa_number !== user.wa_number);
  await broadcast(others.map(a => a.wa_number), format.claimNotifyMsg(ref, user.name));
}

async function handleSkip(user, ref) {
  const bill = await db.getBillByRef(ref);
  if (!bill) {
    return sendText(user.wa_number, `Ref #${ref} not found.`);
  }
  if (bill.state === 'done') {
    return sendText(user.wa_number, `#${ref} is already resolved — nothing to skip.`);
  }

  await db.updateBill(bill.id, {
    state: 'pending',
    submitted_at: new Date().toISOString(),
    claimed_by_wa: null,
    claimed_by_name: null,
    claimed_at: null
  });

  const next = await db.getOldestUnclaimed();
  await sendText(user.wa_number, format.skipReplyMsg(ref, next));
}

async function handleNext(user) {
  const bill = await db.getOldestUnclaimed();
  if (!bill) {
    return sendText(user.wa_number, '✅ No unclaimed bills right now.');
  }

  // Refresh signed URL if needed
  let photoUrl = bill.photo_url;
  try {
    photoUrl = await storage.getSignedUrl(bill.photo_storage_path);
    await db.updateBill(bill.id, { photo_url: photoUrl });
  } catch (_) {}

  await sendImage(user.wa_number, photoUrl, format.nextBillCaption(bill));
}

async function handleStatus(user) {
  const data = await require('./stats').getTodayStats();
  await sendText(user.wa_number, format.statusMsg(data, user.role));
}

async function handleStats(user) {
  const data = await require('./stats').getTodayStats();
  await sendText(user.wa_number, format.statsMsg(data));
}

async function handleWeek(user) {
  const days = await require('./stats').getWeekStats();
  await sendText(user.wa_number, format.weekMsg(days));
}

async function handlePing(user, ref) {
  const bill = await db.getBillByRef(ref);
  if (!bill) {
    return sendText(user.wa_number, `Ref #${ref} not found.`);
  }

  const accountants = await db.getUsersByRole('accountant');
  const age = format.minsAgo(bill.submitted_at);
  await broadcast(
    accountants.map(a => a.wa_number),
    format.pingAccountantMsg(ref, bill.picker_name, age, bill.state)
  );

  await sendText(user.wa_number, format.pingReplyMsg(ref));
}

async function handleHelp(user) {
  await sendText(user.wa_number, format.helpMsg(user.role));
}

module.exports = { routeMessage };
