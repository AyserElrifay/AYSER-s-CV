/* ─── THE WORDS OF MOMENTS FOR BUSINESS ───────────────────────────────
   English and Egyptian Arabic, falling back to English. Every line says
   what the app really does today — no invented results for a place to
   catch us on. Loaded only with the business screens. */

const W = {
  en: {
    demo_bar: 'Demo · sample data. Nothing here is real, and nothing is saved.', demo_plan: 'In the real portal this puts a plan here on the map.',
    qr_title: 'Scan to check in', qr_s: 'Show this at your counter. Guests scan it and they are checked in. It changes every minute, so a photo of it is useless later.', qr_print: 'Print a card for your tables', qr_card: 'Scan to check in', qr_card_s: 'Open your camera, scan, and collect your stamp on Moments.',
    biz: 'Moments for business', biz_s: 'Cafés, restaurants, shops, stays, activities, organisations and hosts — each gets the tools its kind needs.',
    pick: 'What are you?', apply: 'Apply', for_you: 'What you get',
    places: 'Places on Moments', places_s: 'Real places that welcome groups from Moments.', all: 'All', none: 'No places here yet.', guests: '{n} guests checked in',
    // the hub
    hub_today: 'Today', hub_page: 'Your page', hub_req: 'Requests', hub_orders: 'Orders',
    listed: 'Show my page on Moments', listed_s: 'Off while you get it ready. Nobody sees it until you switch it on.',
    code: 'Counter code', code_s: 'Guests type this at your counter to check in. Change it any time — it’s only on your screen.', code_new: 'New code',
    st_today: 'Today', st_week: '7 days', st_month: 'This month', st_people: 'Guests', st_back: 'Came back', st_rewards: 'Rewards given',
    bill: 'The first 50 guests are free ({left} left). After that the fee is EGP {fee} a guest — this month that would be EGP {sum}. Billing has not started: nothing is charged.',
    recent: 'Recent check-ins', recent_none: 'No check-ins yet. Put your counter code by the till.',
    plan_here: 'Host a plan here', plan_here_s: 'Your way to reach people: a plan on the map they can join.',
    // page editor
    photos: 'Photos', about: 'About', about_ph: 'What makes your place good to come to with friends?',
    phone: 'Phone / WhatsApp', address: 'Address', city: 'City', hours: 'Opening hours', hours_ph: 'e.g. Daily 9am – 1am',
    pin: 'Use my location for the map', pinned: 'On the map ✓',
    table: 'Moments Table', table_s: 'The hours you’d like groups, and one thing a group gets.',
    quiet: 'Quiet hours you want filled', quiet_ph: 'e.g. Sun–Wed, 4–7pm', perk: 'Group perk', perk_ph: 'e.g. Free dessert for a table of 4+',
    stamps_s: 'Five check-ins = one reward, given with your counter code.',
    price_pp: 'Average per person', price_night: 'From, per night', price_from: 'From',
    beds: 'Rooms / beds', checkin_t: 'Check-in from', includes: 'Included', group_max: 'Groups up to', duration: 'How long (hours)', sells: 'What you sell', link: 'Website or Instagram',
    save: 'Save', saved: 'Saved ✓', failed: 'That did not save — try again',
    // requests
    req_none: 'No requests yet.', accept: 'Accept', decline: 'Decline', reply_ph: 'A short reply (optional)', req_people: '{n} people',
    r_stay: 'Stay', r_table: 'Table', r_group: 'Group',
    st_new: 'New', st_accepted: 'Accepted', st_declined: 'Declined', st_cancelled: 'Cancelled',
    // public page
    check_in: 'Check in', check_in_s: 'Ask the staff for the counter code.', code_ph: '4-digit code', checked: 'Checked in ✓ — thank you for coming',
    stamps: '{n} of 5 stamps', reward_ready: 'Your reward is ready — show the staff', redeem: 'Use my reward',
    ask_stay: 'Ask for a stay', ask_table: 'Book a table for a group', ask_group: 'Ask for a group visit',
    from: 'From', to: 'To', people: 'People', note_ph: 'Anything they should know', send: 'Send request', sent: 'Sent — they’ll answer here.',
    my_req: 'Your requests', cancel: 'Cancel', pay_note: 'You pay the place directly for now; online payment is coming.',
    plan_with: 'Plan something here', map: 'Open in maps', call: 'Call',
    e_code: 'That code is not right.', e_slow: 'Too many tries — wait a little.', e_yours: 'This is your own place.', e_date: 'Check the dates.', e_err: 'That did not work — try again', e_setup: 'This needs one more step on the server.', e_offline: 'You’re offline.', not_yet: 'Not five stamps yet.',
    none_mine: 'Your place appears here once the Moments team accepts your application.',
    host_go: 'Hosts are verified with an ID first.', host_btn: 'Verify me as a host',
  },
  ar: {
    demo_bar: 'تجربة · بيانات مثال. مفيش حاجة هنا حقيقية، ومفيش حاجة بتتحفظ.', demo_plan: 'في البورتال الحقيقي ده بيحط خطة في مكانك على الخريطة.',
    qr_title: 'امسح وسجّل حضورك', qr_s: 'اعرضه عند الكاشير. الضيف يمسحه ويتسجّل حضوره على طول. بيتغيّر كل دقيقة، فصورته مش هتنفع بعدين.', qr_print: 'اطبع كارت للترابيزات', qr_card: 'امسح وسجّل حضورك', qr_card_s: 'افتح الكاميرا، امسح، وخد ختمك على Moments.',
    biz: 'Moments للبيزنس', biz_s: 'كافيهات، مطاعم، محلات، أماكن إقامة، أنشطة، منظمات، وهوستس — كل نوع بياخد الأدوات اللي محتاجها.',
    pick: 'إنت إيه؟', apply: 'قدّم', for_you: 'هتاخد إيه',
    places: 'أماكن على Moments', places_s: 'أماكن حقيقية بترحّب بالجروبات من Moments.', all: 'الكل', none: 'لسه مفيش أماكن هنا.', guests: '{n} ضيف عمل check-in',
    hub_today: 'النهارده', hub_page: 'صفحتك', hub_req: 'الطلبات', hub_orders: 'الأوردرات',
    listed: 'اعرض صفحتي على Moments', listed_s: 'سيبها مقفولة لحد ما تجهّزها. محدش هيشوفها غير لما تفتحها.',
    code: 'كود الكاشير', code_s: 'الضيف بيكتبه عندك عشان يعمل check-in. غيّره وقت ما تحب — موجود على شاشتك إنت بس.', code_new: 'كود جديد',
    st_today: 'النهارده', st_week: '7 أيام', st_month: 'الشهر ده', st_people: 'ضيوف', st_back: 'رجعوا تاني', st_rewards: 'مكافآت اتدّت',
    bill: 'أول 50 ضيف ببلاش (فاضل {left}). بعدهم الرسوم {fee} جنيه للضيف — الشهر ده كانت هتبقى {sum} جنيه. الفوترة لسه مابدأتش: مفيش أي فلوس بتتخصم.',
    recent: 'آخر check-ins', recent_none: 'لسه مفيش. حط كود الكاشير جنب الكاشير.',
    plan_here: 'اعمل خطة عندك', plan_here_s: 'طريقتك توصل للناس: خطة على الخريطة يقدروا ينضموا لها.',
    photos: 'الصور', about: 'عن المكان', about_ph: 'إيه اللي يخلي مكانك حلو تيجي له مع صحابك؟',
    phone: 'تليفون / واتساب', address: 'العنوان', city: 'المدينة', hours: 'مواعيد الشغل', hours_ph: 'مثلاً: كل يوم 9 الصبح – 1 بالليل',
    pin: 'استخدم مكاني للخريطة', pinned: 'على الخريطة ✓',
    table: 'ترابيزة Moments', table_s: 'الساعات اللي عايز فيها جروبات، وحاجة واحدة الجروب ياخدها.',
    quiet: 'الساعات الهادية اللي عايز تملاها', quiet_ph: 'مثلاً: الحد–الأربع، 4–7 المغرب', perk: 'ميزة الجروب', perk_ph: 'مثلاً: حلو ببلاش لترابيزة 4 أو أكتر',
    stamps_s: '5 check-ins = مكافأة واحدة، بتتدّى بكود الكاشير.',
    price_pp: 'متوسط الفرد', price_night: 'يبدأ من، في الليلة', price_from: 'يبدأ من',
    beds: 'أوض / سراير', checkin_t: 'الدخول من الساعة', includes: 'شامل', group_max: 'جروبات لحد', duration: 'المدة (ساعات)', sells: 'بتبيع إيه', link: 'الموقع أو الإنستجرام',
    save: 'احفظ', saved: 'اتحفظ ✓', failed: 'ما اتحفظش — جرّب تاني',
    req_none: 'لسه مفيش طلبات.', accept: 'اقبل', decline: 'اعتذر', reply_ph: 'رد قصير (اختياري)', req_people: '{n} أشخاص',
    r_stay: 'إقامة', r_table: 'ترابيزة', r_group: 'جروب',
    st_new: 'جديد', st_accepted: 'اتقبل', st_declined: 'اتعذر', st_cancelled: 'اتلغى',
    check_in: 'اعمل check-in', check_in_s: 'اطلب كود الكاشير من الستاف.', code_ph: 'كود 4 أرقام', checked: 'اتسجّلت ✓ — شكراً إنك جيت',
    stamps: '{n} من 5 أختام', reward_ready: 'مكافأتك جاهزة — ورّيها للستاف', redeem: 'استخدم مكافأتي',
    ask_stay: 'اطلب إقامة', ask_table: 'احجز ترابيزة لجروب', ask_group: 'اطلب زيارة جروب',
    from: 'من', to: 'لحد', people: 'عدد الأشخاص', note_ph: 'أي حاجة لازم يعرفوها', send: 'ابعت الطلب', sent: 'اتبعت — هيردّوا هنا.',
    my_req: 'طلباتك', cancel: 'إلغاء', pay_note: 'دلوقتي بتدفع للمكان مباشرة؛ الدفع أونلاين جاي.',
    plan_with: 'اعمل خطة هنا', map: 'افتح في الخرايط', call: 'اتصل',
    e_code: 'الكود ده مش صح.', e_slow: 'محاولات كتير — استنى شوية.', e_yours: 'ده مكانك إنت.', e_date: 'راجع التواريخ.', e_err: 'ماحصلش — جرّب تاني', e_setup: 'محتاجة خطوة كمان على السيرفر.', e_offline: 'إنت أوفلاين.', not_yet: 'لسه مكملتش 5 أختام.',
    none_mine: 'صفحة مكانك هتظهر هنا أول ما فريق Moments يقبل طلبك.',
    host_go: 'الهوستس بيتوثّقوا ببطاقة الأول.', host_btn: 'وثّقني كهوست',
  },
};

