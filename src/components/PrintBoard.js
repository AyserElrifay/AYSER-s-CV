import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { listOffers, offerWant, bookOffer, money } from '../services/offers';
import { payBooking } from '../services/payments';
import { uploadMediaSmart } from '../lib/storage';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── YOUR VISION BOARD, ON THE WALL ──────────────────────────────────
   Ayser: "زود ان الناس تقدر تعمل ديزين للvision board في مومنتس
   وتشتريها وتجلهم".

   One poster, made from the dreams already on your board: a year on top,
   your pictures, the words under them. Saving the image is free — it is
   yours. Having it printed and brought to your door is an order like any
   gift (the notebook, the crochet): until the team has a printer and a
   price it is "coming", and all you can do is say you want one. Nobody
   pays for a print that cannot be made yet.

   The poster leaves this phone only when you order it, as one image in
   the order's note, so the print shop has exactly what you saw. */

export const PRINT_OFFER = '0ffe0000-0000-4000-8000-0000000000c4';
const W = 2480, H = 3508;                 // A-series portrait, 300 dpi at A4, ~210 at A3
const PAPER = '#F6F2EA', INK = '#1F1B16', SOFT = 'rgba(31,27,22,0.55)';
const TINT = ['#EFEDFF', '#E5F4E4', '#F9EEDA', '#E7F1FB', '#FBEBEB', '#F9ECE7'];

