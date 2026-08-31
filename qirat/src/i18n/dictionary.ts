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

  'nav.payouts': 'Payouts',
  'payouts.title': 'Payouts',
  'payouts.policy': 'How profit is split',
  'payouts.policyNote':
    'Set once. Every deal freezes a copy of these the moment it closes, so changing them never restates a deal that has already been paid.',
  'payouts.noRules':
    'No split rules yet. Until you set them, every piastre of distributable profit stays with the agency.',
  'payouts.rule.partner_equity': 'Partner equity',
  'payouts.rule.manager_commission': 'Manager commission',
  'payouts.rule.bonus_pool': 'Team bonus pool',
  'payouts.retainedRule': 'Stays with the agency',
  'payouts.period': 'Period',
  'payouts.distributable': 'To be split',
  'payouts.bonusPool': 'Bonus pool',
  'payouts.retained': 'Retained',
  'payouts.dealsClosed': 'deals closed',
  'payouts.close': 'Close the period',
  'payouts.closing': 'Closing the period',
  'payouts.closed': 'Closed',
  'payouts.open': 'Open',
  'payouts.nothing': 'No deals closed in this period. There is nothing to pay out yet.',
  'payouts.allClosed': 'Every period so far is closed.',
  'payouts.openNext': 'Open the next period',
  'payouts.opening': 'Opening',
  'payouts.periodExists': 'A period already starts on that date.',
  'payouts.badDates': 'Those dates do not make a period.',
  'payouts.willReceive': 'Will receive',
  'payouts.received': 'Received',
  'payouts.statements': 'Statements',
  'payouts.myStatements': 'Your statements',
  'payouts.noStatements':
    'No statements yet. One is issued for you when a payout period closes, listing every deal you touched and what it earned you.',
  'payouts.print': 'Print',
  'payouts.adjusted': 'after correction',
  'payouts.skipped': 'closed at no profit, so they pay nobody',
  'payouts.ownerOnly': 'Only the owner can close a period.',
  'payouts.alreadyClosed': 'That period is already closed.',
  'payouts.closeFailed': 'Could not close the period. Nothing was issued — try again.',
  'payouts.unbalanced':
    'The period does not balance and nothing was issued. This is a bug, not a rounding difference. Send this to support:',
  'payouts.immutableNote':
    'Statements are fixed once issued. A correction is a new entry against the original, never an edit to it.',
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
  'catalogue.costToDeliver': 'Cost to deliver',
  'catalogue.breakdown': 'What it is made of',
  'catalogue.marginAtFloor': 'Margin at the floor',
  'catalogue.marginAtTarget': 'Margin at target',
  'catalogue.startingRates':
    'These rates are a starting structure, not your numbers. Replace them with what you actually pay and every margin in the product gets more honest.',

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

  'nav.payouts': 'الدفعات',
  'payouts.title': 'الدفعات',
  'payouts.policy': 'كيف يُقسَّم الربح',
  'payouts.policyNote':
    'تُضبط مرة واحدة. كل صفقة تُجمِّد نسخة منها لحظة إغلاقها، فتغييرها لا يمسّ صفقة صُرفت بالفعل.',
  'payouts.noRules':
    'لا توجد قواعد تقسيم بعد. حتى تضبطها، يبقى كل قرش من الربح القابل للتوزيع مع الوكالة.',
  'payouts.rule.partner_equity': 'حصة شريك',
  'payouts.rule.manager_commission': 'عمولة مدير الحساب',
  'payouts.rule.bonus_pool': 'حافز الفريق',
  'payouts.retainedRule': 'يبقى مع الوكالة',
  'payouts.period': 'الفترة',
  'payouts.distributable': 'القابل للتوزيع',
  'payouts.bonusPool': 'حافز الفريق',
  'payouts.retained': 'المحتجز',
  'payouts.dealsClosed': 'صفقة مغلقة',
  'payouts.close': 'اقفل الفترة',
  'payouts.closing': 'جارٍ إقفال الفترة',
  'payouts.closed': 'مغلقة',
  'payouts.open': 'مفتوحة',
  'payouts.nothing': 'لا صفقات مغلقة في هذه الفترة. لا يوجد ما يُصرف بعد.',
  'payouts.allClosed': 'كل الفترات حتى الآن مقفولة.',
  'payouts.openNext': 'افتح الفترة التالية',
  'payouts.opening': 'جارٍ الفتح',
  'payouts.periodExists': 'فيه فترة بتبدأ في التاريخ ده بالفعل.',
  'payouts.badDates': 'التواريخ دي مش بتكوّن فترة.',
  'payouts.willReceive': 'سيستلم',
  'payouts.received': 'استلم',
  'payouts.statements': 'الكشوف',
  'payouts.myStatements': 'كشوفك',
  'payouts.noStatements':
    'لا توجد كشوف بعد. يصدر كشفك عند إقفال فترة دفع، ويعرض كل صفقة شاركت فيها وما حققته لك.',
  'payouts.print': 'اطبع',
  'payouts.adjusted': 'بعد التصحيح',
  'payouts.skipped': 'أُغلقت بلا ربح، فلا تصرف لأحد',
  'payouts.ownerOnly': 'المالك وحده يقدر يقفل الفترة.',
  'payouts.alreadyClosed': 'الفترة دي مقفولة بالفعل.',
  'payouts.closeFailed': 'تعذّر إقفال الفترة. لم يصدر أي كشف — حاول مرة أخرى.',
  'payouts.unbalanced':
    'الفترة لا تتوازن ولم يصدر أي كشف. ده خطأ برمجي مش فرق تقريب. ابعت ده للدعم:',
  'payouts.immutableNote':
    'الكشوف ثابتة بعد إصدارها. التصحيح قيد جديد على الأصل، لا تعديل عليه.',
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
  'catalogue.costToDeliver': 'تكلفة التنفيذ',
  'catalogue.breakdown': 'مما تتكوّن',
  'catalogue.marginAtFloor': 'الهامش عند الأرضية',
  'catalogue.marginAtTarget': 'الهامش عند المستهدف',
  'catalogue.startingRates':
    'هذه الأسعار بنية بداية، وليست أرقامك. استبدلها بما تدفعه فعلاً وسيصبح كل هامش في المنتج أصدق.',

  'member.plain': 'أنت مسجّل كعضو. لا تحتوي هذه الشاشة على أي معلومات مالية.',
  'audit.title': 'النشاط الأخير',
  'audit.empty': 'لم يُسجَّل شيء بعد.',
};

const DICTIONARIES: Record<Locale, Record<StringKey, string>> = { en, ar };

export function translator(locale: Locale) {
  const dictionary = DICTIONARIES[locale];
  return (key: StringKey): string => dictionary[key];
}
