const cron = require('node-cron');
const db = require('./lib/db');
const { broadcast } = require('./lib/whatsapp');
const format = require('./lib/format');

function startCron() {
  // Every 15 min: check for stale bills
  cron.schedule('*/15 * * * *', async () => {
    try {
      const staleMinutes = parseInt(process.env.STALE_MINUTES || 120);
      const staleBills = await db.getStaleBills(staleMinutes);

      for (const bill of staleBills) {
        const managers = await db.getActiveUsersByRole('manager');
        const accountants = await db.getActiveUsersByRole('accountant');
        const all = [...managers, ...accountants];
        const numbers = all.map(u => u.wa_number).filter(Boolean);

        if (numbers.length > 0) {
          const msg = format.staleAlertMsg(bill);
          await broadcast(numbers, msg);
        }

        await db.markStaleAlerted(bill.ref_number);
      }
    } catch (err) {
      console.error('⚠️  Stale check cron error:', err.message);
    }
  });

  // Daily summary at configured hour
  const dailyHour = parseInt(process.env.DAILY_HOUR || 18);
  cron.schedule(`0 ${dailyHour} * * *`, async () => {
    try {
      const bills = await db.getBillsToday();
      const done = bills.filter(b => b.state === 'done');

      // Compute summary stats
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

      const data = {
        total: bills.length,
        done: done.length,
        pending: bills.filter(b => b.state === 'pending').length,
        avg_minutes: avgMinutes,
        pickers: Object.entries(pickers).map(([name, count]) => ({ name, count })),
        accountants: Object.entries(accountants).map(([name, resolved]) => ({ name, resolved }))
      };

      const msg = format.dailySummaryMsg(data);
      const managers = await db.getActiveUsersByRole('manager');
      const accountantUsers = await db.getActiveUsersByRole('accountant');
      const all = [...managers, ...accountantUsers];
      const numbers = all.map(u => u.wa_number).filter(Boolean);

      if (numbers.length > 0) {
        await broadcast(numbers, msg);
      }

    } catch (err) {
      console.error('⚠️  Daily summary cron error:', err.message);
    }
  });

  console.log('✅ Cron jobs started (stale: every 15min, daily summary: ' +
              `${parseInt(process.env.DAILY_HOUR || 18)}:00)`);
}

module.exports = { startCron };
