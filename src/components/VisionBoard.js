import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { readCompass } from './Compass';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── THE VISION BOARD, ON TOP OF YOUR DAY ───────────────────────────
   Ayser: "Vision board on Papyrus تبقى باينة في الـ todo list، ويبقى
   Papyrus … يعرض عليك تعديلات في يومك عشان توصل لحلمك".

   The dreams you tapped in your compass, as cards at the top of My day —
   your own photo on each if you add one. Under every dream, Papyrus's
   one small step for today; one tap and it is placed in a real gap of
   your day, like the rest of your life (visionBlocks below, used by
   todayItems in MyDay.js). Everything stays on this phone.

   Its words live here rather than in the app-wide strings: My day is
   opened from Profile, so they load only when somebody opens it. */

const S = {
  en: { title: 'Vision board', sub: 'Your dreams — and one step toward them today', today: 'Papyrus · today', add: 'Add to my day', added: 'In your day ✓', photo: 'Photo', empty: 'Pin your dreams here. Papyrus finds one small step a day.', pick: 'Choose my dreams', own: 'My dream',
    family: 'Call someone in your family', travel: 'Put a little aside for the trip', home: 'Save a little toward your home', business: '30 minutes on your idea', degree: '25 minutes of study', fit: 'A 20-minute walk or workout', language: '15 minutes of the language', give: 'One kind thing for someone', step: 'One small step toward it' },
  ar: { title: 'لوحة أحلامك', sub: 'أحلامك — وخطوة صغيرة ليها النهارده', today: 'Papyrus · النهارده', add: 'حطها في يومي', added: 'في يومك ✓', photo: 'صورة', empty: 'ثبّت أحلامك هنا، وPapyrus يلاقيلك خطوة صغيرة كل يوم.', pick: 'اختار أحلامي', own: 'حلمي',
    family: 'كلّم حد من عيلتك', travel: 'حوّش حاجة بسيطة للسفرية', home: 'حوّش حاجة بسيطة لبيتك', business: '30 دقيقة على فكرتك', degree: '25 دقيقة مذاكرة', fit: 'مشي أو تمرين 20 دقيقة', language: '15 دقيقة في اللغة', give: 'حاجة حلوة لحد', step: 'خطوة صغيرة ليه' },
  cs: { title: 'Nástěnka snů', sub: 'Tvoje sny — a dnes jeden krok k nim', today: 'Papyrus · dnes', add: 'Přidat do dne', added: 'Ve tvém dni ✓', photo: 'Foto', empty: 'Připni sem své sny. Papyrus najde jeden malý krok denně.', pick: 'Vybrat sny', own: 'Můj sen',
    family: 'Zavolej někomu z rodiny', travel: 'Odlož si trochu na cestu', home: 'Odlož si trochu na bydlení', business: '30 minut na tvém nápadu', degree: '25 minut učení', fit: '20 minut chůze nebo cvičení', language: '15 minut jazyka', give: 'Něco hezkého pro někoho', step: 'Jeden malý krok' },
  es: { title: 'Tablero de sueños', sub: 'Tus sueños — y un paso hacia ellos hoy', today: 'Papyrus · hoy', add: 'Añadir a mi día', added: 'En tu día ✓', photo: 'Foto', empty: 'Fija aquí tus sueños. Papyrus encuentra un pequeño paso al día.', pick: 'Elegir mis sueños', own: 'Mi sueño',
    family: 'Llama a alguien de tu familia', travel: 'Aparta un poco para el viaje', home: 'Ahorra un poco para tu casa', business: '30 minutos en tu idea', degree: '25 minutos de estudio', fit: '20 minutos de paseo o ejercicio', language: '15 minutos del idioma', give: 'Algo amable por alguien', step: 'Un pequeño paso' },
  et: { title: 'Unistuste tahvel', sub: 'Sinu unistused — ja täna üks samm nende poole', today: 'Papyrus · täna', add: 'Lisa päeva', added: 'Sinu päevas ✓', photo: 'Foto', empty: 'Kinnita siia oma unistused. Papyrus leiab iga päev ühe väikese sammu.', pick: 'Vali unistused', own: 'Minu unistus',
    family: 'Helista kellelegi perest', travel: 'Pane reisiks natuke kõrvale', home: 'Pane koduks natuke kõrvale', business: '30 minutit oma ideega', degree: '25 minutit õppimist', fit: '20 minutit kõndi või trenni', language: '15 minutit keelt', give: 'Midagi head kellelegi', step: 'Üks väike samm' },
  fr: { title: 'Tableau de rêves', sub: 'Tes rêves — et un pas vers eux aujourd’hui', today: 'Papyrus · aujourd’hui', add: 'Ajouter à ma journée', added: 'Dans ta journée ✓', photo: 'Photo', empty: 'Épingle tes rêves ici. Papyrus trouve un petit pas par jour.', pick: 'Choisir mes rêves', own: 'Mon rêve',
    family: 'Appelle quelqu’un de ta famille', travel: 'Mets un peu de côté pour le voyage', home: 'Mets un peu de côté pour ta maison', business: '30 minutes sur ton idée', degree: '25 minutes d’étude', fit: '20 minutes de marche ou de sport', language: '15 minutes de langue', give: 'Un geste gentil pour quelqu’un', step: 'Un petit pas' },
  hi: { title: 'सपनों का बोर्ड', sub: 'तुम्हारे सपने — और आज उनकी ओर एक कदम', today: 'Papyrus · आज', add: 'मेरे दिन में जोड़ो', added: 'तुम्हारे दिन में ✓', photo: 'फ़ोटो', empty: 'अपने सपने यहाँ लगाओ। Papyrus हर दिन एक छोटा कदम ढूँढेगा।', pick: 'मेरे सपने चुनो', own: 'मेरा सपना',
    family: 'परिवार में किसी को फ़ोन करो', travel: 'यात्रा के लिए थोड़ा बचाओ', home: 'घर के लिए थोड़ा बचाओ', business: 'अपने आइडिया पर 30 मिनट', degree: '25 मिनट पढ़ाई', fit: '20 मिनट सैर या कसरत', language: 'भाषा के 15 मिनट', give: 'किसी के लिए कुछ अच्छा', step: 'एक छोटा कदम' },
  it: { title: 'Bacheca dei sogni', sub: 'I tuoi sogni — e oggi un passo verso di loro', today: 'Papyrus · oggi', add: 'Aggiungi alla giornata', added: 'Nella tua giornata ✓', photo: 'Foto', empty: 'Appunta qui i tuoi sogni. Papyrus trova un piccolo passo al giorno.', pick: 'Scegli i miei sogni', own: 'Il mio sogno',
    family: 'Chiama qualcuno della famiglia', travel: 'Metti da parte un po’ per il viaggio', home: 'Metti da parte un po’ per la casa', business: '30 minuti sulla tua idea', degree: '25 minuti di studio', fit: '20 minuti di camminata o allenamento', language: '15 minuti di lingua', give: 'Un gesto gentile per qualcuno', step: 'Un piccolo passo' },
  ja: { title: '夢のボード', sub: 'あなたの夢と、今日の一歩', today: 'Papyrus · 今日', add: '今日に入れる', added: '今日の予定に ✓', photo: '写真', empty: '夢をここに貼ろう。Papyrus が毎日小さな一歩を見つけます。', pick: '夢を選ぶ', own: '私の夢',
    family: '家族の誰かに電話', travel: '旅のために少し貯める', home: '家のために少し貯める', business: 'アイデアに30分', degree: '勉強25分', fit: '散歩か運動を20分', language: '語学を15分', give: '誰かに親切をひとつ', step: '小さな一歩' },
  ko: { title: '비전 보드', sub: '나의 꿈 — 그리고 오늘의 한 걸음', today: 'Papyrus · 오늘', add: '오늘에 넣기', added: '오늘 일정에 ✓', photo: '사진', empty: '꿈을 여기에 붙여요. Papyrus가 매일 작은 한 걸음을 찾아줘요.', pick: '꿈 고르기', own: '나의 꿈',
    family: '가족에게 전화하기', travel: '여행을 위해 조금 모으기', home: '집을 위해 조금 모으기', business: '아이디어에 30분', degree: '공부 25분', fit: '산책이나 운동 20분', language: '언어 15분', give: '누군가에게 친절 하나', step: '작은 한 걸음' },
  nl: { title: 'Droombord', sub: 'Je dromen — en vandaag één stap ernaartoe', today: 'Papyrus · vandaag', add: 'Aan mijn dag toevoegen', added: 'In je dag ✓', photo: 'Foto', empty: 'Pin hier je dromen. Papyrus vindt elke dag één kleine stap.', pick: 'Mijn dromen kiezen', own: 'Mijn droom',
    family: 'Bel iemand uit je familie', travel: 'Zet iets opzij voor de reis', home: 'Zet iets opzij voor je huis', business: '30 minuten aan je idee', degree: '25 minuten studeren', fit: '20 minuten wandelen of sporten', language: '15 minuten taal', give: 'Iets liefs voor iemand', step: 'Eén kleine stap' },
  pt: { title: 'Quadro de sonhos', sub: 'Os teus sonhos — e um passo hoje', today: 'Papyrus · hoje', add: 'Pôr no meu dia', added: 'No teu dia ✓', photo: 'Foto', empty: 'Afixa aqui os teus sonhos. O Papyrus encontra um pequeno passo por dia.', pick: 'Escolher sonhos', own: 'O meu sonho',
    family: 'Liga a alguém da família', travel: 'Guarda um pouco para a viagem', home: 'Guarda um pouco para a casa', business: '30 minutos na tua ideia', degree: '25 minutos de estudo', fit: '20 minutos de caminhada ou treino', language: '15 minutos da língua', give: 'Um gesto bonito por alguém', step: 'Um pequeno passo' },
  ro: { title: 'Panoul viselor', sub: 'Visele tale — și un pas spre ele azi', today: 'Papyrus · azi', add: 'Pune în ziua mea', added: 'În ziua ta ✓', photo: 'Foto', empty: 'Prinde aici visele tale. Papyrus găsește un pas mic pe zi.', pick: 'Alege visele', own: 'Visul meu',
    family: 'Sună pe cineva din familie', travel: 'Pune puțin deoparte pentru călătorie', home: 'Pune puțin deoparte pentru casă', business: '30 de minute pe ideea ta', degree: '25 de minute de studiu', fit: '20 de minute de mers sau sport', language: '15 minute de limbă', give: 'Ceva frumos pentru cineva', step: 'Un pas mic' },
  uk: { title: 'Дошка мрій', sub: 'Твої мрії — і сьогодні один крок до них', today: 'Papyrus · сьогодні', add: 'У мій день', added: 'У твоєму дні ✓', photo: 'Фото', empty: 'Прикріпи сюди свої мрії. Papyrus знайде маленький крок на кожен день.', pick: 'Обрати мої мрії', own: 'Моя мрія',
    family: 'Подзвони комусь із родини', travel: 'Відклади трохи на подорож', home: 'Відклади трохи на дім', business: '30 хвилин на твою ідею', degree: '25 хвилин навчання', fit: '20 хвилин прогулянки чи тренування', language: '15 хвилин мови', give: 'Щось добре для когось', step: 'Один маленький крок' },
  ru: { title: 'Доска мечты', sub: 'Твои мечты — и сегодня один шаг к ним', today: 'Papyrus · сегодня', add: 'В мой день', added: 'В твоём дне ✓', photo: 'Фото', empty: 'Прикрепи сюда мечты. Papyrus найдёт маленький шаг на каждый день.', pick: 'Выбрать мечты', own: 'Моя мечта',
    family: 'Позвони кому-то из семьи', travel: 'Отложи немного на поездку', home: 'Отложи немного на дом', business: '30 минут на твою идею', degree: '25 минут учёбы', fit: '20 минут прогулки или спорта', language: '15 минут языка', give: 'Что-то доброе для кого-то', step: 'Маленький шаг' },
  tr: { title: 'Hayal panosu', sub: 'Hayallerin — ve bugün onlara bir adım', today: 'Papyrus · bugün', add: 'Günüme ekle', added: 'Gününde ✓', photo: 'Fotoğraf', empty: 'Hayallerini buraya iliştir. Papyrus her gün küçük bir adım bulur.', pick: 'Hayallerimi seç', own: 'Hayalim',
    family: 'Ailenden birini ara', travel: 'Yolculuk için biraz ayır', home: 'Evin için biraz ayır', business: 'Fikrine 30 dakika', degree: '25 dakika ders', fit: '20 dakika yürüyüş ya da spor', language: '15 dakika dil', give: 'Biri için güzel bir şey', step: 'Küçük bir adım' },
  zh: { title: '愿景板', sub: '你的梦想——以及今天的一小步', today: 'Papyrus · 今天', add: '加入今天', added: '已在今天 ✓', photo: '照片', empty: '把梦想钉在这里，Papyrus 每天帮你找一小步。', pick: '选择我的梦想', own: '我的梦想',
    family: '给家人打个电话', travel: '为旅行存一点钱', home: '为家存一点钱', business: '花30分钟在你的想法上', degree: '学习25分钟', fit: '散步或锻炼20分钟', language: '语言练习15分钟', give: '为别人做件好事', step: '一小步' },
};
export const vs = (lang, k) => ((S[lang] && S[lang][k]) || S.en[k]);

