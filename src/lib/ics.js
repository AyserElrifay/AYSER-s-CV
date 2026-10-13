import { Platform } from 'react-native';

/* ─── A CALENDAR FILE WITH ITS OWN ALARMS ─────────────────────────────
   "My day" (src/components/MyDay.js) hands the phone a .ics file: the
   phone's own calendar then rings the reminders, every day or every
   working day, even with Moments closed and the phone locked — which a
   web page cannot promise on its own. Times are "floating" (no zone),
   so they mean the same clock time wherever the phone is. */

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

/* events: [{ title, start: Date, minutes, days?: ['MO',…] | 'daily', alarm?: minutes before (0 = at the time) }] */
export function buildIcs(events) {
  const now = stamp(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moments//My day//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Moments · My day'];
  events.forEach((e, i) => {
    const end = new Date(e.start.getTime() + Math.max(5, e.minutes || 15) * 60000);
    lines.push('BEGIN:VEVENT');
    lines.push('UID:moments-myday-' + now + '-' + i + '@therealmoments.com');
    lines.push('DTSTAMP:' + now);
    lines.push('DTSTART:' + stamp(e.start));
    lines.push('DTEND:' + stamp(end));
    lines.push('SUMMARY:' + esc(e.title));
    if (e.days === 'daily') lines.push('RRULE:FREQ=DAILY');
    else if (Array.isArray(e.days) && e.days.length) lines.push('RRULE:FREQ=WEEKLY;BYDAY=' + e.days.join(','));
    if (e.alarm != null) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.title), 'TRIGGER:' + (e.alarm > 0 ? '-PT' + e.alarm + 'M' : 'PT0M'), 'END:VALARM');
    }
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/* hand it to the phone: on an iPhone this opens "Add all to Calendar" */
export function openIcs(text, name = 'moments-my-day.ics') {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  try {
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (e) { return false; }
}
