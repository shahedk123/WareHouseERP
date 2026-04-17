const db = require('./db');

async function getTodayStats() {
  const bills = await db.getBillsToday();

  const total = bills.length;
  const done = bills.filter(b => b.state === 'done').length;
  const pending = bills.filter(b => b.state === 'pending').length;
  const claimed = bills.filter(b => b.state === 'claimed').length;
  const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const stale = bills.filter(b =>
    (b.state === 'pending' || b.state === 'claimed') &&
    new Date(b.submitted_at) < staleThreshold
  ).length;

  const doneBills = bills.filter(b => b.state === 'done' && b.resolved_at && b.submitted_at);
  const resolveTimes = doneBills.map(b =>
    (new Date(b.resolved_at) - new Date(b.submitted_at)) / 60000
  );
  const avg_minutes = resolveTimes.length
    ? Math.round(resolveTimes.reduce((a, b) => a + b, 0) / resolveTimes.length) : 0;
  const fastest_minutes = resolveTimes.length ? Math.round(Math.min(...resolveTimes)) : 0;
  const slowest_minutes = resolveTimes.length ? Math.round(Math.max(...resolveTimes)) : 0;

  // Pickers
  const pickerMap = new Map();
  for (const b of bills) {
    if (!pickerMap.has(b.picker_name)) pickerMap.set(b.picker_name, 0);
    pickerMap.set(b.picker_name, pickerMap.get(b.picker_name) + 1);
  }
  const pickers = Array.from(pickerMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Accountants
  const acctMap = new Map();
  for (const b of doneBills) {
    if (!b.resolved_by_name) continue;
    if (!acctMap.has(b.resolved_by_name))
      acctMap.set(b.resolved_by_name, { resolved: 0, times: [] });
    const a = acctMap.get(b.resolved_by_name);
    a.resolved++;
    if (b.resolved_at)
      a.times.push((new Date(b.resolved_at) - new Date(b.submitted_at)) / 60000);
  }
  const accountants = Array.from(acctMap.entries()).map(([name, a]) => ({
    name,
    resolved: a.resolved,
    avg_minutes: a.times.length
      ? Math.round(a.times.reduce((x, y) => x + y, 0) / a.times.length) : 0
  }));

  return {
    total, done, pending, claimed, stale,
    avg_minutes, fastest_minutes, slowest_minutes,
    pickers, accountants, bills
  };
}

async function getWeekStats() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const bills = await db.getBillsInRange(start, end);
    const done = bills.filter(b => b.state === 'done');
    const resolveTimes = done
      .filter(b => b.resolved_at)
      .map(b => (new Date(b.resolved_at) - new Date(b.submitted_at)) / 60000);

    days.push({
      date: start,
      total: bills.length,
      done: done.length,
      avg_minutes: resolveTimes.length
        ? Math.round(resolveTimes.reduce((a, b) => a + b, 0) / resolveTimes.length) : 0
    });
  }
  return days;
}

async function getDailySummary() {
  return getTodayStats();
}

module.exports = { getTodayStats, getWeekStats, getDailySummary };
