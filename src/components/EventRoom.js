import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { eventRoom, eventPin, classRoomJoin, classRoomLeave, classRoomEnd, classRoomState } from '../services/eventRooms';
import { fetchMessages, sendMessage, subscribeMessages } from '../services/messages';
import { joinMesh } from '../lib/talkMesh';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { eventExtras, eventCheckin } from '../services/live';
import { ActivitiesHub, AfterParty } from './ActivitiesHub';

/* ─── THE EVENT PAGE ──────────────────────────────────────────────────
   Ayser: "No endless chatting — subscribe, book a seat, and meet in real
   life." So a booked event has exactly what gets you to the table:
     · how full it is (8/10 spots taken),
     · the host's pin — where, which table, the exact spot — read-only,
     · for an offline event, a short chat for the people going: it opens
       30 minutes before the start and is read-only once it is over;
     · for an online workshop, its room: it opens 15 minutes before the
       start for people who paid, and the moment the host ends it,
       everyone is out.
   The times and the doors are the server's (RUN_ME.sql, "NO ENDLESS
   CHAT"); this page shows them and asks again every few seconds.

   Then, Ayser's second step: the page is also where the table plays.
   People check in when they are there; the Live Activities (the card
   deck, two truths & a lie, roleplay) are for them; when it is over,
   Keep in touch and Vibe Badges, and the chat becomes a 24-hour Memory
   Capsule for short notes before it is archived, read-only, in the
   passport ("LIVE ACTIVITIES" in RUN_ME.sql). */