/* each dream → the small thing worth doing for it today, and when it fits */
const STEPS = {
  family: { emoji: '📞', min: 10, prefer: [[19, 21.5]] },
  travel: { emoji: '✈️', min: 10, prefer: [[20, 22.5]] },
  home: { emoji: '🏡', min: 10, prefer: [[20, 22.5]] },
  business: { emoji: '🚀', min: 30, prefer: [[20, 22.5], [7, 9]] },
  degree: { emoji: '🎓', min: 25, prefer: [[17, 21]] },
  fit: { emoji: '💪', min: 20, prefer: [[17, 20.5], [6.5, 9]] },
  language: { emoji: '🗣️', min: 15, prefer: [[20, 22.5], [12, 14]] },
  give: { emoji: '🤲', min: 10, prefer: [[12, 20]] },
  own: { emoji: '✨', min: 15, prefer: [[20, 22.5]] },
};
const EMOJI = { family: '👨‍👩‍👧‍👦', travel: '✈️', home: '🏡', business: '🚀', degree: '🎓', fit: '💪', language: '🗣️', give: '🤲', own: '✨' };
const TINT = ['#EFEDFF', '#E5F4E4', '#F9EEDA', '#E7F1FB', '#FBEBEB', '#F9ECE7'];

const dayKey = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const ADD = () => 'mm.vision.add.' + dayKey();
const PHOTO = (id) => 'mm.vision.photo.' + id;
const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const photoOf = (id) => { try { return localStorage.getItem(PHOTO(id)) || null; } catch (e) { return null; } };