export const bw = (lang, k) => (W[lang] && W[lang][k]) || W.en[k] || k;
export const fill = (s, o) => Object.keys(o).reduce((a, k) => a.split('{' + k + '}').join(String(o[k])), s);

/* the nine kinds — what each one gets, and which fields its page has */
export const TYPES = [
  { k: 'cafe', e: '☕', en: 'Café', ar: 'كافيه', fields: ['hours', 'table', 'price_pp'], ask: 'table', counter: true,
    get: { en: ['Groups in your quiet hours', 'Guests check in with your code', 'Stamps that bring them back', 'Group table requests'], ar: ['جروبات في ساعاتك الهادية', 'الضيوف بيعملوا check-in بكودك', 'أختام بترجّعهم تاني', 'طلبات ترابيزات للجروبات'] } },
  { k: 'restaurant', e: '🍽️', en: 'Restaurant', ar: 'مطعم', fields: ['hours', 'table', 'price_pp'], ask: 'table', counter: true,
    get: { en: ['Group dinners on the map', 'Verified guests, counted', 'Stamps for regulars', 'Table requests for groups'], ar: ['عشوات جروبات على الخريطة', 'ضيوف متوثّقين ومتعدّين', 'أختام للزباين الدايمين', 'طلبات ترابيزات للجروبات'] } },
  { k: 'shop', e: '🛍️', en: 'Shop', ar: 'محل', fields: ['hours', 'sells', 'perk'], counter: true, orders: true,
    get: { en: ['Your page and photos', 'Check-ins and stamps', 'Things people can order through Moments'], ar: ['صفحتك وصورك', 'check-ins وأختام', 'حاجات الناس تطلبها من خلال Moments'] } },
  { k: 'hotel', e: '🏨', en: 'Hotel', ar: 'فندق', fields: ['price_night', 'beds', 'checkin_t', 'includes'], ask: 'stay',
    get: { en: ['Stay requests from groups and travellers', 'Your page with photos and prices', 'Trips that end at your door'], ar: ['طلبات إقامة من جروبات ومسافرين', 'صفحتك بالصور والأسعار', 'رحلات بتخلص عندك'] } },
  { k: 'hostel', e: '🛏️', en: 'Hostel', ar: 'هوستل', fields: ['price_night', 'beds', 'checkin_t', 'includes'], ask: 'stay', counter: true,
    get: { en: ['Travellers who want to meet people', 'Stay requests', 'Your common room on the map for plans'], ar: ['مسافرين عايزين يتعرّفوا على ناس', 'طلبات إقامة', 'الريسبشن بتاعك على الخريطة للخطط'] } },
  { k: 'home', e: '🏡', en: 'Homes & apartments', ar: 'شقق وبيوت', fields: ['price_night', 'beds', 'checkin_t', 'includes'], ask: 'stay',
    get: { en: ['Short-stay requests from verified people', 'Photos, price a night, what’s included', 'You accept or decline each one'], ar: ['طلبات إقامة قصيرة من ناس متوثّقين', 'صور وسعر الليلة واللي شامل', 'إنت اللي بتقبل أو تعتذر'] } },
  { k: 'activity', e: '🧗', en: 'Activity place', ar: 'مكان أنشطة', fields: ['hours', 'price_from', 'group_max', 'duration', 'perk'], ask: 'group', counter: true,
    get: { en: ['Groups who want something to do', 'Group visit requests', 'Check-ins and stamps'], ar: ['جروبات عايزة تعمل حاجة', 'طلبات زيارة جروبات', 'check-ins وأختام'] } },
  { k: 'org', e: '🌱', en: 'Organisation', ar: 'منظمة', fields: ['link'], plans: true,
    get: { en: ['Reach people with plans on the map', 'Volunteers who really show up', 'Your page with what you do'], ar: ['توصل للناس بخطط على الخريطة', 'متطوعين بيجوا بجد', 'صفحتك باللي بتعمله'] } },
  { k: 'host', e: '🧭', en: 'Host or guide', ar: 'هوست أو مرشد', fields: [], host: true,
    get: { en: ['A verified badge', 'Trips and plans you lead', 'People who rate you after'], ar: ['علامة توثيق', 'رحلات وخطط إنت بتقودها', 'ناس بتقيّمك بعدها'] } },
];
export const typeOf = (k) => TYPES.find((x) => x.k === k) || TYPES[0];
export const tname = (lang, ty) => (lang === 'ar' ? ty.ar : ty.en);

export const INCLUDES = [
  ['breakfast', 'Breakfast', 'فطار'], ['wifi', 'Wi-Fi', 'واي فاي'], ['ac', 'AC', 'تكييف'], ['kitchen', 'Kitchen', 'مطبخ'],
  ['pool', 'Pool', 'حمام سباحة'], ['parking', 'Parking', 'جراج'], ['women', 'Women-only rooms', 'أوض للبنات بس'], ['sea', 'Sea view', 'فيو بحر'],
];
