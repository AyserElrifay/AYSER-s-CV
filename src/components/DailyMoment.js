import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Animated, Easing } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { dailyMoment, dailyAnswer, dailyReact, dmOpen } from '../services/live';
import { askSafety, askUpgrade } from '../services/membership';

// the founding pass, in two lines (kept here: the MVP words live in their own chunk)
const PASS = {
  en: { over: 'Your 14 open days are over. Meet at a table, or join Moments+ to keep writing.', first: 'Answer today’s Daily Moment first.' },
  ar: { over: 'الـ ١٤ يوم المفتوحين خلصوا. اتقابلوا على ترابيزة، أو اشترك في مومنتس+ عشان تكمّلوا كلام.', first: 'جاوب على لحظة النهارده الأول.' },
};
import { lazyOverlay } from '../lib/lazyScreen';
import { Face } from '../ui/Face';
import { tapLight, tapMedium, tapSuccess, tapSelection } from '../utils/feedback';

/* ─── THE DAILY MOMENT ────────────────────────────────────────────────
   One question a day at the top of the feed — a travel dilemma, a
   culture poll, a quick English twist. BeReal's rule: you answer first,
   and only then you see what your buddies and everybody else said, with
   one-tap reactions. A reply to somebody's answer is the one way to
   start talking to a member you have not met (Moments Black, and the
   server lets only that first line through until they answer). */

const BuddiesSheet = lazyOverlay(() => import('./LiveKit').then((m) => ({ default: m.BuddiesSheet })));
const EMO = ['🔥', '😂', '❤️', '🤯', '👏'];

