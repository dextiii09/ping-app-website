// Ping - availability: campaign dates a creator is booked for, plus days they
// mark as unavailable. Windows are { start, end, kind } with start/end as
// local midnights (ms) and kind 'booked' or 'blocked'.
import { startOfDay, dateOnlyMs, briefWindow, windowsOverlap, formatWindow } from './campaignUtils.js';

// Days a creator blocked: [{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }] -> windows.
export function blockedWindows(list) {
  return (Array.isArray(list) ? list : []).map((b) => {
    const start = dateOnlyMs(b && b.from);
    const end = dateOnlyMs(b && b.to);
    return start && end && start <= end ? { start, end, kind: 'blocked' } : null;
  }).filter(Boolean);
}

// Windows that haven't ended yet, earliest first.
export function upcoming(windows, from = startOfDay(Date.now())) {
  return windows.filter((w) => w.end >= from).sort((a, b) => a.start - b.start);
}

// The busy window overlapping a campaign's dates (a booking wins over a
// blocked day), or null when they're free.
export function clashWith(windows, brief) {
  const win = briefWindow(brief);
  const hits = (windows || []).filter((w) => windowsOverlap([w.start, w.end], win));
  return hits.find((w) => w.kind === 'booked') || hits[0] || null;
}

export function rangeLabel(w) {
  return formatWindow({ startsOn: w.start === w.end ? null : w.start, endsOn: w.end });
}

// A small calendar (Monday first) marking booked and unavailable days. The
// public media kit shows both simply as "busy" (busyOnly).
export function calendarHtml(windows, { months = 2, from = Date.now(), busyOnly = false } = {}) {
  const today = startOfDay(Date.now());
  const kindOn = (day) => {
    let kind = '';
    for (const w of windows) {
      if (day >= w.start && day <= w.end) {
        if (busyOnly) return 'busy';
        if (w.kind === 'booked') return 'booked';
        kind = 'blocked';
      }
    }
    return kind;
  };
  const base = new Date(from);
  let html = '<div class="av-cal">';
  for (let m = 0; m < months; m++) {
    const first = new Date(base.getFullYear(), base.getMonth() + m, 1);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    html += `<div class="av-month"><div class="av-month-name">${first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div><div class="av-grid">`;
    html += ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="av-dow">${d}</span>`).join('');
    html += '<span class="av-pad"></span>'.repeat(lead);
    for (let d = 1; d <= days; d++) {
      const day = new Date(first.getFullYear(), first.getMonth(), d).getTime();
      const kind = kindOn(day);
      const cls = ['av-day', kind ? `is-${kind}` : '', day < today ? 'is-past' : '', day === today ? 'is-today' : ''].filter(Boolean).join(' ');
      const label = kind ? ` (${kind === 'blocked' ? 'unavailable' : kind})` : '';
      html += `<span class="${cls}" aria-label="${d}${label}">${d}</span>`;
    }
    html += '</div></div>';
  }
  html += busyOnly
    ? '</div><div class="av-legend"><span><i class="is-busy"></i>Busy</span><span><i></i>Free</span></div>'
    : '</div><div class="av-legend"><span><i class="is-booked"></i>Booked</span><span><i class="is-blocked"></i>Unavailable</span></div>';
  return html;
}
