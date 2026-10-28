/* ─── THE GLOBAL TRACK'S WORDS ───────────────────────────────────────
   Only components/GlobalTrack.js reads these, so they travel with it
   and not in the first download. English and Arabic. */
import { lw as base } from './loopWords';

const W = {
  en: {
    gt_title: 'Moments Level',
    gt_of: 'Level {n} of 4',
    gt_l1: 'Explorer', gt_l2: 'Connector', gt_l3: 'Global Citizen', gt_l4: 'Global Ready',
    gt_sub: 'Level up by going out: English Circles, Culture and Table Drops, and simple local volunteering days.',
    gt_circles: 'English Circles', gt_drops: 'Culture & Table Drops', gt_impact: 'Volunteering days',
    gt_next: 'For level {n}',
    gt_top: 'You are at the top level.',
    gt_track: 'Global Track',
    gt_cert: 'Levels 3 and 4 are your Global Citizen Certificate from Moments: a record of your language practice, the real meetups you came to and the volunteering you did. It prepares you to apply for Erasmus+ youth exchanges, international volunteering and partner travel programmes.',
    gt_locked: 'Opens at level 3',
    gt_pick: 'Where do you want to go?',
    gt_k_exchange: 'Erasmus+ youth exchange', gt_k_volunteer: 'International volunteering', gt_k_travel: 'Partner travel programme',
    gt_apply: 'Tell the team I am ready',
    gt_applied: 'Done. The team has your name and will contact you when a programme fits.',
    gt_err: 'It did not go through. Try again.',
    gt_open: 'Your feed has no time limit at level 4.',
    gt_roam: 'Travel & Global',
  },
  ar: {
    gt_title: 'مستواك في مومنتس',
    gt_of: 'المستوى {n} من ٤',
    gt_l1: 'مستكشف', gt_l2: 'بيتعرّف', gt_l3: 'مواطن عالمي', gt_l4: 'جاهز للعالم',
    gt_sub: 'اطلع مستوى لما تخرج: دواير الإنجليزي، خروجات الثقافة والترابيزات، وأيام تطوّع بسيطة في مدينتك.',
    gt_circles: 'دواير الإنجليزي', gt_drops: 'خروجات الثقافة والترابيزات', gt_impact: 'أيام التطوّع',
    gt_next: 'للمستوى {n}',
    gt_top: 'إنت في أعلى مستوى.',
    gt_track: 'المسار العالمي',
    gt_cert: 'المستوى ٣ و٤ هما شهادة المواطن العالمي من مومنتس: سجل بتمرينك على اللغة، والقعدات الحقيقية اللي حضرتها، والتطوّع اللي عملته. بيجهّزك تقدّم على تبادل شباب Erasmus+، والتطوّع برّه مصر، وبرامج السفر مع شركائنا.',
    gt_locked: 'يفتح في المستوى ٣',
    gt_pick: 'عايز تروح فين؟',
    gt_k_exchange: 'تبادل شباب Erasmus+', gt_k_volunteer: 'تطوّع برّه مصر', gt_k_travel: 'برنامج سفر مع شركائنا',
    gt_apply: 'قول للفريق إني جاهز',
    gt_applied: 'تمام. الفريق عنده اسمك وهيكلّمك لما يكون في برنامج مناسب.',
    gt_err: 'ماتبعتش. جرّب تاني.',
    gt_open: 'في المستوى ٤ الفيد بتاعك من غير حد للوقت.',
    gt_roam: 'سفر وعالمي',
  },
};
export const tw = (lang, k, vars) => {
  const row = W[lang === 'ar' ? 'ar' : 'en'];
  return base(lang, null, vars, row[k] != null ? row[k] : W.en[k]);
};
