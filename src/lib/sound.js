/* ─── WHOSE SOUND IS IT ───────────────────────────────────────────────
   Ayser: "خلي الفديوز ليها سوندرز و الناس ممكن تسمح او تلغي ده ان الناس
   تreuse sound و تعمل بيه فديو تاني".

   Two different things get called "the sound of a video" and the app
   has to keep them apart, because the rules are not the same:

     · a TRACK somebody chose from the music hub. It is licensed, it is
       already credited, and anybody may use it — that is what the hub
       is for.
     · the ORIGINAL sound: whatever was recorded when the video was
       made. Somebody's voice, their street, their song. That belongs
       to the person who filmed it, and whether anybody else may build
       on it is THEIR decision — which is exactly what he asked for.

   The default is that reuse is allowed, because a sound nobody may
   touch is not a sound, it is a file. But it is a switch, it is on the
   post, and turning it off is honoured everywhere the sound appears
   rather than only on the screen that shows the switch.

   All pure, all checkable:

       node scripts/check-sound.mjs
*/

/* What the chip under a video should say, and what a tap on it may do. */
export function soundOfPost(row, { authorName } = {}) {
  if (!row) return null;
  const name = authorName || (row.user && row.user.name) || 'Someone';

  /* A track from the hub: already licensed, already credited. */
  if (row.sound_title) {
    return {
      kind: 'track',
      title: row.sound_title,
      artist: row.sound_artist || '',
      url: row.sound_url || null,
      postId: null,
      reuse: true,
      emoji: '🎵',
    };
  }

  /* Otherwise it is whatever was recorded — and only a video has that. */
  const isVideo = row.type === 'reel' || row.type === 'vod';
  if (!isVideo || !row.media_url) return null;
  return {
    kind: 'original',
    title: 'Original sound',
    artist: name,
    /* the video file IS the audio source: an <audio> element plays the
       sound track of an mp4 or a webm perfectly well, and it saves
       storing the same seconds twice */
    url: row.media_url,
    postId: row.id,
    reuse: row.sound_reuse !== false,
    emoji: '🎙️',
  };
}

/* May somebody else build on this? A track from the hub: yes, that is
   what it is for. Somebody's own recording: only if they said so. */
export function canReuse(sound) {
  if (!sound || !sound.url) return false;
  if (sound.kind === 'track') return true;
  return sound.reuse !== false;
}

/* What gets attached to the NEW video when somebody reuses a sound.
   `soundPostId` is what makes "videos made with this sound" a real
   list later, rather than a guess based on matching titles. */
export function reuseSound(sound) {
  if (!canReuse(sound)) return null;
  return {
    title: sound.title,
    artist: sound.artist,
    audio_url: sound.url,
    kind: sound.kind,
    soundPostId: sound.kind === 'original' ? sound.postId : null,
  };
}

/* The line under a reused sound: it has to credit the person it came
   from, every time, without them having to ask. */
export function soundCredit(sound) {
  if (!sound) return '';
  return sound.kind === 'original'
    ? sound.title + ' · ' + sound.artist
    : [sound.title, sound.artist].filter(Boolean).join(' · ');
}
