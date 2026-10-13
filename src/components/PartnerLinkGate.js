import React, { useEffect, useState } from 'react';
import { lazyOverlay } from '../lib/lazyScreen';
import { pendingPartner, takePartner, onPartner } from '../lib/partnerLink';

const PartnerSheet = lazyOverlay(() => import('./PartnerSheet').then((m) => ({ default: m.PartnerSheet })));

/* the partner page, opened from …/?partner=1 or from anywhere in the
   app (openPartner). Sits over the sign-in screen too: a café owner
   applies without making an account. */
export const PartnerLinkGate = () => {
  const [kind, setKind] = useState(() => pendingPartner());
  useEffect(() => onPartner(setKind), []);
  if (!kind) return null;
  return <PartnerSheet first={kind} onClose={() => { takePartner(); setKind(null); }} />;
};
