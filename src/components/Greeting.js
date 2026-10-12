import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';

/* ─── HELLO, IN EVERY LANGUAGE MOMENTS SPEAKS ──────────────────────────
   Ayser: "hello … صباح الخير تبقي مكتوبه بلغات الابلكشن". Under the
   wordmark: the greeting for this time of day in your own language
   first, then the same greeting in the other fourteen, one at a time,
   fading. A small sign that people from everywhere are here. */
const G = {
  morning: { en: 'Good morning', ar: 'صباح الخير', es: 'Buenos días', fr: 'Bonjour', it: 'Buongiorno', pt: 'Bom dia', nl: 'Goedemorgen', ro: 'Bună dimineața', ru: 'Доброе утро', tr: 'Günaydın', cs: 'Dobré ráno', et: 'Tere hommikust', ja: 'おはよう', ko: '좋은 아침', zh: '早上好' },
  day: { en: 'Hello', ar: 'أهلًا', es: 'Hola', fr: 'Salut', it: 'Ciao', pt: 'Olá', nl: 'Hallo', ro: 'Salut', ru: 'Привет', tr: 'Merhaba', cs: 'Ahoj', et: 'Tere', ja: 'こんにちは', ko: '안녕하세요', zh: '你好' },
  evening: { en: 'Good evening', ar: 'مساء الخير', es: 'Buenas noches', fr: 'Bonsoir', it: 'Buonasera', pt: 'Boa noite', nl: 'Goedenavond', ro: 'Bună seara', ru: 'Добрый вечер', tr: 'İyi akşamlar', cs: 'Dobrý večer', et: 'Tere õhtust', ja: 'こんばんは', ko: '좋은 저녁', zh: '晚上好' },
};
const ORDER = ['en', 'ar', 'es', 'fr', 'it', 'pt', 'nl', 'ro', 'ru', 'tr', 'cs', 'et', 'ja', 'ko', 'zh'];

export const Greeting = () => {
  const { lang } = useLang();
  const h = new Date().getHours();
  const set = G[h < 12 ? 'morning' : h < 17 ? 'day' : 'evening'];
  const list = [lang, ...ORDER.filter((l) => l !== lang)].filter((l) => set[l]);
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setI((x) => (x + 1) % list.length);
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 2600);
    return () => clearInterval(id);
  }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={{ opacity: fade }}>
      <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '700', marginTop: 2 }}>{set[list[i]] + ' 👋'}</Text>
    </Animated.View>
  );
};
