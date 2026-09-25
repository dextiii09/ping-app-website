// Ping Web Platform - campaign helpers shared by the brand and talent views:
// dates, the fixed fee, slots and status. Dates are day-precision: a brief
// runs over [startsOn, endsOn] (start optional), where endsOn is the delivery
// deadline or event date.

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 'YYYY-MM-DD' (from a date input or a Postgres date) -> local midnight ms.
export function dateOnlyMs(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return y ? new Date(y, m - 1, d).getTime() : null;
}

// ms -> 'YYYY-MM-DD' in local time (for date inputs and Postgres dates).
export function toDateInput(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function briefWindow(b) {
  const end = startOfDay(b.endsOn || b.deadline);
  const start = b.startsOn ? startOfDay(b.startsOn) : end;
  return [Math.min(start, end), end];
}

export function windowsOverlap(a, b) {
  return a[0] <= b[1] && b[0] <= a[1];
}

const fmtDay = (ms, withYear) => new Date(ms).toLocaleDateString('en-IN', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });

// "12 Oct", "10 – 12 Oct" or "30 Sep – 2 Oct".
export function formatWindow(b) {
  const [start, end] = briefWindow(b);
  const sameYear = new Date(end).getFullYear() === new Date().getFullYear();
  if (start === end) return fmtDay(end, !sameYear);
  const s = new Date(start);
  const e = new Date(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()} – ${fmtDay(end, !sameYear)}`;
  return `${fmtDay(start, false)} – ${fmtDay(end, !sameYear)}`;
}

export function daysUntil(ms) {
  return Math.round((startOfDay(ms) - startOfDay(Date.now())) / DAY);
}

// Human hint for the deadline: "Today", "Tomorrow", "In 5 days", "Ended".
export function dueLabel(b) {
  const days = daysUntil(b.endsOn || b.deadline);
  if (days < 0) return 'Ended';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function feeAmount(b) {
  return Number(String(b?.budget || '').replace(/[^\d]/g, '')) || 0;
}

export function formatINR(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

export function slotsLeft(b) {
  return Math.max(0, (b.slots || 1) - (b.slotsFilled || 0));
}

// OPEN (taking applications) | FILLED | CLOSED | ENDED (deadline passed).
export function campaignStatus(b) {
  if (b.status === 'FILLED' || slotsLeft(b) === 0) return 'FILLED';
  if (b.status === 'CLOSED') return 'CLOSED';
  if (daysUntil(b.endsOn || b.deadline) < 0) return 'ENDED';
  return 'OPEN';
}

export const STATUS_LABEL = { OPEN: 'Live', FILLED: 'Filled', CLOSED: 'Closed', ENDED: 'Ended' };

// Same city = the last comma part of the location ("Sector 17, Chandigarh").
export function sameCity(a, b) {
  const city = (loc) => String(loc || '').split(',').pop().trim().toLowerCase();
  return !!city(a) && city(a) === city(b);
}

export function timeAgo(ms) {
  if (!ms) return '';
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

// The note that opens every campaign chat (mirrors decide_application()).
export function selectedNote(b) {
  return `Selected for "${b.title}" · ${b.budget} fixed · ${formatWindow(b)}`;
}

// First name for "Good evening, Priya" - but a business called "The Brew
// Yard Café" is greeted by its full name, not "The".
export function greetName(user) {
  const name = String(user?.name || '').trim();
  const first = name.split(/\s+/)[0] || '';
  if (!first) return 'there';
  return /^(the|a|an)$/i.test(first) ? name : first;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
