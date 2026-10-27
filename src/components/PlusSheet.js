import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { getPlus } from '../lib/plus';
import { buyPlus } from '../services/payments';
import { tapLight, tapSelection } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';
import { useAuth } from '../context/AuthContext';
import { appLink, shareLink, shareNote } from '../utils/share';

/* ─── MOMENTS PLUS ────────────────────────────────────────────────────
   What Plus adds, what it costs, and one button. The price is the
   owner's (set in the Studio); until there is one, Plus says it is on
   its way rather than showing a made-up number. Joining other people's
   hangouts is part of Plus (green_join asks the server); everybody's
   first week is free, and two friends who join with your link add two
   more. Ayser: part of the money helps people who need it and students,
   and pays the people who work at the gatherings — said here plainly,
   with no invented percentages. */
const GIVES = ['help', 'crew', 'perks', 'future'];
const PERKS = [['seat', '🤝'], ['lounge', '🎙'], ['chat', '✉️'], ['light', '💬'], ['papyrus', '🌾'], ['focus', '🪁'], ['trips', '🧳'], ['icons', '🎨'], ['widgets', '🧩']];
// the three that make Plus the way to meet people (the rest read from the language files)
const PERK = {
  seat: { en: 'Book a seat at any meetup', ar: 'احجز مكانك في أي خروجة', cs: 'Rezervuj si místo na jakémkoli setkání', es: 'Reserva plaza en cualquier encuentro', et: 'Broneeri koht igale kohtumisele', fr: 'Réserve ta place à toutes les rencontres', hi: 'किसी भी मीटअप में सीट बुक करो', it: 'Prenota un posto a ogni incontro', ja: 'どのミートアップにも席を予約', ko: '어떤 모임이든 자리 예약', nl: 'Boek een plek bij elke meetup', pt: 'Reserva lugar em qualquer encontro', ro: 'Rezervă un loc la orice întâlnire', ru: 'Бронируй место на любой встрече', tr: 'Her buluşmada yer ayırt', uk: 'Бронюй місце на будь-якій зустрічі', zh: '预订任何聚会的座位' },
  lounge: { en: 'Live Language Lounges, any time', ar: 'غرف اللغات المباشرة في أي وقت', cs: 'Živé jazykové lounge kdykoli', es: 'Salas de idiomas en vivo, cuando quieras', et: 'Keelelounge’id millal tahes', fr: 'Salons de langues en direct, à toute heure', hi: 'लाइव लैंग्वेज लाउंज, कभी भी', it: 'Lounge di lingue dal vivo, sempre', ja: 'ライブ語学ラウンジ、いつでも', ko: '라이브 언어 라운지, 언제든', nl: 'Live taallounges, wanneer je wilt', pt: 'Salas de línguas ao vivo, a qualquer hora', ro: 'Lounge-uri de limbi live, oricând', ru: 'Языковые лаунджи в любое время', tr: 'Canlı dil salonları, her an', uk: 'Мовні лаунжі будь-коли', zh: '随时进入实时语言休息室' },
  chat: { en: 'Messages with your buddies and practice partners', ar: 'رسايل مع الـBuddies وشركاء الممارسة', cs: 'Zprávy s buddies a parťáky na procvičování', es: 'Mensajes con tus buddies y compañeros de práctica', et: 'Sõnumid buddies’te ja harjutuspartneritega', fr: 'Messages avec tes buddies et partenaires de pratique', hi: 'बडीज़ और प्रैक्टिस पार्टनर्स से मैसेज', it: 'Messaggi con buddies e compagni di pratica', ja: 'Buddy や練習パートナーとのメッセージ', ko: '버디와 연습 파트너와 메시지', nl: 'Berichten met buddies en oefenpartners', pt: 'Mensagens com buddies e parceiros de prática', ro: 'Mesaje cu buddies și parteneri de exersat', ru: 'Сообщения с buddies и партнёрами по практике', tr: 'Buddy’ler ve pratik arkadaşlarıyla mesajlar', uk: 'Повідомлення з buddies і партнерами з практики', zh: '和 Buddy、练习伙伴发消息' },
};

