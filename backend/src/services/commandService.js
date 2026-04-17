const db = require('../lib/db');
const storage = require('../lib/storage');
const format = require('../lib/format');
const { sendText, sendImage, broadcast, downloadMedia } = require('../lib/whatsapp');
const notifyService = require('./notifyService');

// ─── Photo Submission ─────────────────────────────────────────────
async function handlePhotoSubmission(user, imageId) {
  try {
    // Download image from Meta
    const buffer = await downloadMedia(imageId);

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const storagePath = `bills/${timestamp}-${random}.jpg`;
    await storage.uploadPhoto(buffer, storagePath);

    // Get signed URL
    const photo_url = await storage.getSignedUrl(storagePath);

    // Generate ref number
    const ref_number = await db.nextRef();

    // Insert bill
    const bill = await db.insertBill({
      ref_number,
      picker_wa: user.wa_number,
      picker_name: user.name,
      picker_id: user.id,
      photo_url,
      photo_storage_path: storagePath,
      state: 'pending',
      submitted_at: new Date().toISOString()
    });

    // Log message
    await db.logMessage('in', user.wa_number, 'image', ref_number, ref_number);

    // Reply to picker
    await sendText(user.wa_number, format.pickerConfirmMsg(ref_number, {
      submitted: 1,
      done: 0,
      pending: 1
    }));

    // Notify all accountants
    const accountants = await db.getActiveUsersByRole('accountant');
    const caption = format.newBillCaption(ref_number, user.name);
    await notifyService.broadcastImageToRole('accountant', photo_url, caption);

    // Notify managers
    const pendingCount = (await db.getPendingBills('pending')).length;
    const alert = format.newBillManagerAlert(ref_number, user.name, pendingCount);
    await notifyService.broadcastToRole('manager', alert);

  } catch (err) {
    console.error('handlePhotoSubmission error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── Stock Entry (IN/OUT) ─────────────────────────────────────────
async function handleStockEntry(user, type, qty, code, ref) {
  try {
    // Validate stock direction
    if (!['IN', 'OUT'].includes(type.toUpperCase())) {
      return sendText(user.wa_number, `❌ Invalid: use IN or OUT`);
    }

    // Find product
    const product = await db.getProductByCode(code);
    if (!product) {
      const suggestions = await db.searchProducts(code);
      return sendText(user.wa_number, format.productNotFoundMsg(code, suggestions));
    }

    // Check stock for OUT
    if (type.toUpperCase() === 'OUT' && product.current_stock < qty) {
      return sendText(user.wa_number,
        `❌ Insufficient stock: ${product.name}\n` +
        `Current: ${product.current_stock} ${product.unit}\n` +
        `Requested: ${qty} ${product.unit}`
      );
    }

    // Determine bill reference
    let billRef = ref;
    if (!billRef) {
      const bills = await db.getPickerBillsToday(user.wa_number);
      if (bills.length > 0) {
        billRef = bills[bills.length - 1].ref_number;
      }
    }

    // Create stock movement
    const delta = type.toUpperCase() === 'IN' ? qty : -qty;
    const rate = type.toUpperCase() === 'IN' ? product.purchase_rate : product.selling_rate;

    const movement = await db.createStockMovement({
      type: type.toUpperCase() === 'IN' ? 'in' : 'out',
      ref_type: 'whatsapp',
      ref_id: billRef ? await db.getBillByRef(billRef)?.id : null,
      ref_number: billRef,
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      quantity: qty,
      unit: product.unit,
      rate,
      created_by: user.id,
      created_at: new Date().toISOString()
    });

    // Update product stock
    await db.updateProductStock(product.id, delta);

    // Record in wa_stock_entries
    if (billRef) {
      const bill = await db.getBillByRef(billRef);
      if (bill) {
        await db.createStockMovement({
          type: type.toUpperCase() === 'IN' ? 'in' : 'out',
          // wa_stock_entries insert (simplified)
        });
      }
    }

    // Get updated product
    const updated = await db.getProductByCode(code);

    // Reply to user
    await sendText(user.wa_number, format.stockEntryMsg(
      type.toUpperCase(),
      qty,
      product.unit,
      { ...product, current_stock: updated.current_stock }
    ));

    // Log
    await db.logMessage('in', user.wa_number, 'stock_' + type.toLowerCase(), code, billRef);

  } catch (err) {
    console.error('handleStockEntry error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── DONE Command ─────────────────────────────────────────────────
async function handleDone(user, ref) {
  try {
    const bill = await db.getBillByRef(ref);
    if (!bill) return sendText(user.wa_number, `❌ Bill not found: ${ref}`);

    if (bill.state === 'done') {
      return sendText(user.wa_number, `ℹ️  #${ref} already done.`);
    }

    // Calculate resolve time
    const resolveMinutes = Math.floor(
      (new Date() - new Date(bill.submitted_at)) / 60000
    );

    // Update bill
    await db.updateBill(ref, {
      state: 'done',
      resolved_by_wa: user.wa_number,
      resolved_by_name: user.name,
      resolved_at: new Date().toISOString()
    });

    // Delete photo from storage
    if (bill.photo_storage_path) {
      await storage.deletePhoto(bill.photo_storage_path);
    }

    // Get pending bills for context
    const pending = await db.getPendingBills('pending');

    // Reply to accountant
    await sendText(user.wa_number, format.doneReplyMsg(ref, resolveMinutes, pending));

    // Log
    await db.logMessage('in', user.wa_number, 'command_done', '', ref);

    // Notify picker
    await sendText(bill.picker_wa, format.donePickerMsg(ref, resolveMinutes));

    // Notify managers
    const managers = await db.getActiveUsersByRole('manager');
    for (const mgr of managers) {
      await sendText(mgr.wa_number, format.doneManagerMsg(ref, user.name, resolveMinutes, pending.length));
    }

  } catch (err) {
    console.error('handleDone error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── CLAIM Command ───────────────────────────────────────────────
async function handleClaim(user, ref) {
  try {
    const bill = await db.getBillByRef(ref);
    if (!bill) return sendText(user.wa_number, `❌ Bill not found: ${ref}`);

    if (bill.state === 'done') {
      return sendText(user.wa_number, `ℹ️  #${ref} already done.`);
    }

    // Update bill
    await db.updateBill(ref, {
      state: 'claimed',
      claimed_by_wa: user.wa_number,
      claimed_by_name: user.name,
      claimed_at: new Date().toISOString()
    });

    // Reply to claimer
    await sendText(user.wa_number, format.claimReplyMsg(ref));

    // Notify other accountants
    const accountants = await db.getActiveUsersByRole('accountant');
    for (const acct of accountants) {
      if (acct.wa_number !== user.wa_number) {
        await sendText(acct.wa_number, format.claimNotifyMsg(ref, user.name));
      }
    }

    // Log
    await db.logMessage('in', user.wa_number, 'command_claim', '', ref);

  } catch (err) {
    console.error('handleClaim error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── SKIP Command ────────────────────────────────────────────────
async function handleSkip(user, ref) {
  try {
    const bill = await db.getBillByRef(ref);
    if (!bill) return sendText(user.wa_number, `❌ Bill not found: ${ref}`);

    if (bill.state === 'done') {
      return sendText(user.wa_number, `ℹ️  #${ref} already done.`);
    }

    // Reset to pending and push to bottom
    await db.updateBill(ref, {
      state: 'pending',
      claimed_by_wa: null,
      claimed_by_name: null,
      claimed_at: null,
      submitted_at: new Date().toISOString() // Move to bottom
    });

    // Get next unclaimed bill
    const next = await db.getOldestUnclaimed();

    // Reply
    await sendText(user.wa_number, format.skipReplyMsg(ref, next));

    // Log
    await db.logMessage('in', user.wa_number, 'command_skip', '', ref);

  } catch (err) {
    console.error('handleSkip error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── NEXT Command ────────────────────────────────────────────────
async function handleNext(user) {
  try {
    const bill = await db.getOldestUnclaimed();
    if (!bill) {
      return sendText(user.wa_number, '✅ No pending bills.');
    }

    // Send photo + caption
    await sendImage(user.wa_number, bill.photo_url, format.nextBillCaption(bill));

    // Log
    await db.logMessage('in', user.wa_number, 'command_next', '', bill.ref_number);

  } catch (err) {
    console.error('handleNext error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── PING Command (Manager only) ──────────────────────────────────
async function handlePing(user, ref) {
  try {
    if (user.role !== 'manager') {
      return sendText(user.wa_number, `❌ PING is for managers only.`);
    }

    const bill = await db.getBillByRef(ref);
    if (!bill) return sendText(user.wa_number, `❌ Bill not found: ${ref}`);

    const mins = Math.floor((Date.now() - new Date(bill.submitted_at)) / 60000);

    // Send reminder to all accountants
    const accountants = await db.getActiveUsersByRole('accountant');
    for (const acct of accountants) {
      await sendText(acct.wa_number, format.pingAccountantMsg(
        ref, bill.picker_name, mins, bill.state
      ));
    }

    // Reply to manager
    await sendText(user.wa_number, format.pingReplyMsg(ref));

    // Log
    await db.logMessage('in', user.wa_number, 'command_ping', '', ref);

  } catch (err) {
    console.error('handlePing error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── FIND Command ────────────────────────────────────────────────
async function handleFind(user, query) {
  try {
    const results = await db.searchProducts(query);
    const msg = format.findMsg(results);
    await sendText(user.wa_number, msg);

    // Log
    await db.logMessage('in', user.wa_number, 'command_find', query);

  } catch (err) {
    console.error('handleFind error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── STATUS Command ──────────────────────────────────────────────
async function handleStatus(user) {
  try {
    const bills = await db.getBillsToday();
    const pending = bills.filter(b => b.state === 'pending' || b.state === 'claimed');
    const done = bills.filter(b => b.state === 'done');

    const msg = format.statusMsg({
      bills: pending,
      total: bills.length,
      done: done.length,
      pending: bills.filter(b => b.state === 'pending').length,
      claimed: bills.filter(b => b.state === 'claimed').length
    }, user.role);

    await sendText(user.wa_number, msg);

    // Log
    await db.logMessage('in', user.wa_number, 'command_status', '');

  } catch (err) {
    console.error('handleStatus error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── STATS Command ───────────────────────────────────────────────
async function handleStats(user) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const bills = await db.getBillsToday();
    const done = bills.filter(b => b.state === 'done');

    // Compute stats
    const pickers = {};
    const accountants = {};

    for (const b of done) {
      if (!pickers[b.picker_name]) pickers[b.picker_name] = 0;
      pickers[b.picker_name]++;

      if (b.resolved_by_name) {
        if (!accountants[b.resolved_by_name]) accountants[b.resolved_by_name] = 0;
        accountants[b.resolved_by_name]++;
      }
    }

    const avgMinutes = done.length > 0
      ? Math.round(done.reduce((sum, b) =>
          sum + (new Date(b.resolved_at) - new Date(b.submitted_at)) / 60000, 0) / done.length)
      : 0;

    const msg = format.statsMsg({
      total: bills.length,
      done: done.length,
      pending: bills.filter(b => b.state === 'pending').length,
      claimed: bills.filter(b => b.state === 'claimed').length,
      stale: bills.filter(b =>
        (b.state === 'pending' || b.state === 'claimed') &&
        Date.now() - new Date(b.submitted_at) > 2 * 60 * 60 * 1000
      ).length,
      avg_minutes: avgMinutes,
      fastest_minutes: done.length > 0 ? Math.min(...done.map(b =>
        Math.floor((new Date(b.resolved_at) - new Date(b.submitted_at)) / 60000)
      )) : 0,
      slowest_minutes: done.length > 0 ? Math.max(...done.map(b =>
        Math.floor((new Date(b.resolved_at) - new Date(b.submitted_at)) / 60000)
      )) : 0,
      pickers: Object.entries(pickers).map(([name, count]) => ({ name, count })),
      accountants: Object.entries(accountants).map(([name, resolved]) => ({
        name, resolved, avg_minutes: 0
      }))
    });

    await sendText(user.wa_number, msg);

    // Log
    await db.logMessage('in', user.wa_number, 'command_stats', '');

  } catch (err) {
    console.error('handleStats error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── WEEK Command ────────────────────────────────────────────────
async function handleWeek(user) {
  try {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const from = date.toISOString().split('T')[0] + 'T00:00:00';
      const to = date.toISOString().split('T')[0] + 'T23:59:59';

      const bills = await db.getBillsInRange(from, to);
      const done = bills.filter(b => b.state === 'done');

      const avgMinutes = done.length > 0
        ? Math.round(done.reduce((sum, b) =>
            sum + (new Date(b.resolved_at) - new Date(b.submitted_at)) / 60000, 0) / done.length)
        : 0;

      days.push({
        date,
        total: bills.length,
        done: done.length,
        avg_minutes: avgMinutes
      });
    }

    const msg = format.weekMsg(days);
    await sendText(user.wa_number, msg);

    // Log
    await db.logMessage('in', user.wa_number, 'command_week', '');

  } catch (err) {
    console.error('handleWeek error:', err.message);
    await sendText(user.wa_number, `❌ Error: ${err.message}`);
  }
}

// ─── HELP Command ────────────────────────────────────────────────
async function handleHelp(user) {
  const msg = format.helpMsg(user.role);
  await sendText(user.wa_number, msg);
  await db.logMessage('in', user.wa_number, 'command_help', '');
}

// ─── Main Router ─────────────────────────────────────────────────
async function route(user, message) {
  const text = (message.text?.body || '').trim().toUpperCase();
  const type = message.type;
  const imageId = message.image?.id;

  // Photo submission
  if (type === 'image' && imageId) {
    return handlePhotoSubmission(user, imageId);
  }

  // Audio/video/document not supported yet
  if (['audio', 'video', 'document'].includes(type)) {
    return sendText(user.wa_number, '📷 Please send a photo of the bill.');
  }

  // Parse text commands
  if (!text) return;

  const [cmd, ...args] = text.split(/\s+/);

  // Universal commands
  switch (cmd) {
    case 'STATUS': return handleStatus(user);
    case 'STATS': return handleStats(user);
    case 'WEEK': return handleWeek(user);
    case 'HELP': return handleHelp(user);
    case 'FIND': return handleFind(user, args.join(' '));
  }

  // Accountant/Manager commands
  if (['accountant', 'manager'].includes(user.role)) {
    const ref = args[0];

    switch (cmd) {
      case 'CLAIM': return handleClaim(user, ref);
      case 'DONE': return handleDone(user, ref);
      case 'SKIP': return handleSkip(user, ref);
      case 'NEXT': return handleNext(user);
      case 'IN':
      case 'OUT': {
        const qty = parseFloat(args[0]);
        const code = args[1];
        const forRef = args.length > 3 && args[2].toUpperCase() === 'FOR' ? args[3] : null;
        return handleStockEntry(user, cmd, qty, code, forRef);
      }
    }
  }

  // Manager-only commands
  if (user.role === 'manager') {
    const ref = args[0];
    if (cmd === 'PING') return handlePing(user, ref);
  }

  // Unknown command
  return sendText(user.wa_number, `❌ Command not recognized: ${cmd}\nReply HELP for options.`);
}

module.exports = { route };
