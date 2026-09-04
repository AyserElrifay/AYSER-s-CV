import { Platform } from 'react-native';

/* ─── ONE LINK, TWO WAYS OUT ─────────────────────────────────────────
   Moments already shared moments, stories and profiles this way —
   ?post=, ?story=, ?u= — and groups were the one thing you could not
   pass to anybody. A group nobody can link to is a group that only
   grows by somebody happening to search for it, which is not how
   anybody has ever joined a group.

   The rule the rest of the app follows and this keeps: the link is the
   same link whether it goes into a Moments chat or into WhatsApp. There
   is no special in-app format that breaks when someone forwards it
   outside, because that is exactly what people do with links. */

export const APP_ORIGIN = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  return window.location.origin + window.location.pathname;
};

/* A group, or one post on its wall. The post id rides along so the link
   lands you on the thing somebody meant to show you, rather than at the
   top of a wall where you have to go looking for it. */
export function groupLink(groupId, postId) {
  const base = APP_ORIGIN();
  if (!groupId) return base;
  return base + '?group=' + encodeURIComponent(groupId)
    + (postId ? '&gp=' + encodeURIComponent(postId) : '');
}

/* Outside the app: the real share sheet where there is one, the
   clipboard where there is not, and the raw link on screen as the last
   resort — because a share that silently does nothing is worse than an
   ugly one. Returns which of the three happened so the caller can say
   the right thing. */
export async function shareOut(url, text) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'none';
  const payload = { title: 'Moments', text: text || '', url };
  try {
    if (navigator.share) { await navigator.share(payload); return 'shared'; }
  } catch (e) {
    /* AbortError is somebody closing the sheet on purpose. That is not a
       failure and must not fall through to copying something they just
       decided not to send. */
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (e) {
    return 'manual';
  }
}
