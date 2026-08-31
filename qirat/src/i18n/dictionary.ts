/**
 * Arabic and English from day one, not Arabic added later.
 *
 * The dictionary is typed against the English keys, so a missing Arabic string
 * is a compile error rather than an English word appearing mid-sentence in an
 * Arabic interface.
 */
export type Locale = 'en' | 'ar';

export const LOCALES: Locale[] = ['en', 'ar'];

export function directionOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

const en = {
  'brand.name': 'Qirat',
  'brand.tagline': 'Every deal you sign, priced and paid.',

  'nav.deals': 'Deals',
  'nav.tasks': 'My tasks',
  'nav.statements': 'Statements',
  'nav.services': 'Services',
  'nav.settings': 'Settings',
  'nav.signOut': 'Sign out',
  'nav.language': 'العربية',

  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create your agency',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.agencyName': 'Agency name',
  'auth.yourName': 'Your name',
  'auth.workspace': 'Workspace address',
  'auth.workspaceHelp': 'Your email belongs to more than one agency. Which one?',
  'auth.noAccount': 'No account yet?',
  'auth.haveAccount': 'Already have an account?',
  'auth.failed': 'That email and password do not match an account.',
  'auth.passwordHint': 'At least 10 characters. Length beats punctuation.',
  'auth.creating': 'Creating your agency…',
  'auth.signingIn': 'Signing in…',

  'signup.promise': 'You will land on a working deal card, not an empty screen.',
  'signup.included': 'Your agency arrives with five services priced, a brand kit, and a sample deal.',

  'deal.margin': 'Margin',
  'deal.price': 'Agreed price',
  'deal.cost': 'Cost',
  'deal.profit': 'Gross profit',
  'deal.houseShare': 'House share',
  'deal.distributable': 'To be split',
  'deal.delivery': 'Delivery',
  'deal.client': 'Client',
  'deal.noDelivery': 'No date set',
  'deal.floor': 'Floor',
  'deal.target': 'Target',
  'deal.ceiling': 'Ceiling',
  'deal.dragHint': 'Drag to price',
  'deal.close': 'Close the deal',
  'deal.sendForApproval': 'Send for approval',
  'deal.belowFloorNote': 'Under the floor for this service. The owner signs this one off.',
  'deal.saving': 'Saving',
  'deal.saved': 'Saved',
  'deal.saveFailed': 'Could not save. Your price is still here — try again.',
  'deal.frozenNote': 'Closed. Price, currency and split are frozen on this deal.',
  'deal.sentForApproval': 'Sent to the owner. You will see it here when they decide.',

  'cost.title': 'Costs',
  'cost.spent': 'Spent',
  'cost.of': 'of',
  'cost.over': 'over estimate',
  'cost.under': 'under estimate',
  'cost.driftAlert':
    'Spending has passed the estimate. The margin above is now on what was actually spent, not on what was planned.',
  'cost.none': 'Nothing recorded yet. Until costs go in, the margin above is a guess.',
  'cost.unconverted': 'recorded in another currency and not counted yet',
  'cost.add': 'Record a cost',
  'cost.amount': 'Amount',
  'cost.vendor': 'Paid to',
  'cost.date': 'Date',
  'cost.save': 'Add',
  'cost.saving': 'Adding',
  'cost.cancel': 'Cancel',
  'cost.saveFailed': 'Could not add that cost. Nothing was lost — try again.',
  'cost.badAmount': 'Enter an amount, like 2,500',
  'deal.status.draft': 'Draft',
  'deal.status.pending_approval': 'Awaiting approval',
  'deal.status.won': 'Won',
  'deal.status.lost': 'Lost',

  'margin.healthy': 'Healthy',
  'margin.thin': 'Thin',
  'margin.belowFloor': 'Below floor',
  'margin.loss': 'Losing money',
  'margin.unpriced': 'Not priced yet',

  'role.owner': 'Owner',
  'role.account_manager': 'Account manager',
  'role.member': 'Member',
  'role.partner': 'Partner',

  'home.owner.title': 'Every deal in the agency',
  'home.manager.title': 'Your pipeline',
  'home.member.title': 'Today',
  'home.partner.title': 'Your statements',

  'empty.deals.title': 'No deals yet',
  'empty.deals.body': 'Add a client, pick a service, and drag the price. The margin moves as you do.',
  'empty.tasks.title': 'Nothing assigned to you today',
  'empty.tasks.body': 'Tasks appear here when a deal you are on is closed. Nothing to do until then.',
  'empty.statements.title': 'No statements yet',
  'empty.statements.body':
    'A statement is issued when a payout period closes. It will list every deal you touched and what you are owed.',

  'catalogue.title': 'Service catalogue',
  'catalogue.band': 'Floor, target, ceiling',
  'catalogue.internal': 'Internal only. A client is shown one number.',

  'member.plain': 'You are signed in as a member. This view holds no financial information.',
  'audit.title': 'Recent activity',
  'audit.empty': 'Nothing recorded yet.',
} as const;

export type StringKey = keyof typeof en;