// check-in · checked in · the capsule · archived · seats left
const S2 = {
  en: ['Here already?', 'Check in', 'You are checked in.', 'Memory Capsule — open for 24 hours. Leave a short note.', 'Archived in your passport. Read-only now.', '{n} left', 'A short note…'],
  ar: ['وصلت؟', 'اعمل تشيك إن', 'عملت تشيك إن.', 'كبسولة الذكريات — مفتوحة ٢٤ ساعة. سيب كلمة صغيرة.', 'اتحفظت في الباسبور بتاعك. للقراية بس دلوقتي.', 'فاضل {n}', 'كلمة صغيرة…'],
  cs: ['Už jsi tady?', 'Přihlásit se', 'Jsi přihlášen/a.', 'Kapsle vzpomínek — otevřená 24 hodin. Nech krátký vzkaz.', 'Uloženo v pasu. Teď jen ke čtení.', 'Zbývá {n}', 'Krátký vzkaz…'],
  es: ['¿Ya estás aquí?', 'Hacer check-in', 'Ya hiciste check-in.', 'Cápsula de recuerdos: abierta 24 horas. Deja una nota corta.', 'Archivado en tu pasaporte. Solo lectura.', 'Quedan {n}', 'Una nota corta…'],
  et: ['Juba kohal?', 'Registreeru', 'Oled registreerunud.', 'Mälestuste kapsel — avatud 24 tundi. Jäta lühike märkus.', 'Arhiveeritud sinu passi. Nüüd ainult lugemiseks.', '{n} alles', 'Lühike märkus…'],
  fr: ['Déjà là ?', 'Faire mon check-in', 'Check-in fait.', 'Capsule souvenir — ouverte 24 heures. Laisse un petit mot.', 'Archivé dans ton passeport. Lecture seule.', 'Plus que {n}', 'Un petit mot…'],
  hi: ['पहुँच गए?', 'चेक-इन करो', 'तुम्हारा चेक-इन हो गया।', 'मेमोरी कैप्सूल — 24 घंटे खुला। एक छोटा नोट छोड़ो।', 'तुम्हारे पासपोर्ट में सेव। अब सिर्फ़ पढ़ने के लिए।', '{n} बाकी', 'एक छोटा नोट…'],
  it: ['Già qui?', 'Fai check-in', 'Check-in fatto.', 'Capsula dei ricordi: aperta 24 ore. Lascia una nota breve.', 'Archiviato nel tuo passaporto. Solo lettura.', 'Ne restano {n}', 'Una nota breve…'],
  ja: ['もう着いた？', 'チェックイン', 'チェックイン済みです。', 'メモリーカプセル — 24時間オープン。ひとことどうぞ。', 'パスポートに保存されました。読むだけです。', '残り{n}', 'ひとこと…'],
  ko: ['벌써 왔어요?', '체크인', '체크인했어요.', '메모리 캡슐 — 24시간 열려 있어요. 짧은 메모를 남겨 주세요.', '패스포트에 보관됐어요. 이제 읽기만 돼요.', '{n}자리 남음', '짧은 메모…'],
  nl: ['Al hier?', 'Inchecken', 'Je bent ingecheckt.', 'Herinneringscapsule — 24 uur open. Laat een kort berichtje achter.', 'Gearchiveerd in je paspoort. Nu alleen lezen.', 'Nog {n}', 'Een kort berichtje…'],
  pt: ['Já chegaste?', 'Fazer check-in', 'Check-in feito.', 'Cápsula de memórias — aberta 24 horas. Deixa uma nota curta.', 'Arquivado no teu passaporte. Só leitura.', 'Faltam {n}', 'Uma nota curta…'],
  ro: ['Ai ajuns deja?', 'Fă check-in', 'Ai făcut check-in.', 'Capsula amintirilor — deschisă 24 de ore. Lasă o notă scurtă.', 'Arhivat în pașaportul tău. Doar citire.', 'Mai sunt {n}', 'O notă scurtă…'],
  ru: ['Уже на месте?', 'Отметиться', 'Ты отметился(-ась).', 'Капсула памяти — открыта 24 часа. Оставь короткую заметку.', 'Сохранено в паспорте. Теперь только чтение.', 'Осталось {n}', 'Короткая заметка…'],
  tr: ['Geldin mi?', 'Giriş yap', 'Giriş yaptın.', 'Anı kapsülü — 24 saat açık. Kısa bir not bırak.', 'Pasaportunda arşivlendi. Artık yalnızca okunur.', '{n} yer kaldı', 'Kısa bir not…'],
  uk: ['Вже на місці?', 'Відмітитися', 'Ти відмітився(-лася).', 'Капсула спогадів — відкрита 24 години. Залиш коротку нотатку.', 'Збережено в паспорті. Тепер лише читання.', 'Залишилось {n}', 'Коротка нотатка…'],
  zh: ['已经到了？', '签到', '你已签到。', '回忆胶囊——开放 24 小时，留一句话吧。', '已存入你的护照，现在只能阅读。', '还剩 {n} 个', '留一句话…'],
};
const w2 = (lang, i, v) => String(((S2[lang] || S2.en)[i]) || S2.en[i]).replace('{n}', v == null ? '' : String(v));

