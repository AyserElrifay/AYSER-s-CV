import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import {
  fetchHighlights, createHighlight, deleteHighlight, addToHighlight,
  removeHighlightItem, fetchHighlightCandidates,
} from '../services/highlights';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useLang } from '../context/LanguageContext';

/* ── HIGHLIGHTS ─────────────────────────────────────────────────────
   The row of circles under a profile. Everything in here is something
   the person actually posted — a story they kept, or a moment of
   theirs. There are no sample highlights: an account with none shows
   nothing at all, except to its owner, who gets the button to make
   the first one. */

const SIZE = 62;

const Circle = ({ uri, label, onPress, onLongPress, plus }) => (
  <Pressable onPress={onPress} onLongPress={onLongPress} style={{ alignItems: 'center', marginRight: 16, width: SIZE + 8 }}>
    <View style={{
      width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1.5,
      borderColor: plus ? C.line : C.purple, padding: 3,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: plus ? C.glass : 'transparent',
    }}>
      {plus ? (
        <Ionicons name="add" size={24} color={C.dim} />
      ) : uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: SIZE / 2 - 3 }} />
      ) : (
        <View style={{ width: '100%', height: '100%', borderRadius: SIZE / 2 - 3, backgroundColor: C.glassHi }} />
      )}
    </View>
    <Text numberOfLines={1} style={{ color: plus ? C.faint : C.dim, fontSize: 11.5, marginTop: 5, fontWeight: '600', maxWidth: SIZE + 8, textAlign: 'center' }}>
      {label}
    </Text>
  </Pressable>
);

/* Full-screen viewer: tap the right half for the next picture, the
   left half to go back, and out at the end. */
const HighlightViewer = ({ highlight, isMine, onClose, onDeleted }) => {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const items = highlight.items || [];
  const item = items[i];

  const next = () => { if (i + 1 < items.length) setI(i + 1); else onClose(); };
  const prev = () => setI((n) => Math.max(0, n - 1));

  const dropItem = async () => {
    if (!item) return;
    tapLight();
    try { await removeHighlightItem(item.id); } catch (e) {}
    const rest = items.filter((x) => x.id !== item.id);
    highlight.items = rest;
    if (!rest.length) { onDeleted && onDeleted(highlight.id); onClose(); return; }
    setI(Math.max(0, i - 1));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {item ? (
          <Image source={{ uri: item.media_url }} style={{ flex: 1 }} resizeMode="contain" />
        ) : null}

        {/* progress pips */}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12, flexDirection: 'row' }}>
          {items.map((x, n) => (
            <View key={x.id} style={{ flex: 1, height: 3, borderRadius: 2, marginHorizontal: 2, backgroundColor: n <= i ? '#FFF' : 'rgba(255,255,255,0.35)' }} />
          ))}
        </View>

        <View style={{ position: 'absolute', top: insets.top + 24, left: 14, right: 14, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900', flex: 1 }} numberOfLines={1}>{highlight.title}</Text>
          {isMine ? (
            <Pressable onPress={dropItem} hitSlop={10} style={{ marginRight: 16 }}>
              <Ionicons name="trash-outline" size={19} color="#FFF" />
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>
        </View>

        {item && item.caption ? (
          <Text style={{ position: 'absolute', bottom: insets.bottom + 70, left: 20, right: 20, color: '#FFF', fontSize: 14.5, lineHeight: 21, textAlign: 'center' }}>
            {item.caption}
          </Text>
        ) : null}

        {isMine ? (
          confirm ? (
            <View style={{ position: 'absolute', bottom: insets.bottom + 18, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(17,24,39,0.92)', borderRadius: 14, padding: 12 }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', flex: 1 }}>{t('hl_delete_q')}</Text>
              <Pressable onPress={async () => { try { await onDeleted(highlight.id); } catch (e) {} onClose(); }} style={{ marginRight: 12 }}>
                <Text style={{ color: C.coral, fontSize: 13, fontWeight: '900' }}>{t('delete')}</Text>
              </Pressable>
              <Pressable onPress={() => setConfirm(false)}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>{t('keep_word')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirm(true)} style={{ position: 'absolute', bottom: insets.bottom + 20, alignSelf: 'center' }} hitSlop={10}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: '800' }}>{t('hl_delete')}</Text>
            </Pressable>
          )
        ) : null}

        {/* the tap zones sit under the buttons above */}
        <Pressable onPress={prev} style={{ position: 'absolute', left: 0, top: insets.top + 60, bottom: 90, width: '35%' }} />
        <Pressable onPress={next} style={{ position: 'absolute', right: 0, top: insets.top + 60, bottom: 90, width: '65%' }} />
      </View>
    </Modal>
  );
};

