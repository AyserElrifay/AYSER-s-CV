/* ── THE VIDEOS AROUND THE ONE YOU OPENED ──
   Ayser: open a video from the feed and keep swiping, up and down, like
   Reels. The feed says what is on screen and how to star a post
   (setVideoQueue); a post card that opens a video asks for the videos
   in the same order (videosAround) and starts the viewer on its own. */
let queue = { posts: [], vibes: {}, onVibe: null };
export const setVideoQueue = (posts, vibes, onVibe) => { queue = { posts: Array.isArray(posts) ? posts : [], vibes: vibes || {}, onVibe: onVibe || null }; };
export const getVideoQueue = () => queue;
export const isVideoPost = (p) => !!p && (p.type === 'vod' || p.type === 'reel') && !!p.media;
// the feed's videos with `post` among them (or just `post`, when it was opened from somewhere else)
export const videosAround = (post) => {
  const list = queue.posts.filter(isVideoPost);
  const i = list.findIndex((p) => p.id === post.id);
  return i < 0 ? { reels: [post], index: 0, mine: true } : { reels: list, index: i, mine: false };
};