const S = {
  en: ['The Daily Moment', '{n} answered today', 'Answer to unlock what your buddies and everyone else said.', 'Your answer…', 'Share', 'Buddy', 'Reply', 'Reply to {n}…', 'Send', 'Show all', 'It did not go through. Try again.', 'You'],
  ar: ['لحظة النهارده', '{n} جاوبوا النهارده', 'جاوب عشان تشوف الـBuddies بتوعك وباقي الناس قالوا إيه.', 'إجابتك…', 'شارك', 'Buddy', 'ردّ', 'ردّ على {n}…', 'ابعت', 'اعرض الكل', 'ماتبعتش. جرّب تاني.', 'إنت'],
  cs: ['Daily Moment', 'Dnes odpovědělo {n}', 'Odpověz a uvidíš, co napsali tví buddies a ostatní.', 'Tvoje odpověď…', 'Sdílet', 'Buddy', 'Odpovědět', 'Odpověď pro {n}…', 'Poslat', 'Zobrazit vše', 'Nepodařilo se. Zkus to znovu.', 'Ty'],
  es: ['El Daily Moment', '{n} respondieron hoy', 'Responde para ver qué dijeron tus buddies y los demás.', 'Tu respuesta…', 'Compartir', 'Buddy', 'Responder', 'Responder a {n}…', 'Enviar', 'Ver todo', 'No se envió. Inténtalo de nuevo.', 'Tú'],
  et: ['Päeva hetk', 'Täna vastas {n}', 'Vasta, et näha, mida su buddies ja teised ütlesid.', 'Sinu vastus…', 'Jaga', 'Buddy', 'Vasta', 'Vastus: {n}…', 'Saada', 'Näita kõiki', 'Ei läinud läbi. Proovi uuesti.', 'Sina'],
  fr: ['Le Daily Moment', '{n} ont répondu aujourd’hui', 'Réponds pour voir ce qu’ont dit tes buddies et les autres.', 'Ta réponse…', 'Partager', 'Buddy', 'Répondre', 'Répondre à {n}…', 'Envoyer', 'Tout voir', 'Ça n’est pas passé. Réessaie.', 'Toi'],
  hi: ['आज का Moment', 'आज {n} ने जवाब दिया', 'जवाब दो, फिर देखो तुम्हारे बडीज़ और बाकी लोगों ने क्या कहा।', 'तुम्हारा जवाब…', 'शेयर', 'बडी', 'जवाब', '{n} को जवाब…', 'भेजो', 'सब देखो', 'नहीं गया। फिर कोशिश करो।', 'तुम'],
  it: ['Il Daily Moment', '{n} hanno risposto oggi', 'Rispondi per vedere cosa hanno detto i tuoi buddies e gli altri.', 'La tua risposta…', 'Condividi', 'Buddy', 'Rispondi', 'Rispondi a {n}…', 'Invia', 'Vedi tutto', 'Non è andato. Riprova.', 'Tu'],
  ja: ['今日の Moment', '今日{n}人が回答', '答えると、Buddy やみんなの答えが見られます。', 'あなたの答え…', 'シェア', 'Buddy', '返信', '{n}さんに返信…', '送信', 'すべて見る', '送れませんでした。もう一度どうぞ。', 'あなた'],
  ko: ['오늘의 Moment', '오늘 {n}명이 답했어요', '답하면 버디와 다른 사람들의 답이 열려요.', '내 답…', '공유', '버디', '답장', '{n}님에게 답장…', '보내기', '모두 보기', '전송되지 않았어요. 다시 해 주세요.', '나'],
  nl: ['Het Daily Moment', '{n} antwoordden vandaag', 'Antwoord om te zien wat je buddies en de rest zeiden.', 'Jouw antwoord…', 'Delen', 'Buddy', 'Reageren', 'Reageer op {n}…', 'Sturen', 'Alles tonen', 'Het lukte niet. Probeer opnieuw.', 'Jij'],
  pt: ['O Daily Moment', '{n} responderam hoje', 'Responde para ver o que os teus buddies e os outros disseram.', 'A tua resposta…', 'Partilhar', 'Buddy', 'Responder', 'Responder a {n}…', 'Enviar', 'Ver tudo', 'Não foi. Tenta outra vez.', 'Tu'],
  ro: ['Daily Moment', 'Azi au răspuns {n}', 'Răspunde ca să vezi ce au spus buddies și ceilalți.', 'Răspunsul tău…', 'Distribuie', 'Buddy', 'Răspunde', 'Răspunde-i lui {n}…', 'Trimite', 'Vezi tot', 'Nu a mers. Încearcă din nou.', 'Tu'],
  ru: ['Daily Moment', 'Сегодня ответили: {n}', 'Ответь, чтобы увидеть, что сказали твои buddies и остальные.', 'Твой ответ…', 'Поделиться', 'Buddy', 'Ответить', 'Ответ для {n}…', 'Отправить', 'Показать всё', 'Не отправилось. Попробуй ещё раз.', 'Ты'],
  tr: ['Günün Moment’ı', 'Bugün {n} kişi yanıtladı', 'Yanıtla, buddy’lerinin ve herkesin ne dediğini gör.', 'Yanıtın…', 'Paylaş', 'Buddy', 'Yanıtla', '{n} kişisine yanıt…', 'Gönder', 'Tümünü göster', 'Gitmedi. Tekrar dene.', 'Sen'],
  uk: ['Daily Moment', 'Сьогодні відповіли: {n}', 'Відповідай, щоб побачити, що сказали твої buddies та інші.', 'Твоя відповідь…', 'Поділитися', 'Buddy', 'Відповісти', 'Відповідь для {n}…', 'Надіслати', 'Показати все', 'Не вийшло. Спробуй ще раз.', 'Ти'],
  zh: ['今日 Moment', '今天有 {n} 人回答', '先回答，才能看到你的 Buddy 和大家说了什么。', '你的回答…', '分享', 'Buddy', '回复', '回复 {n}…', '发送', '查看全部', '没有成功，再试一次。', '你'],
};
const K = ['title', 'count', 'locked', 'ph', 'share', 'buddy', 'reply', 'replyTo', 'send', 'all', 'err', 'you'];
const w = (lang, k, v) => {
  const i = K.indexOf(k);
  let s = (S[lang] || S.en)[i] || S.en[i] || '';
  Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', String(v[x])); });
  return s;
};
/* the two faces of the card */
const FLIP = { en: ['See what everyone said', 'Your answer'], ar: ['شوف الناس قالت إيه', 'إجابتك'], cs: ['Co řekli ostatní', 'Tvoje odpověď'], es: ['Ver qué dijeron todos', 'Tu respuesta'],
  et: ['Vaata, mida teised ütlesid', 'Sinu vastus'], fr: ['Voir ce que tout le monde a dit', 'Ta réponse'], hi: ['देखो सबने क्या कहा', 'तुम्हारा जवाब'], it: ['Guarda cosa hanno detto tutti', 'La tua risposta'],
  ja: ['みんなの答えを見る', 'あなたの答え'], ko: ['모두의 답 보기', '내 답'], nl: ['Zie wat iedereen zei', 'Jouw antwoord'], pt: ['Ver o que todos disseram', 'A tua resposta'],
  ro: ['Vezi ce au spus toți', 'Răspunsul tău'], ru: ['Что ответили все', 'Твой ответ'], tr: ['Herkes ne dedi, gör', 'Yanıtın'], uk: ['Що відповіли всі', 'Твоя відповідь'], zh: ['看看大家怎么说', '你的回答'] };
