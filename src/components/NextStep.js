import React, { useEffect, useState } from 'react';
import { titleFor } from '../lib/activityPins';
import { View, Text, Pressable } from 'react-native';
import { C, NUM } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { myBookings, myJourney, money } from '../services/offers';
import { lazyOverlay } from '../lib/lazyScreen';
import { tapLight } from '../utils/feedback';
import { goToTab } from '../lib/mapBus';

/* ─── YOUR NEXT STEP ──────────────────────────────────────────────────
   One screen, one decision. The first thing on Home is the one thing
   that is yours: the next seat you booked — or, with none, the level
   you are on in the learning journey. White, a hairline, the title
   doing the work, one black button. Nothing booked and no journey yet:
   nothing here, and the plan near you (NextUp) is the first thing. */

const EventRoom = lazyOverlay(() => import('./LiveKit').then((m) => ({ default: m.EventRoom })));

// kicker · confirmed · being checked · open · level n of t · book · see journey
const S = {
  en: ['Your next step', 'Confirmed', 'Payment being checked', 'Open event page', 'Level {n} of {t}', 'Book · {p}', 'See your journey'],
  ar: ['خطوتك الجاية', 'متأكد', 'بنراجع التحويل', 'افتح صفحة الخروجة', 'المستوى {n} من {t}', 'احجز · {p}', 'شوف رحلتك'],
  cs: ['Tvůj další krok', 'Potvrzeno', 'Kontrolujeme platbu', 'Otevřít stránku akce', 'Úroveň {n} z {t}', 'Rezervovat · {p}', 'Zobrazit cestu'],
  es: ['Tu siguiente paso', 'Confirmado', 'Revisando el pago', 'Abrir la página', 'Nivel {n} de {t}', 'Reservar · {p}', 'Ver tu camino'],
  et: ['Sinu järgmine samm', 'Kinnitatud', 'Makset kontrollitakse', 'Ava ürituse leht', 'Tase {n} / {t}', 'Broneeri · {p}', 'Vaata teekonda'],
  fr: ['Ta prochaine étape', 'Confirmé', 'Paiement en vérification', 'Ouvrir la page', 'Niveau {n} sur {t}', 'Réserver · {p}', 'Voir ton parcours'],
  hi: ['तुम्हारा अगला कदम', 'पक्का', 'पेमेंट जाँच रहे हैं', 'इवेंट पेज खोलो', 'लेवल {n} / {t}', 'बुक करो · {p}', 'अपनी यात्रा देखो'],
  it: ['Il tuo prossimo passo', 'Confermato', 'Pagamento in verifica', 'Apri la pagina', 'Livello {n} di {t}', 'Prenota · {p}', 'Vedi il percorso'],
  ja: ['次の一歩', '確定', '支払いを確認中', 'イベントページを開く', 'レベル {n} / {t}', '予約 · {p}', '道のりを見る'],
  ko: ['다음 단계', '확정', '결제 확인 중', '이벤트 페이지 열기', '레벨 {n} / {t}', '예약 · {p}', '여정 보기'],
  nl: ['Je volgende stap', 'Bevestigd', 'Betaling wordt gecontroleerd', 'Eventpagina openen', 'Niveau {n} van {t}', 'Boeken · {p}', 'Bekijk je reis'],
  pt: ['O teu próximo passo', 'Confirmado', 'A verificar o pagamento', 'Abrir a página', 'Nível {n} de {t}', 'Reservar · {p}', 'Ver a jornada'],
  ro: ['Următorul tău pas', 'Confirmat', 'Verificăm plata', 'Deschide pagina', 'Nivelul {n} din {t}', 'Rezervă · {p}', 'Vezi drumul'],
  ru: ['Твой следующий шаг', 'Подтверждено', 'Проверяем оплату', 'Открыть страницу', 'Уровень {n} из {t}', 'Записаться · {p}', 'Мой путь'],
  tr: ['Sıradaki adımın', 'Onaylandı', 'Ödeme kontrol ediliyor', 'Etkinlik sayfasını aç', 'Seviye {n} / {t}', 'Ayırt · {p}', 'Yolculuğunu gör'],
  uk: ['Твій наступний крок', 'Підтверджено', 'Перевіряємо оплату', 'Відкрити сторінку', 'Рівень {n} з {t}', 'Записатися · {p}', 'Мій шлях'],
  zh: ['你的下一步', '已确认', '正在核对付款', '打开活动页', '第 {n} 级 / 共 {t} 级', '预订 · {p}', '查看旅程'],
};
const w = (lang, i, v) => {
  let s = (S[lang] || S.en)[i] || S.en[i];
  Object.keys(v || {}).forEach((k) => { s = s.replace('{' + k + '}', String(v[k])); });
  return s;
};
const when = (iso, lang) => {
  try { return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
};

export const NextStep = () => {
  const { lang } = useLang();
  const { user } = useAuth();
  const [step, setStep] = useState(null);
  const [open, setOpen] = useState(null);   // 'event' — a level opens the journey in Together, where it lives

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    (async () => {
      const now = Date.now();
      const rows = await myBookings().catch(() => []);
      const next = rows
        .filter((b) => (b.status === 'reserved' || b.status === 'paid') && b.offer && b.offer.kind !== 'gift'
          && b.offer.starts_at && new Date(b.offer.starts_at).getTime() > now - 3 * 3600000)
        .sort((a, b) => new Date(a.offer.starts_at) - new Date(b.offer.starts_at))[0];
      if (next) { if (alive) setStep({ kind: 'booking', b: next }); return; }
      const j = await myJourney().catch(() => null);
      const here = j && j.levels ? (j.levels[String(j.level)] || []).find((x) => x.status === 'live' && !x.mine) : null;
      if (alive) setStep(j && j.levels && Object.keys(j.levels).length ? { kind: 'level', j, w: here } : null);
    })();
    return () => { alive = false; };
  }, [user]);

  if (!step) return null;
  const isBooking = step.kind === 'booking';
  const o = isBooking ? step.b.offer : step.w;
  const title = isBooking || o ? (lang === 'ar' && o.title_ar ? o.title_ar : titleFor(o.title, lang)) : w(lang, 4, { n: step.j.level, t: step.j.top });
  const meta = o ? [when(o.starts_at, lang), o.city].filter(Boolean).join(' · ') : '';
  const cta = isBooking ? w(lang, 3) : o ? w(lang, 5, { p: money(o.price, o.currency, lang) }) : w(lang, 6);

  return (
    <View style={{ marginTop: 18 }}>
      <Pressable onPress={() => { tapLight(); if (isBooking) setOpen('event'); else goToTab('TOGETHER'); }} accessibilityRole="button" accessibilityLabel={title}>
        <View style={{ backgroundColor: C.glass, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 24 }}>
          <Text style={{ color: C.dim, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>{w(lang, 0)}</Text>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.6, lineHeight: 31, marginTop: 8 }} numberOfLines={2}>{title}</Text>
          {meta ? <Text style={[{ color: C.dim, fontSize: 14, marginTop: 6 }, NUM]} numberOfLines={1}>{meta}</Text> : null}

          {/* the one state that matters, and only that */}
          {isBooking ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: step.b.status === 'paid' ? C.green : C.gold }} />
              <Text style={{ color: C.dim, fontSize: 13, marginStart: 8 }}>{w(lang, step.b.status === 'paid' ? 1 : 2)}</Text>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              {o ? <Text style={[{ color: C.dim, fontSize: 13 }, NUM]}>{w(lang, 4, { n: step.j.level, t: step.j.top })}</Text> : null}
              <View style={{ height: 3, borderRadius: 2, backgroundColor: C.glassHi, marginTop: 8, overflow: 'hidden' }}>
                <View style={{ height: 3, borderRadius: 2, backgroundColor: C.text, width: Math.round(((step.j.level - 1) / Math.max(1, step.j.top)) * 100) + '%' }} />
              </View>
            </View>
          )}

          <View style={{ alignSelf: 'flex-start', marginTop: 20, backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={[{ color: '#FFF', fontSize: 15, fontWeight: '600' }, NUM]}>{cta}</Text>
          </View>
        </View>
      </Pressable>
      {open === 'event' ? <EventRoom kind="offer" id={step.b.offer.id} lang={lang} onClose={() => setOpen(null)} /> : null}
    </View>
  );
};
