import React from 'react';
import { Text } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';

/* ─── HELLO, IN EVERY LANGUAGE MOMENTS SPEAKS ──────────────────────────
   Ayser: "hello … صباح الخير تبقي مكتوبه بلغات الابلكشن". Under the
   wordmark: the greeting for this time of day in your own language
   first, then the same greeting in the other fourteen, one at a time,
   fading. A small sign that people from everywhere are here. */
const G = {
  morning: { en: 'Good morning', ar: 'صباح الخير', es: 'Buenos días', fr: 'Bonjour', it: 'Buongiorno', pt: 'Bom dia', nl: 'Goedemorgen', ro: 'Bună dimineața', ru: 'Доброе утро', tr: 'Günaydın', cs: 'Dobré ráno', et: 'Tere hommikust', hi: 'सुप्रभात', ja: 'おはよう', ko: '좋은 아침', zh: '早上好', uk: 'Доброго ранку' },
  day: { en: 'Hello', ar: 'أهلًا', es: 'Hola', fr: 'Salut', it: 'Ciao', pt: 'Olá', nl: 'Hallo', ro: 'Salut', ru: 'Привет', tr: 'Merhaba', cs: 'Ahoj', et: 'Tere', hi: 'नमस्ते', ja: 'こんにちは', ko: '안녕하세요', zh: '你好', uk: 'Привіт' },
  evening: { en: 'Good evening', ar: 'مساء الخير', es: 'Buenas noches', fr: 'Bonsoir', it: 'Buonasera', pt: 'Boa noite', nl: 'Goedenavond', ro: 'Bună seara', ru: 'Добрый вечер', tr: 'İyi akşamlar', cs: 'Dobrý večer', et: 'Tere õhtust', hi: 'शुभ संध्या', ja: 'こんばんは', ko: '좋은 저녁', zh: '晚上好', uk: 'Добрий вечір' },
};

/* Ayser, later: the whole app in your language, as if it were made in it —
   so only your own hello now, not a tour of the others; and no emoji */
export const Greeting = ({ name }) => {
  const { lang } = useLang();
  const h = new Date().getHours();
  const set = G[h < 12 ? 'morning' : h < 17 ? 'day' : 'evening'];
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const hello = set[lang] || set.en;
  return (
    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
      {hello + (first ? (lang === 'ar' ? ' يا ' : ', ') + first : '')}
    </Text>
  );
};