const ar: Record<StringKey, string> = {
  'brand.name': 'قيراط',
  'brand.tagline': 'كل صفقة توقّعها، مُسعّرة ومدفوعة.',

  'nav.deals': 'الصفقات',
  'nav.tasks': 'مهامي',
  'nav.statements': 'الكشوف',
  'nav.services': 'الخدمات',
  'nav.settings': 'الإعدادات',
  'nav.signOut': 'تسجيل الخروج',
  'nav.language': 'English',

  'auth.signIn': 'تسجيل الدخول',
  'auth.signUp': 'أنشئ وكالتك',
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.agencyName': 'اسم الوكالة',
  'auth.yourName': 'اسمك',
  'auth.workspace': 'عنوان مساحة العمل',
  'auth.workspaceHelp': 'بريدك مرتبط بأكثر من وكالة. أي واحدة؟',
  'auth.noAccount': 'ليس لديك حساب؟',
  'auth.haveAccount': 'لديك حساب بالفعل؟',
  'auth.failed': 'البريد الإلكتروني وكلمة المرور لا يطابقان أي حساب.',
  'auth.passwordHint': 'عشرة أحرف على الأقل. الطول أهم من الرموز.',
  'auth.creating': 'جارٍ إنشاء وكالتك…',
  'auth.signingIn': 'جارٍ تسجيل الدخول…',

  'signup.promise': 'ستصل إلى بطاقة صفقة جاهزة، لا إلى شاشة فارغة.',
  'signup.included': 'تصل وكالتك بخمس خدمات مُسعّرة، وهوية بصرية، وصفقة تجريبية.',

  'deal.margin': 'الهامش',
  'deal.price': 'السعر المتفق عليه',
  'deal.cost': 'التكلفة',
  'deal.profit': 'إجمالي الربح',
  'deal.houseShare': 'حصة الوكالة',
  'deal.distributable': 'القابل للتوزيع',
  'deal.delivery': 'التسليم',
  'deal.client': 'العميل',
  'deal.noDelivery': 'لا يوجد تاريخ',
  'deal.floor': 'الأرضية',
  'deal.target': 'المستهدف',
  'deal.ceiling': 'السقف',
  'deal.dragHint': 'اسحب لتسعير الصفقة',
  'deal.close': 'اقفل الصفقة',
  'deal.sendForApproval': 'ابعت للموافقة',
  'deal.belowFloorNote': 'تحت الأرضية لهذه الخدمة. المالك هو من يوافق عليها.',
  'deal.saving': 'جارٍ الحفظ',
  'deal.saved': 'تم الحفظ',
  'deal.saveFailed': 'تعذّر الحفظ. سعرك لم يضع — حاول مرة أخرى.',
  'deal.frozenNote': 'مغلقة. السعر والعملة والتقسيم مجمّدة على هذه الصفقة.',
  'deal.sentForApproval': 'أُرسلت إلى المالك. ستظهر هنا عند اتخاذ القرار.',

  'cost.title': 'التكاليف',
  'cost.spent': 'المصروف',
  'cost.of': 'من',
  'cost.over': 'فوق التقدير',
  'cost.under': 'تحت التقدير',
  'cost.driftAlert':
    'المصروف تعدّى التقدير. الهامش فوق محسوب الآن على ما صُرف فعلاً، لا على ما خُطّط له.',
  'cost.none': 'لم تُسجَّل أي تكلفة. بدون التكاليف، الهامش فوق مجرد تخمين.',
  'cost.unconverted': 'مسجّلة بعملة أخرى ولم تُحتسب بعد',
  'cost.add': 'سجّل تكلفة',
  'cost.amount': 'المبلغ',
  'cost.vendor': 'مدفوع إلى',
  'cost.date': 'التاريخ',
  'cost.save': 'أضف',
  'cost.saving': 'جارٍ الإضافة',
  'cost.cancel': 'إلغاء',
  'cost.saveFailed': 'تعذّرت إضافة التكلفة. لم يضع شيء — حاول مرة أخرى.',
  'cost.badAmount': 'اكتب مبلغاً، مثل ٢٥٠٠',
  'deal.status.draft': 'مسودة',
  'deal.status.pending_approval': 'بانتظار الموافقة',
  'deal.status.won': 'مكسوبة',
  'deal.status.lost': 'خاسرة',

  'margin.healthy': 'صحي',
  'margin.thin': 'رفيع',
  'margin.belowFloor': 'تحت الأرضية',
  'margin.loss': 'خسارة',
  'margin.unpriced': 'غير مُسعّرة',

  'role.owner': 'المالك',
  'role.account_manager': 'مدير الحسابات',
  'role.member': 'عضو',
  'role.partner': 'شريك',

  'home.owner.title': 'كل صفقات الوكالة',
  'home.manager.title': 'صفقاتك',
  'home.member.title': 'اليوم',
  'home.partner.title': 'كشوفك',

  'empty.deals.title': 'لا توجد صفقات بعد',
  'empty.deals.body': 'أضف عميلاً، واختر خدمة، وحرّك السعر. يتحرك الهامش معك.',
  'empty.tasks.title': 'لا مهام مسندة إليك اليوم',
  'empty.tasks.body': 'تظهر المهام هنا عند إغلاق صفقة أنت جزء منها. لا شيء حتى ذلك الحين.',
  'empty.statements.title': 'لا توجد كشوف بعد',
  'empty.statements.body':
    'يصدر الكشف عند إقفال فترة الدفع. سيعرض كل صفقة شاركت فيها وما هو مستحق لك.',

  'catalogue.title': 'دليل الخدمات',
  'catalogue.band': 'الحد الأدنى، المستهدف، الأعلى',
  'catalogue.internal': 'للاستخدام الداخلي فقط. يرى العميل رقماً واحداً.',

  'member.plain': 'أنت مسجّل كعضو. لا تحتوي هذه الشاشة على أي معلومات مالية.',
  'audit.title': 'النشاط الأخير',
  'audit.empty': 'لم يُسجَّل شيء بعد.',
};

const DICTIONARIES: Record<Locale, Record<StringKey, string>> = { en, ar };

export function translator(locale: Locale) {
  const dictionary = DICTIONARIES[locale];
  return (key: StringKey): string => dictionary[key];
}