// a monthly Lemon Squeezy subscription is managed — or cancelled — in its own customer portal
const MANAGE = { en: 'Manage or cancel', ar: 'تعديل أو إلغاء الاشتراك', cs: 'Spravovat nebo zrušit', es: 'Gestionar o cancelar', et: 'Halda või tühista', fr: 'Gérer ou résilier', hi: 'बदलें या रद्द करें', it: 'Gestisci o annulla', ja: '管理・解約', ko: '관리 또는 해지', nl: 'Beheren of opzeggen', pt: 'Gerir ou cancelar', ro: 'Gestionează sau anulează', ru: 'Управлять или отменить', tr: 'Yönet veya iptal et', uk: 'Керувати або скасувати', zh: '管理或取消' };

/* the paywall's one line, by the door that opened it. Moments Plus is
   what unlocks meeting people: booking a seat at a meetup, the Live
   Language Lounges, and messages with buddies and practice partners.
   Free members preview everything. (Language practice, travel buddies,
   culture — never dating.) */
const UPGRADE = { en: 'Upgrade to Moments Plus', ar: 'اشترك في Moments Plus', cs: 'Přejdi na Moments Plus', es: 'Hazte Moments Plus', et: 'Võta Moments Plus', fr: 'Passe à Moments Plus', hi: 'Moments Plus लो', it: 'Passa a Moments Plus', ja: 'Moments Plus にアップグレード', ko: 'Moments Plus로 업그레이드', nl: 'Upgrade naar Moments Plus', pt: 'Passa para o Moments Plus', ro: 'Treci la Moments Plus', ru: 'Перейти на Moments Plus', tr: 'Moments Plus’a geç', uk: 'Перейти на Moments Plus', zh: '升级到 Moments Plus' };
const WHY = {
  join: { en: 'Booking a seat at a meetup is part of Moments Plus. Browsing stays free.', ar: 'حجز مكان في أي خروجة جزء من Moments Plus. التصفّح يفضل ببلاش.', cs: 'Rezervace místa na setkání je součástí Moments Plus. Prohlížení zůstává zdarma.', es: 'Reservar plaza en un encuentro es parte de Moments Plus. Mirar sigue siendo gratis.', et: 'Kohtumisel koha broneerimine on Moments Plusi osa. Sirvimine jääb tasuta.', fr: 'Réserver une place à une rencontre fait partie de Moments Plus. Parcourir reste gratuit.', hi: 'मीटअप में सीट बुक करना Moments Plus का हिस्सा है। देखना मुफ़्त रहेगा।', it: 'Prenotare un posto a un incontro fa parte di Moments Plus. Guardare resta gratis.', ja: 'ミートアップの席の予約は Moments Plus の機能です。見るのは無料のままです。', ko: '모임 자리 예약은 Moments Plus 기능이에요. 둘러보기는 계속 무료예요.', nl: 'Een plek boeken bij een meetup hoort bij Moments Plus. Rondkijken blijft gratis.', pt: 'Reservar lugar num encontro faz parte do Moments Plus. Ver continua grátis.', ro: 'Rezervarea unui loc la o întâlnire face parte din Moments Plus. Răsfoitul rămâne gratuit.', ru: 'Бронировать место на встрече — часть Moments Plus. Смотреть можно бесплатно.', tr: 'Bir buluşmada yer ayırtmak Moments Plus’ın parçası. Göz atmak ücretsiz kalır.', uk: 'Бронювати місце на зустрічі — частина Moments Plus. Переглядати можна безкоштовно.', zh: '预订聚会座位是 Moments Plus 的功能，浏览依然免费。' },
  chat: { en: 'Messages with buddies and practice partners are part of Moments Plus.', ar: 'الرسايل مع الـBuddies وشركاء الممارسة جزء من Moments Plus.', cs: 'Zprávy s buddies a parťáky na procvičování jsou součástí Moments Plus.', es: 'Los mensajes con buddies y compañeros de práctica son parte de Moments Plus.', et: 'Sõnumid buddies’te ja harjutuspartneritega on Moments Plusi osa.', fr: 'Les messages avec tes buddies et partenaires de pratique font partie de Moments Plus.', hi: 'बडीज़ और प्रैक्टिस पार्टनर्स से मैसेज Moments Plus का हिस्सा हैं।', it: 'I messaggi con buddies e compagni di pratica fanno parte di Moments Plus.', ja: 'Buddy や練習パートナーとのメッセージは Moments Plus の機能です。', ko: '버디와 연습 파트너와의 메시지는 Moments Plus 기능이에요.', nl: 'Berichten met buddies en oefenpartners horen bij Moments Plus.', pt: 'As mensagens com buddies e parceiros de prática fazem parte do Moments Plus.', ro: 'Mesajele cu buddies și partenerii de exersat fac parte din Moments Plus.', ru: 'Сообщения с buddies и партнёрами по практике — часть Moments Plus.', tr: 'Buddy’ler ve pratik arkadaşlarıyla mesajlar Moments Plus’ın parçası.', uk: 'Повідомлення з buddies і партнерами з практики — частина Moments Plus.', zh: '和 Buddy、练习伙伴发消息是 Moments Plus 的功能。' },
  lounge: { en: 'The Live Language Lounges are part of Moments Plus — practise speaking any time.', ar: 'غرف اللغات المباشرة جزء من Moments Plus — اتمرّن تتكلم في أي وقت.', cs: 'Živé jazykové lounge jsou součástí Moments Plus — procvičuj mluvení kdykoli.', es: 'Las salas de idiomas en vivo son parte de Moments Plus: practica cuando quieras.', et: 'Keelelounge’id on Moments Plusi osa — harjuta rääkimist millal tahes.', fr: 'Les salons de langues en direct font partie de Moments Plus — pratique quand tu veux.', hi: 'लाइव लैंग्वेज लाउंज Moments Plus का हिस्सा हैं — कभी भी बोलने की प्रैक्टिस करो।', it: 'Le lounge di lingue dal vivo fanno parte di Moments Plus: fai pratica quando vuoi.', ja: 'ライブ語学ラウンジは Moments Plus の機能です。いつでも話す練習を。', ko: '라이브 언어 라운지는 Moments Plus 기능이에요 — 언제든 말하기 연습을.', nl: 'De live taallounges horen bij Moments Plus — oefen wanneer je wilt.', pt: 'As salas de línguas ao vivo fazem parte do Moments Plus — pratica quando quiseres.', ro: 'Lounge-urile de limbi live fac parte din Moments Plus — exersează oricând.', ru: 'Языковые лаунджи — часть Moments Plus: тренируй речь когда угодно.', tr: 'Canlı dil salonları Moments Plus’ın parçası — istediğin zaman pratik yap.', uk: 'Мовні лаунжі — частина Moments Plus: тренуй мовлення будь-коли.', zh: '实时语言休息室是 Moments Plus 的功能——随时练习口语。' },
};