const fw = (lang, i) => (FLIP[lang] || FLIP.en)[i];
const opt = (o, lang) => (lang === 'ar' && o[1] ? o[1] : o[0]);

const Bar = ({ label, pct, mine }) => {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(grow, { toValue: pct, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row' }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: mine ? '700' : '500', flex: 1 }} numberOfLines={1}>{label}</Text>
        <Text style={[{ color: mine ? C.purple : C.dim, fontSize: 13, fontWeight: '600' }, NUM]}>{pct + '%'}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.glassHi, marginTop: 6, overflow: 'hidden' }}>
        <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: C.purple, opacity: mine ? 1 : 0.45, width: grow.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  );
};

const Answer = ({ a, q, lang, onReact, onReply }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const said = [a.choice != null && q.opts && q.opts[a.choice] ? opt(q.opts[a.choice], lang) : null, a.body].filter(Boolean).join(' — ');
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Face uri={a.user.avatar_url} name={a.user.name} size={30} />
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '600', marginStart: 10, flexShrink: 1 }} numberOfLines={1}>{a.me ? w(lang, 'you') : a.user.name}</Text>
        {a.buddy ? <Text style={{ color: C.purple, fontSize: 11.5, fontWeight: '700', marginStart: 8 }}>{w(lang, 'buddy').toUpperCase()}</Text> : null}
      </View>
      <Text style={{ color: C.text, fontSize: 15, lineHeight: 21, marginTop: 6 }}>{said}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        {EMO.map((e) => {
          const n = (a.reactions && a.reactions[e]) || 0;
          const on = a.my_reaction === e;
          return (
            <Pressable key={e} onPress={() => onReact(a, on ? null : e)} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={4} style={{ marginEnd: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: on ? C.purpleSoft : 'transparent', borderWidth: 1, borderColor: on ? C.purple : C.line }}>
                <Text style={{ fontSize: 13 }}>{e}</Text>
                {n ? <Text style={[{ color: C.dim, fontSize: 12, marginStart: 4 }, NUM]}>{n}</Text> : null}
              </View>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        {a.can_reply ? (
          <Pressable onPress={() => { tapLight(); setOpen((o) => !o); }} accessibilityRole="button" hitSlop={6}>
            <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '600' }}>{w(lang, 'reply')}</Text>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <TextInput value={draft} onChangeText={setDraft} placeholder={w(lang, 'replyTo', { n: a.user.name })} placeholderTextColor={C.faint} maxLength={500}
            style={{ flex: 1, color: C.text, fontSize: 14.5, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.bg, textAlign: lang === 'ar' ? 'right' : 'left' }} />
          <Pressable onPress={() => { if (draft.trim().length >= 2) onReply(a, draft.trim()); }} accessibilityRole="button" style={{ marginStart: 8 }}>
            <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.purple }}>
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '600' }}>{w(lang, 'send')}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

