import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { myVolunteering } from '../services/green';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight } from '../utils/feedback';
import { titleFor } from '../lib/activityPins';

/* ─── YOUR VOLUNTEERING HOURS, AND A CERTIFICATE ──────────────────────
   Ayser: "volunteering hours certificates". The hours are the
   volunteering gatherings you really checked in to, or led — counted
   by the database (my_volunteering), never typed. The certificate is a
   clean page the phone can print or save as a PDF. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function printCertificate(r, t, lang) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const d = (x) => new Date(x).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const rows = (r.list || []).slice(0, 20).map((g) => '<tr><td>' + esc(titleFor(g.title, lang)) + (g.led ? ' · ' + esc(t('vh_led')) : '') + '</td><td>' + esc(d(g.at)) + '</td><td>' + esc(Math.round(g.minutes / 6) / 10) + ' h</td></tr>').join('');
  const html = '<!doctype html><html dir="' + (lang === 'ar' ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><title>Moments</title><style>'
    + 'body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1A1A1A;margin:0;padding:40px;background:#fff}'
    + '.c{border:3px solid #7C3AED;border-radius:24px;padding:40px;max-width:720px;margin:auto;text-align:center}'
    + 'h1{font-size:30px;margin:8px 0}.n{font-size:26px;font-weight:800;margin:18px 0 6px}.h{font-size:56px;font-weight:900;color:#7C3AED;margin:10px 0}'
    + 'table{width:100%;border-collapse:collapse;margin-top:24px;font-size:13px;text-align:start}td{border-top:1px solid #eee;padding:6px 4px}.f{color:#777;font-size:12px;margin-top:24px}'
    + '</style></head><body><div class="c"><div style="font-size:14px;letter-spacing:3px;color:#7C3AED;font-weight:800">MOMENTS</div>'
    + '<h1>' + esc(t('vh_cert_title')) + '</h1><div>' + esc(t('vh_cert_given')) + '</div><div class="n">' + esc(r.name || '') + '</div>'
    + '<div>' + esc(t('vh_cert_for')) + '</div><div class="h">' + esc(r.hours) + ' h</div>'
    + '<div>' + esc(t('vh_cert_across').replace('{n}', String(r.count))) + '</div>'
    + (rows ? '<table>' + rows + '</table>' : '')
    + '<div class="f">' + esc(t('vh_cert_note')) + '<br>therealmoments.com · ' + esc(d(Date.now())) + '</div></div></body></html>';
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
}

export const VolunteerCert = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [r, setR] = useState(null);
  useEffect(() => { myVolunteering().then((x) => setR(x && x.hours != null ? x : { hours: 0, count: 0, list: [] })).catch(() => setR({ hours: 0, count: 0, list: [] })); }, []);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={12}>
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', marginTop: 8 }}>{'🤝 ' + t('vh_title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{t('vh_sub')}</Text>
          {r == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} /> : (
            <>
              <View style={{ marginTop: 20, borderRadius: 22, borderWidth: 2, borderColor: C.purple, padding: 20, alignItems: 'center' }}>
                <Text style={{ color: C.purple, fontSize: 52, fontWeight: '900' }}>{String(r.hours) + ' h'}</Text>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{t('vh_across').replace('{n}', String(r.count || 0))}</Text>
                {r.led ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>{t('vh_led_n').replace('{n}', String(r.led))}</Text> : null}
              </View>
              {(r.list || []).map((g) => (
                <View key={g.title + g.at} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Text style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{titleFor(g.title, lang)}</Text>
                  <Text style={{ color: C.dim, fontSize: 13 }}>{(Math.round(g.minutes / 6) / 10) + ' h'}</Text>
                </View>
              ))}
              {r.count ? (
                <Pressable onPress={() => { tapLight(); printCertificate(r, t, lang); }} accessibilityRole="button" style={{ marginTop: 20 }}>
                  <View style={{ borderRadius: 999, backgroundColor: C.purple, paddingVertical: 15, alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{'📄 ' + t('vh_get')}</Text>
                  </View>
                </Pressable>
              ) : <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', marginTop: 24, lineHeight: 20 }}>{t('vh_none')}</Text>}
              <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 14, textAlign: 'center' }}>{t('vh_how')}</Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