/* Make one, or add to one: pick from your own stories and moments. */
const HighlightComposer = ({ userId, target, onClose, onSaved }) => {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(target ? target.title : '');
  const [cands, setCands] = useState(null);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetchHighlightCandidates(userId).then(setCands).catch(() => setCands([]));
  }, [userId]);

  const toggle = (c) => {
    tapSelection();
    setPicked((list) => (list.some((x) => x.key === c.key) ? list.filter((x) => x.key !== c.key) : list.concat(c)));
  };

  const save = async () => {
    if (busy) return;
    if (!picked.length) { setErr('Pick at least one picture'); return; }
    setBusy(true); setErr(null);
    try {
      if (target) await addToHighlight(target.id, picked);
      else await createHighlight(userId, title || 'Highlight', picked);
      tapSuccess();
      onSaved();
    } catch (e) {
      setErr('Could not save that.');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={19} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', flex: 1, textAlign: 'center' }}>
            {target ? 'Add to ' + target.title : 'New highlight'}
          </Text>
          <Pressable onPress={save} hitSlop={10} style={{ width: 60, alignItems: 'flex-end' }}>
            <Text style={{ color: busy ? C.faint : C.purple, fontSize: 14, fontWeight: '900' }}>{busy ? '…' : 'Save'}</Text>
          </Pressable>
        </View>

        {!target ? (
          <View style={{ marginHorizontal: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14 }}>
            <TextInput
              value={title} onChangeText={setTitle}
              placeholder={t('hl_name_ph')} placeholderTextColor={C.faint}
              maxLength={40}
              style={{ color: C.text, fontSize: 14, paddingVertical: 11 }}
            />
          </View>
        ) : null}

        {err ? <Text style={{ color: C.coral, fontSize: 12.5, textAlign: 'center', marginTop: 10 }}>{err}</Text> : null}

        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, marginTop: 16, marginBottom: 6 }}>
          {t('hl_your_stories')}
        </Text>

        {cands === null ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 26 }} />
        ) : cands.length ? (
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: insets.bottom + 30 }}>
            {cands.map((c) => {
              const on = picked.some((x) => x.key === c.key);
              return (
                <Pressable key={c.key} onPress={() => toggle(c)} style={{ width: '33.33%', padding: 4 }}>
                  <View style={{ aspectRatio: 1, borderRadius: 10, overflow: 'hidden', borderWidth: on ? 2.5 : 1, borderColor: on ? C.purple : C.line }}>
                    <Image source={{ uri: c.media_url }} style={{ width: '100%', height: '100%' }} />
                    {on ? (
                      <View style={{ position: 'absolute', top: 5, right: 5, backgroundColor: C.purple, borderRadius: 999, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={13} color="#FFF" />
                      </View>
                    ) : null}
                    <View style={{ position: 'absolute', bottom: 4, left: 5, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>{c.from}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, paddingVertical: 30, lineHeight: 20 }}>
            {t('hl_empty')}
          </Text>
        )}
      </View>
    </Modal>
  );
};

export const HighlightsRail = ({ userId, isMine }) => {
  const { t } = useLang();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null);      // highlight being watched
  const [composing, setComposing] = useState(null); // 'new' | highlight

  const load = useCallback(() => {
    if (!SUPABASE_READY || !userId) { setRows([]); return; }
    fetchHighlights(userId).then(setRows).catch(() => setRows([]));
  }, [userId]);

  useEffect(load, [load]);

  const drop = async (id) => {
    setRows((list) => list.filter((h) => h.id !== id));
    try { await deleteHighlight(id, userId); } catch (e) { load(); }
  };

  if (!SUPABASE_READY) return null;
  if (!rows.length && !isMine) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, marginTop: 20, alignItems: 'flex-start' }}>
        {isMine ? (
          <Circle plus label={t('new_story')} onPress={() => { tapLight(); setComposing('new'); }} />
        ) : null}
        {rows.map((h) => (
          <Circle
            key={h.id}
            uri={h.cover_url || (h.items && h.items[0] && h.items[0].media_url)}
            label={h.title}
            onPress={() => { tapSelection(); if ((h.items || []).length) setOpen(h); else setComposing(h); }}
            onLongPress={isMine ? () => { tapLight(); setComposing(h); } : undefined}
          />
        ))}
      </ScrollView>

      {open ? (
        <HighlightViewer
          highlight={open}
          isMine={isMine}
          onClose={() => { setOpen(null); load(); }}
          onDeleted={drop}
        />
      ) : null}

      {composing ? (
        <HighlightComposer
          userId={userId}
          target={composing === 'new' ? null : composing}
          onClose={() => setComposing(null)}
          onSaved={() => { setComposing(null); load(); }}
        />
      ) : null}
    </>
  );
};