export const DailyMoment = () => {
  const { lang } = useLang();
  const { user } = useAuth();
  const [q, setQ] = useState(null);
  const [draft, setDraft] = useState('');
  const [all, setAll] = useState(false);
  const [err, setErr] = useState(null);
  const [thread, setThread] = useState(null);
  /* Ayser: "تبقى زي كارت بتقلب". Answered, the card rests small on its
     front — the question and your answer — and turns over to show what
     everybody said. Answering turns it over by itself, once. */
  const [back, setBack] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  const flip = (to) => {
    tapLight();
    Animated.timing(turn, { toValue: 1, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setBack(to); turn.setValue(-1);
      Animated.timing(turn, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
  };
  useEffect(() => { if (user) dailyMoment().then((x) => x && x.ok && setQ(x)); }, [user]);
  if (!q) return null;

  const answer = async (choice) => {
    const body = draft.trim();
    if (q.kind === 'text' && body.length < 2) return;
    tapMedium(); setErr(null);
    const x = await dailyAnswer(choice, body || null);
    if (x && x.ok && x.answered) { tapSuccess(); setQ(x); setDraft(''); setTimeout(() => flip(true), 250); } else setErr(w(lang, 'err'));
  };
  const react = async (a, e) => {
    tapSelection();
    setQ((o) => ({ ...o, answers: o.answers.map((y) => {
      if (y.id !== a.id) return y;
      const r = { ...(y.reactions || {}) };
      if (y.my_reaction) r[y.my_reaction] = Math.max(0, (r[y.my_reaction] || 1) - 1);
      if (e) r[e] = (r[e] || 0) + 1;
      return { ...y, reactions: r, my_reaction: e };
    }) }));
    await dailyReact(a.id, e);
  };
  /* a reply starts a chat: checked people, inside the 14-day founding pass
     (or members). Each "not yet" says what to do (RUN_ME.sql, dm_open) */
  const reply = async (a, body) => {
    tapMedium();
    const r = await dmOpen({ to: a.user.id, answerId: a.id, body });
    if (r && r.ok) { tapSuccess(); setThread(r.thread_id); return; }
    const why = r && r.reason;
    if (why === 'verify') { askSafety(); return; }
    if (why === 'pass_over') { setErr(PASS[lang === 'ar' ? 'ar' : 'en'].over); askUpgrade('member'); return; }
    if (why === 'answer_first') { setErr(PASS[lang === 'ar' ? 'ar' : 'en'].first); return; }
    if (why !== 'plus') setErr(w(lang, 'err'));
  };

  const total = q.tallies ? q.tallies.reduce((s, n) => s + n, 0) : 0;
  const shown = q.answers ? (all ? q.answers : q.answers.slice(0, 4)) : [];
  const mineText = q.mine ? (q.mine.choice != null && q.opts ? opt(q.opts[q.mine.choice] || ['', ''], lang) : q.mine.body) : null;
  const rot = turn.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-90deg', '0deg', '90deg'] });
  return (
    <Animated.View style={{ marginTop: 24, borderRadius: 28, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 24,
      transform: [{ perspective: 1200 }, { rotateY: rot }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.purple, marginEnd: 8 }} />
        <Text style={{ color: C.purple, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, flex: 1 }}>{w(lang, 'title').toUpperCase()}</Text>
        <Text style={[{ color: C.dim, fontSize: 12 }, NUM]}>{w(lang, 'count', { n: q.count })}</Text>
      </View>
      <Text style={{ color: C.text, fontSize: 21, fontWeight: '700', letterSpacing: -0.5, lineHeight: 27, marginTop: 10 }}>{lang === 'ar' && q.q_ar ? q.q_ar : q.q}</Text>

      {!q.answered ? (
        <>
          {q.kind === 'poll' ? (
            <View style={{ marginTop: 12 }}>
              {(q.opts || []).map((o, i) => (
                <Pressable key={i} onPress={() => answer(i)} accessibilityRole="button" style={{ marginTop: 8 }}>
                  <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, paddingVertical: 13, paddingHorizontal: 16 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '500' }}>{opt(o, lang)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <TextInput value={draft} onChangeText={setDraft} placeholder={w(lang, 'ph')} placeholderTextColor={C.faint} maxLength={140} onSubmitEditing={() => answer(null)}
                style={{ flex: 1, color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.bg, textAlign: lang === 'ar' ? 'right' : 'left' }} />
              <Pressable onPress={() => answer(null)} accessibilityRole="button" style={{ marginStart: 8 }}>
                <View style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: C.purple }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>{w(lang, 'share')}</Text>
                </View>
              </Pressable>
            </View>
          )}
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 12 }}>{'🔒 ' + w(lang, 'locked')}</Text>
        </>
      ) : !back ? (
        /* the front: your answer, quietly */
        mineText ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <Text style={{ color: C.dim, fontSize: 13.5 }}>{fw(lang, 1) + ' · '}</Text>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{mineText}</Text>
          </View>
        ) : null
      ) : (
        <>
          {q.kind === 'poll' && q.tallies ? (q.opts || []).map((o, i) => (
            <Bar key={i} label={opt(o, lang)} pct={total ? Math.round((q.tallies[i] / total) * 100) : 0} mine={q.mine && q.mine.choice === i} />
          )) : null}
          <View style={{ marginTop: 14 }}>
            {shown.map((a) => <Answer key={a.id} a={a} q={q} lang={lang} onReact={react} onReply={reply} />)}
          </View>
          {q.answers && q.answers.length > 4 && !all ? (
            <Pressable onPress={() => { tapLight(); setAll(true); }} accessibilityRole="button">
              <Text style={{ color: C.purple, fontSize: 14, fontWeight: '600', marginTop: 8 }}>{w(lang, 'all')}</Text>
            </Pressable>
          ) : null}
        </>
      )}
      {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
      {q.answered ? (
        <Pressable onPress={() => flip(!back)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.purpleSoft }}>
            <Ionicons name="sync-outline" size={15} color={C.purple} />
            <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '700', marginStart: 6 }}>{back ? fw(lang, 1) : fw(lang, 0)}</Text>
          </View>
        </Pressable>
      ) : null}
      {thread ? <BuddiesSheet threadId={thread} onClose={() => setThread(null)} /> : null}
    </Animated.View>
  );
};
