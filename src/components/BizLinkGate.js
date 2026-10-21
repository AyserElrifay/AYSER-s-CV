import React, { useState } from 'react';
import { lazyOverlay } from '../lib/lazyScreen';
import { pendingBiz, takeBiz } from '../lib/bizLink';
import { useLang } from '../context/LanguageContext';

const BizHub = lazyOverlay(() => import('./biz').then((m) => ({ default: m.BizHub })));

/* the business portal, opened from …/?business=1 once signed in */
export const BizLinkGate = () => {
  const { lang } = useLang();
  const [open, setOpen] = useState(() => pendingBiz());
  if (!open) return null;
  return <BizHub lang={lang} onClose={() => { takeBiz(); setOpen(false); }} />;
};