const S = {
  en: { head: 'Print your board', sub: 'Your dreams on one poster. Save it free, or have it printed and brought to you.', year: 'On top', tip: 'Tap a picture to choose the original — it prints sharper.', save: 'Save image', soon: 'Printed posters are coming. Say you want one and we will tell you when.', want: 'I want it printed', wanted: 'You are on the list ✓', size: 'A3 · 30 × 42 cm · delivered', phone: 'Phone for the courier', addr: 'Delivery address', order: 'Order the print', ordered: 'Ordered ✓ We will call you before it comes.', err: 'It did not go through. Try again.', soft: 'Some pictures are small and may print soft.' },
  ar: { head: 'اطبع لوحة أحلامك', sub: 'أحلامك في بوستر واحد. احفظه ببلاش، أو اطبعه ويوصلك لحد البيت.', year: 'فوق', tip: 'دوس على أي صورة واختار الأصلية — تطلع أوضح في الطباعة.', save: 'احفظ الصورة', soon: 'الطباعة جاية قريب. قول إنك عايزها ونبلغك أول ما تبدأ.', want: 'عايزها مطبوعة', wanted: 'اسمك في القايمة ✓', size: 'A3 · ‏30 × 42 سم · توصيل', phone: 'رقم موبايلك للمندوب', addr: 'عنوان التوصيل', order: 'اطلب الطباعة', ordered: 'تم الطلب ✓ هنكلمك قبل ما توصلك.', err: 'ماتبعتش. جرّب تاني.', soft: 'في صور صغيرة ممكن تطلع مش واضحة أوي.' },
  cs: { head: 'Vytiskni si nástěnku', sub: 'Tvoje sny na jednom plakátu. Ulož ho zdarma, nebo si ho nech vytisknout a doručit.', year: 'Nahoře', tip: 'Klepni na obrázek a vyber originál — vytiskne se ostřeji.', save: 'Uložit obrázek', soon: 'Tisk plakátů se chystá. Dej vědět, že chceš, a ozveme se.', want: 'Chci ho vytisknout', wanted: 'Jsi na seznamu ✓', size: 'A3 · 30 × 42 cm · s doručením', phone: 'Telefon pro kurýra', addr: 'Doručovací adresa', order: 'Objednat tisk', ordered: 'Objednáno ✓ Před doručením zavoláme.', err: 'Nepodařilo se. Zkus to znovu.', soft: 'Některé obrázky jsou malé a mohou být neostré.' },
  es: { head: 'Imprime tu tablero', sub: 'Tus sueños en un póster. Guárdalo gratis o pide que te lo impriman y te lo lleven.', year: 'Arriba', tip: 'Toca una imagen y elige la original: se imprime más nítida.', save: 'Guardar imagen', soon: 'Los pósters impresos llegarán pronto. Di que quieres uno y te avisamos.', want: 'Lo quiero impreso', wanted: 'Estás en la lista ✓', size: 'A3 · 30 × 42 cm · a domicilio', phone: 'Teléfono para el mensajero', addr: 'Dirección de entrega', order: 'Pedir la impresión', ordered: 'Pedido ✓ Te llamaremos antes de entregarlo.', err: 'No se envió. Inténtalo de nuevo.', soft: 'Algunas imágenes son pequeñas y pueden salir poco nítidas.' },
  et: { head: 'Prindi oma tahvel', sub: 'Sinu unistused ühel plakatil. Salvesta tasuta või lase see trükkida ja koju tuua.', year: 'Üleval', tip: 'Puuduta pilti ja vali originaal — trükis tuleb teravam.', save: 'Salvesta pilt', soon: 'Trükitud plakatid tulevad. Ütle, et soovid, ja anname teada.', want: 'Soovin trükitult', wanted: 'Oled nimekirjas ✓', size: 'A3 · 30 × 42 cm · kohaletoimetusega', phone: 'Telefon kullerile', addr: 'Tarneaadress', order: 'Telli trükk', ordered: 'Tellitud ✓ Helistame enne toomist.', err: 'Ei läinud läbi. Proovi uuesti.', soft: 'Mõni pilt on väike ja võib jääda uduseks.' },
  fr: { head: 'Imprime ton tableau', sub: 'Tes rêves sur une seule affiche. Garde-la gratuitement, ou fais-la imprimer et livrer.', year: 'En haut', tip: 'Touche une image pour choisir l’originale — elle sera plus nette.', save: 'Enregistrer l’image', soon: 'Les affiches imprimées arrivent. Dis que tu en veux une et on te prévient.', want: 'Je la veux imprimée', wanted: 'Tu es sur la liste ✓', size: 'A3 · 30 × 42 cm · livrée', phone: 'Téléphone pour le livreur', addr: 'Adresse de livraison', order: 'Commander l’impression', ordered: 'Commandé ✓ On t’appelle avant la livraison.', err: 'Ça n’est pas passé. Réessaie.', soft: 'Certaines images sont petites et peuvent être floues.' },
  hi: { head: 'अपना बोर्ड प्रिंट करो', sub: 'तुम्हारे सपने एक पोस्टर पर। मुफ़्त में सेव करो, या प्रिंट करवाकर घर मँगवाओ।', year: 'ऊपर', tip: 'किसी तस्वीर पर टैप करके असली चुनो — प्रिंट साफ़ आएगा।', save: 'तस्वीर सेव करो', soon: 'प्रिंटेड पोस्टर जल्द आ रहे हैं। बताओ कि चाहिए, हम ख़बर देंगे।', want: 'मुझे प्रिंट चाहिए', wanted: 'तुम सूची में हो ✓', size: 'A3 · 30 × 42 सेमी · डिलीवरी', phone: 'कूरियर के लिए फ़ोन', addr: 'डिलीवरी का पता', order: 'प्रिंट ऑर्डर करो', ordered: 'ऑर्डर हो गया ✓ डिलीवरी से पहले फ़ोन करेंगे।', err: 'नहीं गया। फिर कोशिश करो।', soft: 'कुछ तस्वीरें छोटी हैं, प्रिंट धुंधला आ सकता है।' },
  it: { head: 'Stampa la tua bacheca', sub: 'I tuoi sogni in un poster. Salvalo gratis, o fallo stampare e consegnare.', year: 'In alto', tip: 'Tocca un’immagine e scegli l’originale: viene più nitida.', save: 'Salva immagine', soon: 'I poster stampati arrivano presto. Dicci che ne vuoi uno e ti avvisiamo.', want: 'Lo voglio stampato', wanted: 'Sei in lista ✓', size: 'A3 · 30 × 42 cm · consegnato', phone: 'Telefono per il corriere', addr: 'Indirizzo di consegna', order: 'Ordina la stampa', ordered: 'Ordinato ✓ Ti chiamiamo prima della consegna.', err: 'Non è andato. Riprova.', soft: 'Alcune immagini sono piccole e potrebbero venire sfocate.' },
  ja: { head: 'ボードを印刷', sub: '夢を1枚のポスターに。無料で保存、または印刷してお届け。', year: '上の文字', tip: '写真をタップして元の写真を選ぶと、きれいに印刷できます。', save: '画像を保存', soon: '印刷ポスターは準備中です。ほしいと言ってくれたらお知らせします。', want: '印刷してほしい', wanted: 'リストに入りました ✓', size: 'A3 · 30 × 42 cm · お届け', phone: '配達用の電話番号', addr: 'お届け先住所', order: '印刷を注文', ordered: '注文しました ✓ お届け前にお電話します。', err: '送れませんでした。もう一度どうぞ。', soft: '小さい写真はぼやけて印刷されるかもしれません。' },
  ko: { head: '보드 인쇄하기', sub: '꿈을 포스터 한 장에. 무료로 저장하거나, 인쇄해서 받아보세요.', year: '맨 위', tip: '사진을 눌러 원본을 고르면 더 선명하게 인쇄돼요.', save: '이미지 저장', soon: '인쇄 포스터는 곧 나와요. 원한다고 알려주시면 소식 드릴게요.', want: '인쇄해서 받고 싶어요', wanted: '명단에 올렸어요 ✓', size: 'A3 · 30 × 42 cm · 배송', phone: '배송 기사용 전화번호', addr: '배송 주소', order: '인쇄 주문', ordered: '주문 완료 ✓ 배송 전에 전화드릴게요.', err: '전송되지 않았어요. 다시 해 주세요.', soft: '작은 사진은 흐리게 인쇄될 수 있어요.' },
  nl: { head: 'Druk je bord af', sub: 'Je dromen op één poster. Bewaar hem gratis, of laat hem drukken en bezorgen.', year: 'Bovenaan', tip: 'Tik op een foto en kies het origineel — dat wordt scherper.', save: 'Afbeelding bewaren', soon: 'Gedrukte posters komen eraan. Laat weten dat je er een wilt, dan horen we het je.', want: 'Ik wil hem gedrukt', wanted: 'Je staat op de lijst ✓', size: 'A3 · 30 × 42 cm · bezorgd', phone: 'Telefoon voor de koerier', addr: 'Bezorgadres', order: 'Afdruk bestellen', ordered: 'Besteld ✓ We bellen voor de bezorging.', err: 'Het lukte niet. Probeer opnieuw.', soft: 'Sommige foto’s zijn klein en kunnen wazig worden.' },
  pt: { head: 'Imprime o teu quadro', sub: 'Os teus sonhos num só poster. Guarda-o grátis, ou manda imprimir e entregar.', year: 'Em cima', tip: 'Toca numa imagem e escolhe a original — fica mais nítida.', save: 'Guardar imagem', soon: 'Os posters impressos estão a chegar. Diz que queres um e avisamos-te.', want: 'Quero impresso', wanted: 'Estás na lista ✓', size: 'A3 · 30 × 42 cm · entregue', phone: 'Telefone para o estafeta', addr: 'Morada de entrega', order: 'Encomendar a impressão', ordered: 'Encomendado ✓ Ligamos antes da entrega.', err: 'Não foi. Tenta outra vez.', soft: 'Algumas imagens são pequenas e podem sair pouco nítidas.' },
  ro: { head: 'Tipărește-ți panoul', sub: 'Visele tale pe un singur poster. Salvează-l gratuit sau tipărește-l și primește-l acasă.', year: 'Sus', tip: 'Atinge o imagine și alege originalul — iese mai clar.', save: 'Salvează imaginea', soon: 'Posterele tipărite vin în curând. Spune că vrei unul și te anunțăm.', want: 'Îl vreau tipărit', wanted: 'Ești pe listă ✓', size: 'A3 · 30 × 42 cm · cu livrare', phone: 'Telefon pentru curier', addr: 'Adresa de livrare', order: 'Comandă tiparul', ordered: 'Comandat ✓ Te sunăm înainte de livrare.', err: 'Nu a mers. Încearcă din nou.', soft: 'Unele imagini sunt mici și pot ieși neclare.' },
  ru: { head: 'Напечатай свою доску', sub: 'Твои мечты на одном постере. Сохрани бесплатно или закажи печать с доставкой.', year: 'Сверху', tip: 'Нажми на фото и выбери оригинал — напечатается чётче.', save: 'Сохранить картинку', soon: 'Печатные постеры скоро появятся. Скажи, что хочешь, и мы сообщим.', want: 'Хочу напечатать', wanted: 'Ты в списке ✓', size: 'A3 · 30 × 42 см · с доставкой', phone: 'Телефон для курьера', addr: 'Адрес доставки', order: 'Заказать печать', ordered: 'Заказано ✓ Позвоним перед доставкой.', err: 'Не отправилось. Попробуй ещё раз.', soft: 'Некоторые фото маленькие и могут выйти нечёткими.' },
  tr: { head: 'Panonu bastır', sub: 'Hayallerin tek bir posterde. Ücretsiz kaydet ya da bastırıp kapına getirt.', year: 'Üstte', tip: 'Bir resme dokunup orijinalini seç — daha net basılır.', save: 'Resmi kaydet', soon: 'Basılı posterler yakında. İstediğini söyle, haber verelim.', want: 'Basılı istiyorum', wanted: 'Listedesin ✓', size: 'A3 · 30 × 42 cm · teslimatlı', phone: 'Kurye için telefon', addr: 'Teslimat adresi', order: 'Baskıyı sipariş et', ordered: 'Sipariş verildi ✓ Teslimattan önce arayacağız.', err: 'Gitmedi. Tekrar dene.', soft: 'Bazı resimler küçük, bulanık basılabilir.' },
  uk: { head: 'Надрукуй свою дошку', sub: 'Твої мрії на одному постері. Збережи безкоштовно або замов друк із доставкою.', year: 'Згори', tip: 'Натисни на фото й обери оригінал — надрукується чіткіше.', save: 'Зберегти картинку', soon: 'Друковані постери скоро. Скажи, що хочеш, і ми повідомимо.', want: 'Хочу надрукувати', wanted: 'Ти у списку ✓', size: 'A3 · 30 × 42 см · з доставкою', phone: 'Телефон для кур’єра', addr: 'Адреса доставки', order: 'Замовити друк', ordered: 'Замовлено ✓ Зателефонуємо перед доставкою.', err: 'Не вийшло. Спробуй ще раз.', soft: 'Деякі фото маленькі й можуть вийти нечіткими.' },
  zh: { head: '打印你的愿景板', sub: '把梦想放进一张海报。免费保存，或打印后送到你家。', year: '顶部文字', tip: '点一张图选原图，打印更清晰。', save: '保存图片', soon: '打印海报即将推出。告诉我们你想要，开始时通知你。', want: '我想要打印版', wanted: '已加入名单 ✓', size: 'A3 · 30 × 42 厘米 · 送货上门', phone: '快递联系电话', addr: '收货地址', order: '下单打印', ordered: '已下单 ✓ 送达前会给你打电话。', err: '没有发出去，再试一次。', soft: '有些图片较小，打印可能不够清晰。' },
};
export const ps = (lang, k) => ((S[lang] && S[lang][k]) || S.en[k]);

