import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchMyMates } from '../services/mates';
import { searchProfiles } from '../services/social';
import { AV_NEUTRAL } from '../constants/mockData';
import { tapLight, tapSelection } from '../utils/feedback';
import { useStable } from '../hooks/useStable';

/* Pick the people who are actually in the moment. Your mates come up
   first because that's who you're usually with; the search reaches
   everyone else. Real accounts only — there is nobody in this list who
   isn't a person on this app. */

export const TagPeoplePicker = ({ selected = [], onDone, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mates, setMates] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(selected);

  useEffect(() => {
    if (!SUPABASE_READY || !user) { setMates([]); return; }
    fetchMyMates(user.id).then(setMates).catch(() => setMates([]));
  }, [user]);

  useEffect(() => {
    const term = q.trim();
    if (!SUPABASE_READY || term.length < 2) { setFound([]); return; }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchProfiles(term)
        .then((rows) => { if (alive) setFound((rows || []).filter((p) => !user || p.id !== user.id)); })
        .catch(() => { if (alive) setFound([]); })
        .finally(() => { if (alive) setSearching(false); });
    }, 260);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, user]);

  const toggle = (p) => {
    tapSelection();
    setPicked((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : list.concat(p)));
  };

  const term = q.trim();
  const list = term.length >= 2
    ? found
    : (mates || []);

  const Row = useStable(({ p }) => {
    const on = picked.some((x) => x.id === p.id);
    return (
      <Pressable onPress={() => toggle(p)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16 }}>
          <Image source={{ uri: p.avatar_url || AV_NEUTRAL }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.glassHi }} />
          <View style={{ flex: 1, marginLeft: 11 }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }}>
              {p.name || 'Explorer'}{p.country_flag ? ' ' + p.country_flag : ''}
            </Text>
            {p.handle ? <Text style={{ color: C.faint, fontSize: 12, marginTop: 1 }}>@{p.handle}</Text> : null}
          </View>
          <Ionicons
            name={on ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={on ? C.purple : C.faint}
          />
        </View>
      </Pressable>
    );
  });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={19} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', flex: 1, textAlign: 'center' }}>Tag people</Text>
          <Pressable onPress={() => { tapLight(); onDone(picked); }} hitSlop={10} style={{ width: 60, alignItems: 'flex-end' }}>
            <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>Done</Text>
          </Pressable>
        </View>

        <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14 }}>
          <Ionicons name="search" size={15} color={C.faint} />
          <TextInput
            value={q} onChangeText={setQ}
            placeholder="Search people" placeholderTextColor={C.faint}
            autoCapitalize="none"
            style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 10, marginLeft: 8 }}
          />
          {searching ? <ActivityIndicator size="small" color={C.purple} /> : null}
        </View>

        {picked.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            {picked.map((p) => (
              <Pressable key={p.id} onPress={() => toggle(p)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purpleSoft, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, marginRight: 8 }}>
                <Image source={{ uri: p.avatar_url || AV_NEUTRAL }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800', marginLeft: 7 }}>{p.name || 'Explorer'}</Text>
                <Ionicons name="close" size={13} color={C.purple} style={{ marginLeft: 6 }} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }}>
            {term.length >= 2 ? 'RESULTS' : 'YOUR MATES'}
          </Text>
          {mates === null && term.length < 2 ? (
            <ActivityIndicator color={C.purple} style={{ marginTop: 20 }} />
          ) : list.length ? (
            list.map((p) => <Row key={p.id} p={p} />)
          ) : (
            <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, paddingVertical: 30, lineHeight: 20 }}>
              {term.length >= 2
                ? 'Nobody by that name here yet.'
                : 'Add some mates and they\'ll show up here — or search for anyone by name.'}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
