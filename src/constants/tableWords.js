/* ─── THE WORDS OF A TABLE ────────────────────────────────────────────
   Ayser, October 2026: one Drop at a time, Table #2 when it fills, the
   table chat from 4 hours before, the host line, the walkie-talkie, and
   a colour-coded flag for every pillar so people find their table in any
   café or park (RUN_ME.sql, "ONE SPOTLIGHT AT A TIME"). English and
   Arabic; other languages read English until they are written. The flags
   and the card's few words are in tableCore.js. */
import { CORE, fill } from './tableCore';

export { FLAGS, flagOf, tableNo, countdown, lookFor } from './tableCore';

const W = {
  en: {
    notInterested: 'Take me off the list',
    yourTable: 'Your table',
    locked: 'Chat & Host Direct Line unlock 4 hours before meetup',
    unlocksIn: 'Unlocks in {t}',
    pinned: 'FROM THE HOST',
    pinEmpty: 'The host will pin where to find the table here.',
    openPin: 'Open Exact Pin in Google Maps',
    callHost: 'Call Organizer',
    callPhone: 'Call by phone',
    walkie: 'Table Walkie-Talkie',
    walkieHold: 'Hold to talk',
    walkieTalking: 'Talking…',
    walkieHere: '{n} on the walkie-talkie',
    walkieLeave: 'Leave',
    walkieMic: 'Allow the microphone to talk.',
    beacon: 'Fullscreen Table Flag',
    beaconSub: 'Put the phone on the table, screen up.',
    beaconClose: 'Close',
    scan: 'Scan to check in',
    lineTitle: 'Your host line',
    lineSub: 'Only the people at your table see these, and only from 4 hours before until 2 hours after.',
    telPh: 'Your phone number (optional)',
    mapPh: 'Exact pin — a Google Maps link',
    save: 'Save',
    saved: 'Saved',
    nOpen: 'opened a Drop you were waiting for: {t}',
    err: 'That did not go through. Try again.',
  },
  ar: {
    notInterested: 'شيلني من القايمة',
    yourTable: 'ترابيزتك',
    locked: 'الشات وخط المنظّم بيتفتحوا قبل المعاد بـ ٤ ساعات',
    unlocksIn: 'بيتفتح بعد {t}',
    pinned: 'من المنظّم',
    pinEmpty: 'المنظّم هيكتب هنا إزاي تلاقوا الترابيزة.',
    openPin: 'افتح المكان بالظبط على Google Maps',
    callHost: 'كلّم المنظّم',
    callPhone: 'كلّمه على الموبايل',
    walkie: 'ووكي توكي الترابيزة',
    walkieHold: 'دوس واتكلم',
    walkieTalking: 'بتتكلم…',
    walkieHere: '{n} على الووكي توكي',
    walkieLeave: 'اخرج',
    walkieMic: 'اسمح بالمايك عشان تتكلم.',
    beacon: 'علم الترابيزة على الشاشة كلها',
    beaconSub: 'حط الموبايل على الترابيزة والشاشة لفوق.',
    beaconClose: 'اقفل',
    scan: 'امسح عشان تعمل تشيك إن',
    lineTitle: 'خط المنظّم بتاعك',
    lineSub: 'الناس اللي على ترابيزتك بس اللي بيشوفوا دول، ومن قبل المعاد بـ ٤ ساعات لحد بعده بساعتين.',
    telPh: 'رقم موبايلك (اختياري)',
    mapPh: 'المكان بالظبط — لينك Google Maps',
    save: 'احفظ',
    saved: 'اتحفظ',
    nOpen: 'فتحت Drop كنت مستنيها: {t}',
    err: 'ماتمّتش. جرّب تاني.',
  },
};

export const tbw = (lang, k, vars) => {
  const l = lang === 'ar' ? 'ar' : 'en';
  const s = W[l][k] != null ? W[l][k] : CORE[l][k] != null ? CORE[l][k] : W.en[k] != null ? W.en[k] : CORE.en[k];
  return fill(lang, s, vars);
};