const loadImg = (src) => new Promise((resolve) => {
  if (!src) return resolve(null);
  const im = new window.Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => resolve(im);
  im.onerror = () => resolve(null);
  im.src = src;
});

const rounded = (g, x, y, w, h, r) => {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};

// the words under a picture: two lines at most, the second one trimmed
const lines2 = (g, text, max) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [''];
  words.forEach((w) => {
    const cur = out[out.length - 1];
    const next = cur ? cur + ' ' + w : w;
    if (g.measureText(next).width <= max || !cur) out[out.length - 1] = next;
    else out.push(w);
  });
  if (out.length > 2) { out.length = 2; out[1] = out[1] + '…'; }
  while (out[1] && g.measureText(out[1]).width > max) out[1] = out[1].slice(0, -2) + '…';
  return out;
};

/* the poster itself — drawn the same way for the preview and the print */
async function drawPoster({ top, dreams, rtl }) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const FONT = "MomentsArabic, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";
  try { await document.fonts.load('700 120px MomentsArabic', 'أ'); } catch (e) { /* the system font draws it */ }
  g.direction = rtl ? 'rtl' : 'ltr';
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);

  const M = 190;
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '800 300px ' + FONT;
  g.fillText(String(top || '').slice(0, 18), W / 2, 520, W - 2 * M);
  g.fillStyle = SOFT; g.fillRect(W / 2 - 90, 600, 180, 8);

  const n = Math.max(1, dreams.length);
  const cols = n === 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const GAP = 90, CAP = 200, T = 760, B = H - 330;
  const cw = (W - 2 * M - (cols - 1) * GAP) / cols;
  const ch = (B - T - (rows - 1) * GAP) / rows;
  const pics = await Promise.all(dreams.map((d) => loadImg(d.photo)));
  dreams.forEach((d, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    // a short last row sits in the middle, not hanging off one side
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const shift = ((cols - inRow) * (cw + GAP)) / 2;
    const lx = M + shift + c * (cw + GAP);
    const x = rtl ? W - lx - cw : lx;          // Arabic reads from the right
    const y = T + r * (ch + GAP);
    const ph = ch - CAP;
    g.save(); rounded(g, x, y, cw, ph, 44); g.clip();
    const im = pics[i];
    if (im) {
      const s = Math.max(cw / im.width, ph / im.height);
      g.drawImage(im, x + (cw - im.width * s) / 2, y + (ph - im.height * s) / 2, im.width * s, im.height * s);
    } else {
      g.fillStyle = TINT[i % TINT.length]; g.fillRect(x, y, cw, ph);
      g.font = Math.round(Math.min(cw, ph) * 0.34) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(d.emoji || '✨', x + cw / 2, y + ph / 2);
    }
    g.restore();
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const size = cols === 3 ? 64 : 76;
    g.font = '700 ' + size + 'px ' + FONT;
    lines2(g, d.label, cw - 20).forEach((ln, k) => g.fillText(ln, x + cw / 2, y + ph + 96 + k * (size + 18), cw));
  });

  g.fillStyle = SOFT; g.textAlign = 'center';
  g.font = '600 56px ' + FONT;
  g.fillText('moments', W / 2, H - 150);
  return cv;
}

