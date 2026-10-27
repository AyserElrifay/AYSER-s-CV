import { useEffect } from 'react';
import { askUpgrade } from '../services/membership';

/* ─── MOMENTS PLUS ────────────────────────────────────────────────────
   There is one place to become a member: the plans (Membership.js,
   PricingGate) — two cards, the quiet words, nothing else. This sheet
   used to be a second offer with its own emojis and its own promises;
   anything that still opens it lands on the plans instead. */
export const PlusSheet = ({ onClose }) => {
  useEffect(() => { askUpgrade('member'); if (onClose) onClose(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};