const money = (n, cur, lang) => {
  try { return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : lang || 'en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); } catch (e) { return n + ' ' + cur; }
};

export const PlusSheet = ({ onClose, why }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [note, setNote] = useState(null);
  const invite = async () => {
    tapLight();
    const r = await shareLink({ url: appLink({ invite: user && user.id }), title: 'Moments', text: t('inv_text') });
    const n = shareNote(r); if (n) { setNote(n); setTimeout(() => setNote(null), 2400); }
  };
  const [plan, setPlan] = useState('year');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { getPlus(true).then(setP); }, []);

  const price = p && p.price;
  const until = p && p.member && p.member.until ? new Date(p.member.until) : null;
  const trial = !!(p && p.plus && p.member && p.member.source === 'trial');
  const day = (d) => d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'long' });
  const save = price ? Math.round((1 - price.year / (price.month * 12)) * 100) : 0;
  const buy = async () => {
    if (busy) return;
    tapLight(); setBusy(true); setErr(null);
    const r = await buyPlus(plan);
    setBusy(false);
    if (!r.ok) setErr(t(r.reason === 'not_configured' || r.reason === 'not_ready' ? 'px_pay_soon' : 'px_err'));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: '#14121F', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 18, maxHeight: '92%' }}>
        <View style={{ alignItems: 'center', marginTop: -8, marginBottom: 6 }}><SheetHandle onClose={onClose} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 22 }}>
        <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1.6, textAlign: 'center' }}>✦ MOMENTS PLUS</Text>
        <Text style={{ color: '#F9F9F6', fontSize: 23, fontWeight: '900', textAlign: 'center', marginTop: 4 }}>{WHY[why] ? (UPGRADE[lang] || UPGRADE.en) : t('px_title')}</Text>
        {why ? <Text style={{ color: '#C9C9D1', fontSize: 13.5, textAlign: 'center', marginTop: 4 }}>{WHY[why] ? (WHY[why][lang] || WHY[why].en) : t('px_why_' + why)}</Text> : null}

        <View style={{ marginTop: 14 }}>
          {PERKS.map(([k, e]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
              <Text style={{ fontSize: 20, width: 34 }}>{e}</Text>
              <Text style={{ color: '#F9F9F6', fontSize: 15, fontWeight: '700', flex: 1 }}>{PERK[k] ? (PERK[k][lang] || PERK[k].en) : t('px_f_' + k)}</Text>
            </View>
          ))}
        </View>

        {/* two friends = two more weeks, once */}
        {p && !p.two_invites_done ? (
          <Pressable onPress={invite} accessibilityRole="button" style={{ marginTop: 14 }}>
            <View style={{ borderRadius: 18, borderWidth: 1.5, borderColor: C.gold, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginEnd: 12 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F9F9F6', fontSize: 15, fontWeight: '900' }}>{t('px_inv2')}</Text>
                <Text style={{ color: '#C9C9D1', fontSize: 12.5, marginTop: 2 }}>{t('px_inv2_sub').replace('{n}', String(Math.min(2, Number(p.invited) || 0)))}</Text>
              </View>
              <Text style={{ color: C.gold, fontSize: 14, fontWeight: '900' }}>{t('px_inv2_go') + ' ›'}</Text>
            </View>
          </Pressable>
        ) : null}
        {note ? <Text style={{ color: C.gold, fontSize: 12.5, textAlign: 'center', marginTop: 6 }}>{note}</Text> : null}

        {/* an early-member offer, where there is one (plus_prices) */}
        {price && price.offer && p && p.payments_online ? (
          <View style={{ marginTop: 14, borderRadius: 16, backgroundColor: 'rgba(245,179,1,0.14)', padding: 12 }}>
            <Text style={{ color: C.gold, fontSize: 14, fontWeight: '900' }}>{'🎉 ' + t('px_offer')}</Text>
            <Text style={{ color: '#E6E4EE', fontSize: 12.5, lineHeight: 18, marginTop: 3 }}>{t('px_offer_sub')}</Text>
          </View>
        ) : null}
        {p == null ? <ActivityIndicator color={C.gold} style={{ marginVertical: 18 }} /> : !p.payments_online ? (
          /* payments are coming soon: everyone is on Plus, as a thank-you */
          <View style={{ marginTop: 16, borderRadius: 18, borderWidth: 1.5, borderColor: C.gold, padding: 16 }}>
            <Text style={{ color: C.gold, fontSize: 15.5, fontWeight: '900' }}>{'✦ ' + t('px_gift_title')}</Text>
            <Text style={{ color: '#E6E4EE', fontSize: 14, lineHeight: 21, marginTop: 8 }}>{t('px_gift_body')}</Text>
            <Text style={{ color: '#F9F9F6', fontSize: 14, fontWeight: '800', marginTop: 10 }}>{t('px_gift_sign')}</Text>
            <Text style={{ color: '#8E8AA3', fontSize: 12, marginTop: 10 }}>{t('px_pay_soon_line')}</Text>
          </View>
        ) : trial ? (
          <Text style={{ color: C.gold, fontSize: 15, fontWeight: '900', textAlign: 'center', marginTop: 16 }}>
            {until ? t('px_trial_until').replace('{date}', day(until)) : t('px_you')}
          </Text>
        ) : p.plus && !p.founding ? (
          <Text style={{ color: C.gold, fontSize: 15, fontWeight: '900', textAlign: 'center', marginTop: 16 }}>
            {until ? t('px_you_until').replace('{date}', until.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'long', year: 'numeric' })) : t('px_you')}
            {p.member && p.member.source === 'lemonsqueezy' ? (
              <Text onPress={() => { tapLight(); buyPlus('month'); }} accessibilityRole="link" style={{ color: '#C9C9D1', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>
                {'\n' + (MANAGE[lang] || MANAGE.en)}
              </Text>
            ) : null}
          </Text>
        ) : p.founding ? (
          <Text style={{ color: C.gold, fontSize: 14.5, fontWeight: '800', textAlign: 'center', marginTop: 16 }}>{t('px_founding')}</Text>
        ) : !price ? (
          <Text style={{ color: '#C9C9D1', fontSize: 14, textAlign: 'center', marginTop: 16 }}>{t('px_soon')}</Text>
        ) : (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row' }}>
              {['month', 'year'].map((k, i) => (
                <Pressable key={k} onPress={() => { tapSelection(); setPlan(k); }} accessibilityRole="radio" accessibilityState={{ selected: plan === k }} style={{ flex: 1, marginEnd: i === 0 ? 10 : 0 }}>
                  <View style={{ borderRadius: 18, borderWidth: 2, borderColor: plan === k ? C.gold : 'rgba(255,255,255,0.15)', padding: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#C9C9D1', fontSize: 12.5, fontWeight: '800' }}>{t('px_' + k)}</Text>
                    <Text style={{ color: '#F9F9F6', fontSize: 19, fontWeight: '900', marginTop: 2 }}>{money(price[k], price.currency, lang)}</Text>
                    {k === 'year' && save > 0 ? <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', marginTop: 2 }}>{t('px_save').replace('{n}', String(save))}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={buy} disabled={busy} accessibilityRole="button" style={{ marginTop: 14 }}>
              <View style={{ borderRadius: 999, backgroundColor: C.gold, paddingVertical: 16, alignItems: 'center' }}>
                {busy ? <ActivityIndicator color="#1A1A1A" /> : <Text style={{ color: '#1A1A1A', fontSize: 16.5, fontWeight: '900' }}>{t('px_get')}</Text>}
              </View>
            </Pressable>
            {err ? <Text style={{ color: '#FCA5A5', fontSize: 13, textAlign: 'center', marginTop: 8 }}>{err}</Text> : null}
          </View>
        )}
        {/* where the money goes */}
        <View style={{ marginTop: 18, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', padding: 14 }}>
          <Text style={{ color: C.gold, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.2 }}>{t('px_gives_title').toUpperCase()}</Text>
          {GIVES.map((k) => (
            <View key={k} style={{ flexDirection: 'row', marginTop: 8 }}>
              <Text style={{ color: C.gold, fontSize: 14, width: 20 }}>♥</Text>
              <Text style={{ color: '#E6E4EE', fontSize: 13.5, lineHeight: 19, flex: 1 }}>{t('px_gives_' + k)}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: '#8E8AA3', fontSize: 12, textAlign: 'center', marginTop: 12 }}>{t('px_free_note')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};