const pickOriginal = () => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  input.onchange = () => {
    const f = input.files && input.files[0]; input.remove();
    if (!f) return resolve(null);
    const url = URL.createObjectURL(f);
    const im = new window.Image();
    im.onload = () => resolve({ url, w: im.width });
    im.onerror = () => resolve(null);
    im.src = url;
  };
  document.body.appendChild(input); input.click();
});

export const PrintBoard = ({ lang, dreams, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const rtl = lang === 'ar';
  const now = new Date();
  const [top, setTop] = useState(String(now.getFullYear() + (now.getMonth() >= 9 ? 1 : 0)));
  // a sharper picture chosen here, for the print only: { [dreamId]: { url, w } }
  const [orig, setOrig] = useState({});
  const [preview, setPreview] = useState(null);
  const [offer, setOffer] = useState(null);
  const [want, setWant] = useState(false);
  const [phone, setPhone] = useState('');
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(false);
  const canvas = useRef(null);
  useSheetBack(onClose);

  const items = dreams.map((d) => ({ ...d, photo: (orig[d.id] && orig[d.id].url) || d.photo }));
  const soft = dreams.some((d) => d.photo && !(orig[d.id] && orig[d.id].w >= 1200));

  useEffect(() => {
    let gone = false;
    const id = setTimeout(async () => {
      const cv = await drawPoster({ top, dreams: items, rtl });
      if (gone) return;
      canvas.current = cv;
      setPreview(cv.toDataURL('image/jpeg', 0.6));
    }, 250);
    return () => { gone = true; clearTimeout(id); };
  }, [top, orig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listOffers('gift', null).then((all) => {
      const o = all.find((x) => x.id === PRINT_OFFER) || null;
      setOffer(o); setWant(!!(o && o.i_want));
    }).catch(() => {});
  }, []);

  const blob = () => new Promise((resolve) => canvas.current.toBlob((b) => resolve(b), 'image/jpeg', 0.92));

  const save = async () => {
    if (!canvas.current) return;
    tapLight();
    const b = await blob();
    const file = new File([b], 'vision-board-' + top + '.jpg', { type: 'image/jpeg' });
    let share = false;
    try { share = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
    if (share) { try { await navigator.share({ files: [file] }); } catch (e) {} return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const toggleWant = async () => {
    if (!offer || busy) return;
    tapLight(); setBusy(true);
    const r = await offerWant(offer.id, !want);
    setBusy(false);
    if (r && r.ok) { setWant(!!r.i_want); if (r.i_want) tapSuccess(); } else setMsg(ps(lang, 'err'));
  };

  const order = async () => {
    if (!offer || busy || !canvas.current) return;
    if (phone.replace(/\D/g, '').length < 8 || addr.trim().length < 8) { setMsg(ps(lang, 'phone') + ' · ' + ps(lang, 'addr')); return; }
    tapMedium(); setBusy(true); setMsg(null);
    try {
      const url = await uploadMediaSmart(user && user.id, await blob(), 'jpg', 'image/jpeg');
      const mode = (offer.pay_modes || []).indexOf('online') >= 0 && offer.online_ready ? 'online' : (offer.pay_modes || ['reserve'])[0];
      const note = ['BOARD', url, 'phone: ' + phone.trim(), 'address: ' + addr.trim()].join('\n').slice(0, 900);
      const r = await bookOffer(offer.id, 1, mode, note);
      if (!r || !r.ok) throw new Error('book');
      tapSuccess(); setDone(true);
      if (r.status === 'pending') { const p = await payBooking(r.id); if (!p.ok) setMsg(ps(lang, 'err')); }
    } catch (e) { setMsg(ps(lang, 'err')); }
    setBusy(false);
  };

  const field = { color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, textAlign: rtl ? 'right' : 'left' };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
            <Ionicons name="close" size={26} color={C.text} />
          </Pressable>
          <Text style={{ flex: 1, color: C.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }} numberOfLines={1}>{ps(lang, 'head')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, alignItems: 'center' }}>
          <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 360 }}>{ps(lang, 'sub')}</Text>

          <View style={{ width: 260, height: 260 * H / W, marginTop: 18, borderRadius: 6, backgroundColor: PAPER, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, alignItems: 'center', justifyContent: 'center' }}>
            {preview ? <Image source={{ uri: preview }} style={{ width: '100%', height: '100%', borderRadius: 6 }} /> : <ActivityIndicator color={C.purple} />}
          </View>

          <View style={{ alignSelf: 'stretch', marginTop: 22 }}>
            <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700' }}>{ps(lang, 'year')}</Text>
            <TextInput value={top} onChangeText={(v) => setTop(v.slice(0, 18))} style={field} maxLength={18} />
            <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700', marginTop: 16 }}>{ps(lang, 'tip')}</Text>
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {items.map((d) => (
                <Pressable key={d.id} accessibilityRole="button" onPress={async () => { const p = await pickOriginal(); if (p) setOrig((o) => ({ ...o, [d.id]: p })); }} style={{ marginEnd: 10 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
                    {d.photo ? <Image source={{ uri: d.photo }} style={{ width: 64, height: 64 }} /> : <Text style={{ fontSize: 26 }}>{d.emoji}</Text>}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            {soft ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 8 }}>{ps(lang, 'soft')}</Text> : null}

            <Pressable onPress={save} disabled={!preview} accessibilityRole="button" style={{ marginTop: 22 }}>
              <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.line, flexDirection: 'row', justifyContent: 'center' }}>
                <Ionicons name="download-outline" size={18} color={C.text} />
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginHorizontal: 8 }}>{ps(lang, 'save')}</Text>
              </View>
            </Pressable>

            {/* the printed one: wanted while it is coming, ordered once it is real */}
            {offer && offer.status === 'live' && offer.price > 0 ? (
              done ? (
                <Text style={{ color: C.green, fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 22 }}>{ps(lang, 'ordered')}</Text>
              ) : (
                <View style={{ marginTop: 26 }}>
                  <Text style={{ color: C.text, fontSize: 17, fontWeight: '800' }}>{money(offer.price, offer.currency, lang)}</Text>
                  <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{ps(lang, 'size')}</Text>
                  <TextInput value={phone} onChangeText={setPhone} placeholder={ps(lang, 'phone')} placeholderTextColor={C.faint} keyboardType="phone-pad" style={field} />
                  <TextInput value={addr} onChangeText={setAddr} placeholder={ps(lang, 'addr')} placeholderTextColor={C.faint} multiline style={[field, { minHeight: 70 }]} />
                  <Pressable onPress={order} disabled={busy} accessibilityRole="button" style={{ marginTop: 14 }}>
                    <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: C.purple, opacity: busy ? 0.6 : 1 }}>
                      {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15.5, fontWeight: '800' }}>{ps(lang, 'order')}</Text>}
                    </View>
                  </Pressable>
                </View>
              )
            ) : offer ? (
              <View style={{ marginTop: 26, alignItems: 'center' }}>
                <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, textAlign: 'center' }}>{ps(lang, 'soon')}</Text>
                <Pressable onPress={toggleWant} disabled={busy} accessibilityRole="button" style={{ marginTop: 12, alignSelf: 'stretch' }}>
                  <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: want ? C.greenSoft : C.purple }}>
                    <Text style={{ color: want ? C.green : '#FFF', fontSize: 15, fontWeight: '800' }}>{ps(lang, want ? 'wanted' : 'want')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
            {msg ? <Text style={{ color: C.coral, fontSize: 13, textAlign: 'center', marginTop: 10 }}>{msg}</Text> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