const S = {
  en: ['{n}/{t} spots taken', '{n} going', 'From the host', 'The host will pin where to meet here.', 'Arrival details — table, exact spot, what to look for', 'Pin it', 'The people going', 'Opens 30 minutes before the start, to find each other.', 'It is over — the chat stays here to read.', 'Write to the group…', 'Workshop room', 'Opens 15 minutes before the start.', 'Join the room', 'The host ended the workshop.', 'The room is for people who paid.', 'Leave', 'End the workshop for everyone', 'Mute', 'Unmute', '{n} in the room', 'Allow the microphone to join.', 'It did not go through. Try again.'],
  ar: ['{n}/{t} أماكن اتحجزت', '{n} رايحين', 'من المنظّم', 'المنظّم هيثبّت هنا مكان التجمّع.', 'تفاصيل الوصول — رقم الترابيزة، المكان بالظبط، تدوّروا على إيه', 'ثبّتها', 'اللي رايحين', 'بيفتح قبل البداية بنص ساعة، عشان تلاقوا بعض.', 'الخروجة خلصت — الشات فاضل للقراية بس.', 'اكتب للجروب…', 'غرفة الورشة', 'بتفتح قبل الميعاد بربع ساعة.', 'ادخل الغرفة', 'المنظّم قفل الورشة.', 'الغرفة للي دفعوا بس.', 'اخرج', 'اقفل الورشة للكل', 'كتم', 'فك الكتم', '{n} في الغرفة', 'اسمح للمايك عشان تدخل.', 'ماتبعتش. جرّب تاني.'],
  cs: ['{n}/{t} míst obsazeno', '{n} jde', 'Od pořadatele', 'Pořadatel sem připne, kde se sejít.', 'Jak dorazit — stůl, přesné místo, co hledat', 'Připnout', 'Kdo jde', 'Otevře se 30 minut před začátkem, abyste se našli.', 'Je po všem — chat zůstává ke čtení.', 'Napiš skupině…', 'Místnost workshopu', 'Otevře se 15 minut před začátkem.', 'Vstoupit', 'Pořadatel workshop ukončil.', 'Místnost je pro ty, kdo zaplatili.', 'Odejít', 'Ukončit workshop pro všechny', 'Ztlumit', 'Zapnout zvuk', '{n} v místnosti', 'Povol mikrofon, abys mohl/a vstoupit.', 'Nepodařilo se. Zkus to znovu.'],
  es: ['{n}/{t} plazas ocupadas', '{n} van', 'Del anfitrión', 'El anfitrión fijará aquí dónde encontrarse.', 'Cómo llegar: mesa, lugar exacto, qué buscar', 'Fijar', 'Los que van', 'Se abre 30 minutos antes para encontraros.', 'Ya terminó: el chat queda para leer.', 'Escribe al grupo…', 'Sala del taller', 'Se abre 15 minutos antes.', 'Entrar a la sala', 'El anfitrión terminó el taller.', 'La sala es para quienes pagaron.', 'Salir', 'Terminar el taller para todos', 'Silenciar', 'Activar', '{n} en la sala', 'Permite el micrófono para entrar.', 'No se envió. Inténtalo de nuevo.'],
  et: ['{n}/{t} kohta täis', '{n} tuleb', 'Korraldajalt', 'Korraldaja kinnitab siia kohtumispaiga.', 'Kuidas jõuda — laud, täpne koht, mida otsida', 'Kinnita', 'Kes tulevad', 'Avaneb 30 minutit enne algust, et üksteist leida.', 'Läbi — vestlus jääb lugemiseks.', 'Kirjuta grupile…', 'Töötoa ruum', 'Avaneb 15 minutit enne algust.', 'Sisene', 'Korraldaja lõpetas töötoa.', 'Ruum on neile, kes maksid.', 'Lahku', 'Lõpeta töötuba kõigile', 'Vaigista', 'Heli sisse', '{n} ruumis', 'Luba mikrofon, et siseneda.', 'Ei läinud läbi. Proovi uuesti.'],
  fr: ['{n}/{t} places prises', '{n} y vont', 'De l’hôte', 'L’hôte épinglera ici où se retrouver.', 'Pour arriver — table, endroit exact, quoi chercher', 'Épingler', 'Ceux qui y vont', 'S’ouvre 30 minutes avant le début, pour se retrouver.', 'C’est fini — le chat reste à lire.', 'Écris au groupe…', 'Salle de l’atelier', 'S’ouvre 15 minutes avant le début.', 'Entrer', 'L’hôte a terminé l’atelier.', 'La salle est pour ceux qui ont payé.', 'Quitter', 'Terminer l’atelier pour tous', 'Couper le micro', 'Réactiver', '{n} dans la salle', 'Autorise le micro pour entrer.', 'Ça n’est pas passé. Réessaie.'],
  hi: ['{n}/{t} सीटें भर गईं', '{n} जा रहे हैं', 'होस्ट से', 'होस्ट यहाँ मिलने की जगह पिन करेंगे।', 'पहुँचने की जानकारी — टेबल, सही जगह, क्या ढूँढें', 'पिन करो', 'जो जा रहे हैं', 'शुरू होने से 30 मिनट पहले खुलता है, ताकि एक-दूसरे को ढूँढ सको।', 'ख़त्म हो गया — चैट सिर्फ़ पढ़ने के लिए है।', 'ग्रुप को लिखो…', 'वर्कशॉप रूम', 'शुरू होने से 15 मिनट पहले खुलेगा।', 'रूम में आओ', 'होस्ट ने वर्कशॉप ख़त्म कर दी।', 'रूम सिर्फ़ पैसे देने वालों के लिए है।', 'निकलो', 'सबके लिए वर्कशॉप ख़त्म करो', 'म्यूट', 'अनम्यूट', 'रूम में {n}', 'आने के लिए माइक की अनुमति दो।', 'नहीं गया। फिर कोशिश करो।'],
  it: ['{n}/{t} posti presi', '{n} ci vanno', 'Dall’host', 'L’host fisserà qui dove trovarsi.', 'Come arrivare — tavolo, punto esatto, cosa cercare', 'Fissa', 'Chi va', 'Si apre 30 minuti prima dell’inizio, per trovarvi.', 'È finita — la chat resta da leggere.', 'Scrivi al gruppo…', 'Stanza del workshop', 'Si apre 15 minuti prima dell’inizio.', 'Entra nella stanza', 'L’host ha chiuso il workshop.', 'La stanza è per chi ha pagato.', 'Esci', 'Chiudi il workshop per tutti', 'Muto', 'Riattiva', '{n} nella stanza', 'Consenti il microfono per entrare.', 'Non è andato. Riprova.'],
  ja: ['{t}席中{n}席うまっています', '{n}人参加', 'ホストから', '集合場所はホストがここに固定します。', '到着の案内 — テーブル番号、正確な場所、目印', '固定する', '参加する人', '開始30分前に開きます。お互いを見つけるために。', '終了しました — チャットは読むだけです。', 'グループに書く…', 'ワークショップルーム', '開始15分前に開きます。', 'ルームに入る', 'ホストがワークショップを終了しました。', 'ルームは支払い済みの人だけです。', '退出', '全員のワークショップを終了', 'ミュート', 'ミュート解除', 'ルームに{n}人', '入るにはマイクを許可してください。', '送れませんでした。もう一度どうぞ。'],
  ko: ['{t}자리 중 {n}자리 마감', '{n}명 참여', '호스트 안내', '호스트가 여기에 만날 곳을 고정할 거예요.', '도착 안내 — 테이블, 정확한 위치, 찾을 표시', '고정', '가는 사람들', '시작 30분 전에 열려요. 서로 찾을 수 있게.', '끝났어요 — 채팅은 읽기만 돼요.', '그룹에 쓰기…', '워크숍 방', '시작 15분 전에 열려요.', '방 들어가기', '호스트가 워크숍을 끝냈어요.', '방은 결제한 사람만 들어올 수 있어요.', '나가기', '모두의 워크숍 끝내기', '음소거', '음소거 해제', '방에 {n}명', '들어가려면 마이크를 허용해 주세요.', '전송되지 않았어요. 다시 해 주세요.'],
  nl: ['{n}/{t} plekken bezet', '{n} gaan', 'Van de host', 'De host pint hier waar jullie afspreken.', 'Hoe je er komt — tafel, exacte plek, waar je op let', 'Vastzetten', 'Wie er gaan', 'Gaat 30 minuten voor de start open, om elkaar te vinden.', 'Het is voorbij — de chat blijft om te lezen.', 'Schrijf naar de groep…', 'Workshopruimte', 'Gaat 15 minuten voor de start open.', 'Naar binnen', 'De host heeft de workshop beëindigd.', 'De ruimte is voor wie betaald heeft.', 'Verlaten', 'Workshop voor iedereen beëindigen', 'Dempen', 'Geluid aan', '{n} in de ruimte', 'Sta de microfoon toe om binnen te komen.', 'Het lukte niet. Probeer opnieuw.'],
  pt: ['{n}/{t} lugares ocupados', '{n} vão', 'Do anfitrião', 'O anfitrião vai fixar aqui onde se encontram.', 'Como chegar — mesa, sítio exato, o que procurar', 'Fixar', 'Quem vai', 'Abre 30 minutos antes do início, para se encontrarem.', 'Acabou — o chat fica para ler.', 'Escreve ao grupo…', 'Sala do workshop', 'Abre 15 minutos antes do início.', 'Entrar na sala', 'O anfitrião terminou o workshop.', 'A sala é para quem pagou.', 'Sair', 'Terminar o workshop para todos', 'Silenciar', 'Ativar som', '{n} na sala', 'Permite o microfone para entrar.', 'Não foi. Tenta outra vez.'],
  ro: ['{n}/{t} locuri ocupate', '{n} merg', 'De la gazdă', 'Gazda va fixa aici locul de întâlnire.', 'Cum ajungi — masa, locul exact, ce să cauți', 'Fixează', 'Cine merge', 'Se deschide cu 30 de minute înainte, ca să vă găsiți.', 'S-a terminat — chatul rămâne de citit.', 'Scrie grupului…', 'Camera atelierului', 'Se deschide cu 15 minute înainte.', 'Intră în cameră', 'Gazda a încheiat atelierul.', 'Camera e pentru cei care au plătit.', 'Ieși', 'Încheie atelierul pentru toți', 'Mut', 'Pornește sunetul', '{n} în cameră', 'Permite microfonul ca să intri.', 'Nu a mers. Încearcă din nou.'],
  ru: ['Занято {n} из {t} мест', 'Идут {n}', 'От организатора', 'Организатор закрепит здесь место встречи.', 'Как добраться — столик, точное место, что искать', 'Закрепить', 'Кто идёт', 'Откроется за 30 минут до начала, чтобы найти друг друга.', 'Всё прошло — чат остаётся для чтения.', 'Написать группе…', 'Комната мастер-класса', 'Откроется за 15 минут до начала.', 'Войти в комнату', 'Организатор завершил мастер-класс.', 'Комната для тех, кто оплатил.', 'Выйти', 'Завершить для всех', 'Выкл. звук', 'Вкл. звук', '{n} в комнате', 'Разреши микрофон, чтобы войти.', 'Не отправилось. Попробуй ещё раз.'],
  tr: ['{t} yerden {n} tanesi doldu', '{n} kişi gidiyor', 'Ev sahibinden', 'Buluşma yerini ev sahibi buraya sabitleyecek.', 'Varış bilgisi — masa, tam yer, neye bakmalı', 'Sabitle', 'Gidenler', 'Başlamadan 30 dakika önce açılır, birbirinizi bulmak için.', 'Bitti — sohbet okumak için kalıyor.', 'Gruba yaz…', 'Atölye odası', 'Başlamadan 15 dakika önce açılır.', 'Odaya gir', 'Ev sahibi atölyeyi bitirdi.', 'Oda ödeme yapanlar için.', 'Çık', 'Atölyeyi herkes için bitir', 'Sessize al', 'Sesi aç', 'Odada {n} kişi', 'Girmek için mikrofona izin ver.', 'Gitmedi. Tekrar dene.'],
  uk: ['Зайнято {n} з {t} місць', 'Ідуть {n}', 'Від організатора', 'Організатор закріпить тут місце зустрічі.', 'Як дістатися — столик, точне місце, що шукати', 'Закріпити', 'Хто йде', 'Відкриється за 30 хвилин до початку, щоб знайти одне одного.', 'Все минуло — чат лишається для читання.', 'Написати групі…', 'Кімната майстер-класу', 'Відкриється за 15 хвилин до початку.', 'Увійти в кімнату', 'Організатор завершив майстер-клас.', 'Кімната для тих, хто оплатив.', 'Вийти', 'Завершити для всіх', 'Вимкн. звук', 'Увімкн. звук', '{n} у кімнаті', 'Дозволь мікрофон, щоб увійти.', 'Не вийшло. Спробуй ще раз.'],
  zh: ['已订 {n}/{t} 个名额', '{n} 人参加', '来自主持人', '主持人会在这里置顶集合地点。', '到达信息——桌号、确切位置、找什么标志', '置顶', '参加的人', '开始前 30 分钟开放，方便你们找到彼此。', '已经结束——聊天仅供阅读。', '在群里说点什么…', '工作坊房间', '开始前 15 分钟开放。', '进入房间', '主持人已结束工作坊。', '房间只对已付款的人开放。', '离开', '为所有人结束工作坊', '静音', '取消静音', '房间里有 {n} 人', '允许使用麦克风才能进入。', '没有发送成功，再试一次。'],
};
const K = ['spots', 'going', 'pin', 'pinEmpty', 'pinPh', 'pinSave', 'chat', 'chatSoon', 'chatOver', 'say', 'call', 'callSoon', 'callJoin', 'callEnded', 'callPaid', 'leave', 'end', 'mute', 'unmute', 'here', 'mic', 'err'];
const w = (lang, k, v) => {
  const row = S[lang] || S.en; const i = K.indexOf(k);
  let s = row[i] || S.en[i] || '';
  Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', String(v[x])); });
  return s;
};
const when = (iso, lang) => {
  try { return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
};

/* the online workshop's room: audio over the same relay as the talk rooms */
const ClassRoom = ({ lang, room, onOut }) => {
  const { user } = useAuth();
  const mesh = useRef(null);
  const [people, setPeople] = useState([]);
  const [muted, setMuted] = useState(false);
  const [err, setErr] = useState(null);
  const out = (ended) => { if (mesh.current) { mesh.current.close(); mesh.current = null; } onOut(ended); };

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await classRoomJoin(room.id);
      if (!alive) return;
      if (!r || !r.ok) { onOut(r && r.reason === 'ended'); return; }
      const m = await joinMesh({ topic: 'class:' + room.id, me: { id: user.id, name: '' },
        onPeople: (list) => alive && setPeople(list), onError: (why) => alive && setErr(why) });
      if (!alive) { if (m) m.close(); return; }
      mesh.current = m;
    })();
    // the host may end it at any moment: ask, and leave the second it is over
    const h = setInterval(() => classRoomState(room.id).then((s) => { if (alive && s && s.open === false) out(true); }), 5000);
    return () => { alive = false; clearInterval(h); if (mesh.current) { mesh.current.close(); mesh.current = null; } classRoomLeave(room.id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ marginTop: 10, borderRadius: 18, padding: 16, backgroundColor: C.purpleSoft }}>
      <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{'● ' + w(lang, 'here', { n: people.length || 1 })}</Text>
      {err === 'mic' ? <Text style={{ color: C.coral, fontSize: 13.5, marginTop: 6 }}>{w(lang, 'mic')}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Pressable onPress={() => { tapLight(); const m = !muted; setMuted(m); if (mesh.current) mesh.current.setMuted(m); }} accessibilityRole="button" style={{ flex: 1, marginEnd: 8 }}>
          <View style={{ borderRadius: 999, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.purple }}>
            <Text style={{ color: C.purple, fontSize: 14, fontWeight: '800' }}>{w(lang, muted ? 'unmute' : 'mute')}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => { tapLight(); out(false); }} accessibilityRole="button" style={{ flex: 1 }}>
          <View style={{ borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: C.text }}>
            <Text style={{ color: C.bg, fontSize: 14, fontWeight: '800' }}>{w(lang, 'leave')}</Text>
          </View>
        </Pressable>
      </View>
      {room.is_host ? (
        <Pressable onPress={async () => { tapMedium(); const r = await classRoomEnd(room.id); if (r && r.ok) out(true); }} accessibilityRole="button" style={{ marginTop: 10 }}>
          <Text style={{ color: C.coral, fontSize: 14, fontWeight: '800', textAlign: 'center' }}>{w(lang, 'end')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export const EventRoom = ({ kind, id, lang, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [r, setR] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');
  const [pin, setPin] = useState('');
  const [inCall, setInCall] = useState(false);
  const [ended, setEnded] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ex, setEx] = useState(null);

  const load = () => {
    eventExtras(kind, id).then((x) => setEx(x && x.ok ? x : null));
    return eventRoom(kind, id).then((x) => { setR(x || { ok: false }); if (x && x.ok && x.is_host) setPin((p) => p || x.pin || ''); });
  };
  const checkin = async () => { tapMedium(); const x = await eventCheckin(kind, id); if (x && x.ok) { tapSuccess(); load(); } else setMsg(w(lang, 'err')); };
  useEffect(() => { load(); const h = setInterval(load, 30000); return () => clearInterval(h); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the people-going chat: read whenever there is one; new lines arrive live
  const sq = r && r.ok && r.chat ? r.chat.squad_id : null;
  useEffect(() => {
    if (!sq) return undefined;
    fetchMessages({ squadId: sq }).then((rows) => setMsgs(rows || [])).catch(() => {});
    const off = subscribeMessages({ squadId: sq }, (p) => setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : m.concat(p.new))));
    return off;
  }, [sq]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !sq) return;
    tapLight(); setDraft('');
    try { const row = await sendMessage({ squadId: sq, userId: user.id, body }); setMsgs((m) => (m.some((x) => x.id === row.id) ? m : m.concat(row))); }
    catch (e) { setMsg(w(lang, 'err')); setDraft(body); load(); }
  };
  const savePin = async () => {
    tapMedium();
    const x = await eventPin(kind, id, pin);
    if (x && x.ok) { tapSuccess(); load(); } else setMsg(w(lang, 'err'));
  };

  const now = r && r.ok ? Date.now() : 0;
  // the chat: soon · open · the 24-hour capsule (short notes) · archived
  const chatState = r && r.ok && r.chat ? (r.chat.open ? 'open' : now < new Date(r.chat.opens_at).getTime() ? 'soon'
    : ex && ex.phase === 'capsule' ? 'capsule' : 'over') : null;
  const left = r && r.ok && r.total ? Math.max(0, r.total - r.taken) : null;
  const title = r && r.ok ? (lang === 'ar' && r.title_ar ? r.title_ar : r.title) : '';

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
        </View>
        {r == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : !r.ok ? (
          <Text style={{ color: C.dim, fontSize: 14, margin: 24 }}>{w(lang, 'err')}</Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 6, paddingBottom: insets.bottom + 40 }}>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.7, lineHeight: 33 }}>{title}</Text>
            <Text style={[{ color: C.dim, fontSize: 14, marginTop: 6 }, NUM]}>{when(r.starts_at, lang)}</Text>

            {/* how full it is */}
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[{ color: C.text, fontSize: 15, fontWeight: '600', flex: 1 }, NUM]}>
                  {r.total ? w(lang, 'spots', { n: r.taken, t: r.total }) : w(lang, 'going', { n: r.taken })}
                </Text>
                {/* amber only when it matters: two seats or fewer */}
                {left != null && left > 0 && left <= 2 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold, marginEnd: 6 }} />
                    <Text style={[{ color: C.gold, fontSize: 13, fontWeight: '600' }, NUM]}>{w2(lang, 5, left)}</Text>
                  </View>
                ) : null}
              </View>
              {r.total ? (
                <View style={{ height: 4, borderRadius: 2, backgroundColor: C.glassHi, marginTop: 10, overflow: 'hidden' }}>
                  <View style={{ height: 4, borderRadius: 2, width: Math.min(100, Math.round((r.taken / r.total) * 100)) + '%', backgroundColor: C.purple }} />
                </View>
              ) : null}
            </View>

            {/* the host's pin: read-only, except for the host */}
            <View style={{ marginTop: 20, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 20 }}>
              <Text style={{ color: C.dim, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>{w(lang, 'pin')}</Text>
              {r.is_host ? (
                <>
                  <TextInput value={pin} onChangeText={setPin} placeholder={w(lang, 'pinPh')} placeholderTextColor={C.faint} multiline maxLength={500}
                    style={{ color: C.text, fontSize: 15, minHeight: 70, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, marginTop: 8, textAlign: lang === 'ar' ? 'right' : 'left' }} />
                  <Pressable onPress={savePin} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                    <View style={{ borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18, backgroundColor: C.purple }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>{w(lang, 'pinSave')}</Text>
                    </View>
                  </Pressable>
                </>
              ) : (
                <Text selectable style={{ color: r.pin ? C.text : C.dim, fontSize: 15.5, lineHeight: 22, marginTop: 6 }}>{r.pin || w(lang, 'pinEmpty')}</Text>
              )}
            </View>

            {/* at the table: check in, then play together */}
            {ex && ex.can_checkin ? (
              ex.checked_in ? <Text style={{ color: C.green, fontSize: 14, fontWeight: '600', marginTop: 16 }}>{'✓ ' + w2(lang, 2)}</Text> : (
                <View style={{ marginTop: 20, borderRadius: 24, padding: 20, backgroundColor: C.purpleSoft, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontSize: 17, fontWeight: '700', flex: 1 }}>{w2(lang, 0)}</Text>
                  <Pressable onPress={checkin} accessibilityRole="button">
                    <View style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: C.purple }}>
                      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>{w2(lang, 1)}</Text>
                    </View>
                  </Pressable>
                </View>
              )
            ) : null}
            {ex && (ex.phase === 'before' || ex.phase === 'live') ? <ActivitiesHub kind={kind} id={id} lang={lang} /> : null}
            {ex && ex.checked_in && ex.phase !== 'before' ? <AfterParty kind={kind} id={id} lang={lang} /> : null}

            {/* online: the workshop's room */}
            {r.call ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>{w(lang, 'call')}</Text>
                {ended || r.call.ended ? <Text style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>{w(lang, 'callEnded')}</Text>
                  : inCall ? <ClassRoom lang={lang} room={{ id: r.id, is_host: r.is_host }} onOut={(over) => { setInCall(false); if (over) setEnded(true); load(); }} />
                  : r.call.can_join ? (
                    <Pressable onPress={() => { tapMedium(); setInCall(true); }} accessibilityRole="button" style={{ marginTop: 10 }}>
                      <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.purple }}>
                        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>{w(lang, 'callJoin')}</Text>
                      </View>
                    </Pressable>
                  ) : <Text style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>{Date.now() < new Date(r.call.opens_at).getTime() ? w(lang, 'callSoon') : w(lang, 'callPaid')}</Text>}
              </View>
            ) : null}

            {/* offline: the people going, briefly */}
            {chatState ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>{w(lang, 'chat')}</Text>
                {chatState === 'soon' ? <Text style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>{w(lang, 'chatSoon')}</Text> : null}
                {chatState === 'capsule' ? <Text style={{ color: C.purple, fontSize: 14, marginTop: 6 }}>{w2(lang, 3)}</Text> : null}
                {chatState === 'over' ? <Text style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>{ex && ex.phase === 'archived' ? w2(lang, 4) : w(lang, 'chatOver')}</Text> : null}
                {msgs.map((m) => (
                  <View key={m.id} style={{ marginTop: 8, alignSelf: m.user_id === user.id ? 'flex-end' : 'flex-start', maxWidth: '84%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: m.user_id === user.id ? C.purple : C.glass, borderWidth: m.user_id === user.id ? 0 : 1, borderColor: C.line }}>
                    {m.user_id !== user.id && m.user ? <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700' }}>{m.user.name}</Text> : null}
                    <Text style={{ color: m.user_id === user.id ? '#FFF' : C.text, fontSize: 14.5 }}>{m.body}</Text>
                  </View>
                ))}
                {chatState === 'open' || chatState === 'capsule' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                    <TextInput value={draft} onChangeText={setDraft} placeholder={chatState === 'capsule' ? w2(lang, 6) : w(lang, 'say')} placeholderTextColor={C.faint} maxLength={chatState === 'capsule' ? 280 : 500} onSubmitEditing={send}
                      style={{ flex: 1, color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, textAlign: lang === 'ar' ? 'right' : 'left' }} />
                    <Pressable onPress={send} accessibilityRole="button" accessibilityLabel="send" style={{ marginStart: 8 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="arrow-up" size={20} color="#FFF" />
                      </View>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
            {msg ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 10, textAlign: 'center' }}>{msg}</Text> : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};
