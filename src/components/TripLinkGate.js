import React, { useEffect, useState } from 'react';
import { lazyOverlay } from '../lib/lazyScreen';
import { pendingTrip, takeTrip, onTrip, onInvite, takeInvite } from '../lib/tripLink';

const TripsSheet = lazyOverlay(() => import('./TripsSheet').then((m) => ({ default: m.TripsSheet })));
const TripInvite = lazyOverlay(() => import('./TripInvite').then((m) => ({ default: m.TripInvite })));

/* ─── OPENS A TRIP FROM ANYWHERE ───────────────────────────────────────
   A shared link (…/?trip=<id>) or a "it's open now" notification. It
   sits over the sign-in screen too: looking at a trip needs no account,
   so somebody a friend sent a trip to sees the trip first, not a form.
   "Sign in to book" keeps the trip waiting, and it opens again on the
   other side of signing in. */
export const TripLinkGate = ({ signedIn }) => {
  const [id, setId] = useState(() => pendingTrip());
  useEffect(() => onTrip(setId), []);
  if (!id) return null;
  const close = () => { takeTrip(); setId(null); };
  return (
    <TripsSheet focus={id} onClose={close}
      onNeedSignIn={signedIn ? undefined : () => setId(null) /* still pending: reopens once signed in */} />
  );
};

/* the invitation a booking brings, over whatever is on screen */
export const TripInviteGate = () => {
  const [id, setId] = useState(null);
  useEffect(() => onInvite(setId), []);
  if (!id) return null;
  return <TripInvite bookingId={id} onClose={() => { takeInvite(); setId(null); }} />;
};
