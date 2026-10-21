import React, { useState } from 'react';
import { lazyOverlay } from '../lib/lazyScreen';
import { pendingBiz, takeBiz, pendingPlace, takePlace, isBizDemo } from '../lib/bizLink';
import { useLang } from '../context/LanguageContext';

const BizHub = lazyOverlay(() => import('./biz').then((m) => ({ default: m.BizHub })));
const BizPage = lazyOverlay(() => import('./biz').then((m) => ({ default: m.BizPage })));

/* the business portal (…/?business=1), and a place from its QR
   (…/?place=<id>&c=<token>), once signed in. The demo
   (…/?business=demo) opens before sign-in too: it needs no account. */
export const BizLinkGate = ({ demoOnly }) => {
  const { lang } = useLang();
  const [open, setOpen] = useState(() => pendingBiz() && (!demoOnly || isBizDemo()));
  const [place, setPlace] = useState(() => pendingPlace());
  if (place && !demoOnly) return <BizPage id={place.id} autoCode={place.code} lang={lang} onClose={() => { takePlace(); setPlace(null); }} />;
  if (!open) return null;
  return <BizHub lang={lang} onClose={() => { takeBiz(); setOpen(false); }} />;
};
