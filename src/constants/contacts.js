/* ─── WHO TO WRITE TO ─────────────────────────────────────────────────
   Ayser set up one mailbox for every job on therealmoments.com (Zoho).
   Every address the app shows or sends from comes from here, so an
   email always lands with the people who handle it.
     team       account emails (sign-up, password reset, sign-in link) —
                sent by Supabase Auth (.github/workflows/setup-backend.yml)
     support    help, a problem, privacy, a takedown notice
     community  hosts, teachers, safety and reports
     partners   cafés, restaurants, organisations, the business portal
     founder    Ayser himself: the founder's note, press */
export const MAIL = {
  team: 'team@therealmoments.com',
  support: 'support@therealmoments.com',
  community: 'community@therealmoments.com',
  partners: 'partners@therealmoments.com',
  founder: 'ayser@therealmoments.com',
};
export const mailto = (to, subject) => 'mailto:' + to + (subject ? '?subject=' + encodeURIComponent(subject) : '');