const dreamsOf = (c) => (c.dreams || []).concat(c.dream ? ['own'] : []);

/* the steps you said yes to today ({ id, label } — the words kept in the
   language they were chosen in), as blocks My day places in real gaps */
export const visionBlocks = () => rd(ADD(), []).map((x) => {
  const s = x && STEPS[x.id];
  return s ? { id: 'vis:' + x.id, min: s.min, prefer: s.prefer, emoji: s.emoji, label: x.label } : null;
}).filter(Boolean);

/* a photo from the phone, made small enough to live in this phone's storage */
const pickPhoto = () => new Promise((resolve) => {
  if (typeof document === 'undefined') return resolve(null);
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  input.onchange = () => {
    const f = input.files && input.files[0]; input.remove();
    if (!f) return resolve(null);
    const img = new window.Image();
    img.onload = () => {
      const w = 420, h = Math.round((img.height / img.width) * w) || 420;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(f);
  };
  document.body.appendChild(input); input.click();
  return undefined;
});

export const VisionBoard = ({ t, lang, onPick, onChanged }) => {
  const c = readCompass();
  const dreams = dreamsOf(c);
  const [added, setAdded] = useState(() => rd(ADD(), []).map((x) => x && x.id));
  const [, bump] = useState(0);
  const add = (id) => {
    if (added.indexOf(id) >= 0) return;
    tapSuccess();
    setAdded(added.concat(id));
    try { localStorage.setItem(ADD(), JSON.stringify(rd(ADD(), []).concat({ id, label: vs(lang, id === 'own' ? 'step' : id) }))); } catch (e) {}
    if (onChanged) onChanged();
  };
  const setPhoto = async (id) => {
    tapLight();
    const url = await pickPhoto();
    if (!url) return;
    try { localStorage.setItem(PHOTO(id), url); } catch (e) { return; }   // the phone is full: no photo, nothing broken
    bump((v) => v + 1);
  };

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1 }}>{('🌠 ' + vs(lang, 'title')).toUpperCase()}</Text>
      {!dreams.length ? (
        <Pressable onPress={() => { tapLight(); onPick(); }} accessibilityRole="button" style={{ marginTop: 8 }}>
          <View style={{ borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: C.dim, fontSize: 13.5, textAlign: 'center', lineHeight: 19 }}>{vs(lang, 'empty')}</Text>
            <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900', marginTop: 8 }}>{'🧭 ' + vs(lang, 'pick')}</Text>
          </View>
        </Pressable>
      ) : (
        <>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2, marginBottom: 8 }}>{vs(lang, 'sub')}</Text>
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingEnd: 8 }}>
            {dreams.map((id, i) => {
              const pic = photoOf(id);
              const on = added.indexOf(id) >= 0;
              return (
                <View key={id} style={{ width: 196, marginEnd: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: C.glass }}>
                  <Pressable onPress={() => setPhoto(id)} accessibilityRole="button" accessibilityLabel={vs(lang, 'photo')}>
                    <View style={{ height: 112, backgroundColor: TINT[i % TINT.length], alignItems: 'center', justifyContent: 'center' }}>
                      {pic ? <Image source={{ uri: pic }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : <Text style={{ fontSize: 42 }}>{EMOJI[id] || '✨'}</Text>}
                      <View style={{ position: 'absolute', top: 8, end: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="camera-outline" size={15} color="#FFF" />
                      </View>
                    </View>
                  </Pressable>
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }} numberOfLines={2}>{id === 'own' ? c.dream : t('cp_d_' + id)}</Text>
                    <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8, marginTop: 8 }}>{vs(lang, 'today').toUpperCase()}</Text>
                    <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{STEPS[id].emoji + ' ' + vs(lang, id === 'own' ? 'step' : id)}</Text>
                    <Pressable onPress={() => add(id)} disabled={on} accessibilityRole="button" style={{ marginTop: 10 }}>
                      <View style={{ borderRadius: 999, paddingVertical: 8, alignItems: 'center', backgroundColor: on ? C.greenSoft : C.purple }}>
                        <Text style={{ color: on ? C.green : '#FFF', fontSize: 12.5, fontWeight: '900' }}>{vs(lang, on ? 'added' : 'add')}</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
};
