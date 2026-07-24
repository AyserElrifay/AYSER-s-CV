import { Platform } from 'react-native';

/* Sharing, done once and used everywhere — a moment, a profile, a story.
   Uses the phone's real share sheet when the browser offers it, and
   quietly falls back to copying the link so the button ALWAYS does
   something. Returns what happened so the caller can show the right
   toast: 'shared' | 'copied' | 'unsupported' | { url } when even the
   clipboard is blocked. */

export function appLink(params) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const base = window.location.origin + window.location.pathname;
  const q = Object.keys(params)
    .filter((k) => params[k] != null && params[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
  return q ? base + '?' + q : base;
}

export async function shareLink({ url, title, text }) {
  if (!url) return 'unsupported';
  const payload = { title: title || 'Moments', text: text || '', url };
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share(payload);
      return 'shared';
    }
  } catch (e) {
    // the user closing the share sheet is not a failure — don't fall through
    if (e && e.name === 'AbortError') return 'shared';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (e) {
    return { url }; // last resort: hand the link back so it can be shown
  }
}

/* Share a moment. */
export function sharePost(post) {
  return shareLink({
    url: appLink({ post: post.id }),
    text: (post.caption || 'Check this moment ✨').slice(0, 120),
  });
}

/* Share a profile — opens straight to that person's space. */
export function shareProfile(profile) {
  const handle = profile.handle || profile.username || null;
  return shareLink({
    url: appLink({ u: profile.id }),
    title: 'Moments',
    text: (profile.name || 'Someone') + (handle ? ' (@' + handle + ')' : '') + ' on Moments ✨',
  });
}
