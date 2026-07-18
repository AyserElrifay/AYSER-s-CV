import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, SUPABASE_READY } from '../lib/supabase';
import { useAuth } from './AuthContext';

/* ── REAL "online now" ──────────────────────────────────────────────
   Supabase Realtime Presence — not a poll, not a guess. Every signed-in
   device tracks itself on one shared channel; the server tells everyone
   else the instant it joins or drops (tab close, network loss, app
   background). No fabricated green dots: a user only shows online while
   their own connection is actually live. */

const PresenceCtx = createContext({ onlineIds: new Set(), isOnline: () => false });
export const usePresence = () => useContext(PresenceCtx);

export const PresenceProvider = ({ children }) => {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState(new Set());
  const channelRef = useRef(null);

  useEffect(() => {
    if (!SUPABASE_READY || !user) { setOnlineIds(new Set()); return; }

    const channel = supabase.channel('online-users', { config: { presence: { key: user.id } } });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      setOnlineIds(new Set(Object.keys(channel.presenceState())));
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    // re-announce when the tab comes back to the foreground — covers
    // laptops that suspended the network while backgrounded
    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden && channelRef.current) {
        channelRef.current.track({ online_at: new Date().toISOString() }).catch(() => {});
      }
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
      try { supabase.removeChannel(channel); } catch (e) {}
      channelRef.current = null;
    };
  }, [user && user.id]);

  const isOnline = (id) => onlineIds.has(id);

  return <PresenceCtx.Provider value={{ onlineIds, isOnline }}>{children}</PresenceCtx.Provider>;
};
