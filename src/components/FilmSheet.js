import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchReviews, saveReview, deleteReview, watchOptions } from '../services/films';
import { openPartner } from '../services/broker';
import { tapLight, tapSuccess } from '../utils/feedback';

/* One film: what it is, where to watch it legally, and what the people
   here made of it. The catalogue's global score and this crowd's score
   sit side by side and are never averaged together — they measure
   different things. */

const Stars = ({ value, size = 18, onPick }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Pressable key={i} disabled={!onPick} onPress={() => onPick && onPick(i)} hitSlop={4} style={{ paddingRight: 3 }}>
        <Ionicons name={i <= value ? 'star' : 'star-outline'} size={size} color={i <= value ? C.gold : C.faint} />
      </Pressable>
    ))}
  </View>
);

export const FilmSheet = ({ film, ourScore, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reviews, setReviews] = useState(null);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (!SUPABASE_READY) { setReviews([]); return; }
    fetchReviews(film.id)
      .then((rows) => {
        setReviews(rows);
        const mine = user && rows.find((r) => r.user_id === user.id);
        if (mine) { setStars(mine.stars); setBody(mine.body || ''); }
      })
      .catch(() => setReviews([]));
  }, [film.id, user]);

  const submit = async () => {
    if (!SUPABASE_READY || !user) { setNote('Sign in to review'); return; }
    if (!stars) { setNote('Pick a star rating first'); return; }
    setBusy(true);
    try {
      await saveReview(film.id, user.id, stars, body);
      tapSuccess();
      setReviews(await fetchReviews(film.id));
      setNote('Saved');
      onSaved && onSaved();
    } catch (e) { setNote('Could not save'); }
    finally { setBusy(false); setTimeout(() => setNote(null), 2200); }
  };

  const removeMine = async () => {
    if (!user) return;
    try {
      await deleteReview(film.id, user.id);
      setStars(0); setBody('');
      setReviews(await fetchReviews(film.id));
      onSaved && onSaved();
    } catch (e) {}
  };

  const mine = user && (reviews || []).find((r) => r.user_id === user.id);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <View>
            {film.backdrop_url ? (
              <Image source={{ uri: film.backdrop_url }} style={{ width: '100%', height: 210 }} />
            ) : (
              <LinearGradient colors={['#4C1D95', '#1E1B4B']} style={{ height: 210 }} />
            )}
            <LinearGradient colors={['transparent', C.bg]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }} />
            <Pressable onPress={onClose} hitSlop={10}
              style={{ position: 'absolute', top: insets.top + 8, left: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-down" size={20} color="#FFF" />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: -46 }}>
            {film.poster_url ? (
              <Image source={{ uri: film.poster_url }} style={{ width: 96, height: 144, borderRadius: 12, backgroundColor: C.glassHi }} />
            ) : null}
            <View style={{ flex: 1, marginLeft: 14, justifyContent: 'flex-end' }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{film.title}</Text>
              <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3 }}>
                {[film.year, (film.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {film.rating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
                    <Ionicons name="star" size={13} color={C.gold} />
                    <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800', marginLeft: 4 }}>{film.rating}</Text>
                    <Text style={{ color: C.faint, fontSize: 11, marginLeft: 4 }}>worldwide</Text>
                  </View>
                ) : null}
                {ourScore && ourScore.votes ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="star" size={13} color={C.purple} />
                    <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800', marginLeft: 4 }}>{ourScore.stars}</Text>
                    <Text style={{ color: C.faint, fontSize: 11, marginLeft: 4 }}>here · {ourScore.votes}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {film.overview ? (
            <Text style={{ color: C.dim, fontSize: 14, lineHeight: 21, paddingHorizontal: 16, marginTop: 16 }}>
              {film.overview}
            </Text>
          ) : null}

          {/* where to watch — a link to a service that legally carries it */}
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, marginTop: 22, marginBottom: 4 }}>
            WHERE TO WATCH
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            {watchOptions(film).map((o) => (
              <Pressable key={o.id}
                onPress={() => { tapLight(); openPartner(user, { id: 'film:' + film.id, partner: o.partner, url: o.url }); }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>{o.emoji}</Text>
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }}>{o.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={{ color: C.faint, fontSize: 10.5, paddingHorizontal: 16, lineHeight: 15 }}>
            These search the service itself — we don't host or stream anything. Moments may earn a
            commission, which never changes what you pay.
          </Text>

          {/* your take */}
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
            {mine ? 'YOUR REVIEW' : 'WHAT DID YOU THINK?'}
          </Text>
          <View style={{ paddingHorizontal: 16 }}>
            <Stars value={stars} size={26} onPick={(n) => { tapLight(); setStars(n); }} />
            <TextInput
              placeholder="Say why — one line is plenty"
              placeholderTextColor={C.faint}
              value={body} onChangeText={setBody} multiline
              style={{ color: C.text, fontSize: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginTop: 10, minHeight: 64 }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <Pressable onPress={submit} disabled={busy}
                style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, opacity: busy ? 0.5 : 1 }}>
                <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>{busy ? 'Saving…' : mine ? 'Update' : 'Post review'}</Text>
              </Pressable>
              {mine ? (
                <Pressable onPress={removeMine} style={{ marginLeft: 14 }}>
                  <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '800' }}>Remove</Text>
                </Pressable>
              ) : null}
              {note ? <Text style={{ color: C.dim, fontSize: 12, marginLeft: 12 }}>{note}</Text> : null}
            </View>
          </View>

          {/* everyone else */}
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, marginTop: 26, marginBottom: 6 }}>
            REVIEWS
          </Text>
          {reviews === null ? (
            <ActivityIndicator color={C.purple} style={{ marginTop: 16 }} />
          ) : reviews.length ? (
            reviews.map((r) => (
              <View key={r.user_id} style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.line }}>
                <Image source={{ uri: r.user && r.user.avatar_url }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.glassHi }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>
                      {(r.user && r.user.name) || 'Someone'}{r.user && r.user.country_flag ? ' ' + r.user.country_flag : ''}
                    </Text>
                    <View style={{ marginLeft: 8 }}><Stars value={r.stars} size={12} /></View>
                  </View>
                  {r.body ? <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{r.body}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: C.faint, fontSize: 12.5, paddingHorizontal: 16, paddingVertical: 18, textAlign: 'center' }}>
              Nobody here has said anything yet. Be the first.
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
