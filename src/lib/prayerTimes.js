/* ─── PRAYER TIMES, WORKED OUT ON THE PHONE ───────────────────────────
   For "My day" (src/components/MyDay.js), when somebody asks for them.
   The standard astronomical method: where the sun is on that date
   (declination and the equation of time), then the moments it reaches
   the angles each prayer is defined by. No server, no account, nothing
   sent anywhere — just the place and the date.

   The angles follow the convention people already use there:
     · Egypt and nearby       — Egyptian General Authority (Fajr 19.5°, Isha 17.5°)
     · Saudi Arabia, the Gulf — Umm al-Qura (Fajr 18.5°, Isha 90 min after Maghrib)
     · everywhere else        — Muslim World League (Fajr 18°, Isha 17°)
   Asr is the standard (Shafi'i) shadow. Far north in summer, where the
   sky never gets dark enough for the angle, Fajr and Isha fall back to
   a seventh of the night — the usual rule. Times can differ from a
   local mosque by a minute or two; the screen says so. */

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const fix = (a, b) => { const x = a - b * Math.floor(a / b); return x < 0 ? x + b : x; };

function sun(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  const eqt = q / 15 - RA;
  return { decl, eqt: eqt > 12 ? eqt - 24 : eqt < -12 ? eqt + 24 : eqt };
}

const julian = (y, m, d) => {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100); const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
};

export function methodFor(lat, lng) {
  if (lat > 21 && lat < 32.5 && lng > 24 && lng < 37) return { fajr: 19.5, isha: 17.5 };                  // Egypt
  if (lat > 12 && lat < 32.5 && lng > 34.5 && lng < 60) return { fajr: 18.5, ishaMin: 90 };               // Arabian peninsula
  return { fajr: 18, isha: 17 };                                                                            // Muslim World League
}

/* { fajr, sunrise, dhuhr, asr, maghrib, isha } as Date objects, for the
   given day at (lat, lng), in the phone's own time zone */
export function prayerTimes(date, lat, lng) {
  const y = date.getFullYear(); const m = date.getMonth() + 1; const d = date.getDate();
  const tz = -new Date(y, m - 1, d, 12).getTimezoneOffset() / 60;
  const s = sun(julian(y, m, d) + 0.5 - lng / 360);
  const noon = 12 + tz - lng / 15 - s.eqt;
  const T = (angle) => {
    const v = (-Math.sin(rad(angle)) - Math.sin(rad(s.decl)) * Math.sin(rad(lat))) / (Math.cos(rad(s.decl)) * Math.cos(rad(lat)));
    return v < -1 || v > 1 ? NaN : deg(Math.acos(v)) / 15;
  };
  const A = (t) => {
    const a = deg(Math.atan(1 / (t + Math.tan(rad(Math.abs(lat - s.decl))))));
    const v = (Math.sin(rad(a)) - Math.sin(rad(s.decl)) * Math.sin(rad(lat))) / (Math.cos(rad(s.decl)) * Math.cos(rad(lat)));
    return deg(Math.acos(Math.max(-1, Math.min(1, v)))) / 15;
  };
  const meth = methodFor(lat, lng);
  const sunrise = noon - T(0.833);
  const maghrib = noon + T(0.833);
  const night = 24 - (maghrib - sunrise);
  let fajr = noon - T(meth.fajr);
  if (!isFinite(fajr)) fajr = sunrise - night / 7;
  let isha = meth.ishaMin ? maghrib + meth.ishaMin / 60 : noon + T(meth.isha);
  if (!isFinite(isha)) isha = maghrib + night / 7;
  const at = (h) => { const ms = Math.round(h * 60) * 60000; const base = new Date(y, m - 1, d, 0, 0, 0, 0); return new Date(base.getTime() + ms); };
  return { fajr: at(fajr), sunrise: at(sunrise), dhuhr: at(noon + 1 / 60), asr: at(noon + A(1)), maghrib: at(maghrib + 1 / 60), isha: at(isha) };
}
