import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchHelpArticles } from '../services/help';
import { tapLight, tapSelection } from '../utils/feedback';

const SUPPORT_EMAIL = 'ayseryourlifecoach@gmail.com';

/* Real Help & Support — articles come straight from the database (the
   owner edits them in Moments Studio), grouped by category, searchable,
   tap to expand. Never a hardcoded FAQ baked into the app bundle. */
export const HelpSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const [articles, setArticles] = useState(null); // null = loading
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!SUPABASE_READY) { setArticles([]); return; }
    fetchHelpArticles()
      .then(setArticles)
      .catch((e) => {
        setArticles([]);
        setErr(/does not exist|schema/i.test(e.message || '') ? 'One step left: run the latest supabase/RUN_ME.sql to turn on Help & Support.' : null);
      });
  }, []);

  const filtered = (articles || []).filter((a) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return a.title.toLowerCase().includes(s) || a.body.toLowerCase().includes(s) || a.category.toLowerCase().includes(s);
  });
  const byCategory = {};
  filtered.forEach((a) => { (byCategory[a.category] = byCategory[a.category] || []).push(a); });

  const emailUs = () => {
    tapLight();
    Linking.openURL('mailto:' + SUPPORT_EMAIL + '?subject=Moments%20support').catch(() => {});
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.bg2 }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10} style={{ marginRight: 10 }}>
            <Ionicons name="chevron-back" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', flex: 1 }}>Help & Support</Text>
        </View>

        <View style={{ padding: 16, paddingBottom: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13 }}>
            <Ionicons name="search" size={16} color={C.faint} />
            <TextInput
              placeholder="Search help articles…" placeholderTextColor={C.faint} value={q} onChangeText={setQ}
              style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 11, marginLeft: 8 }}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {err ? (
            <Text style={{ color: C.coral, fontSize: 12, marginBottom: 14, lineHeight: 17 }}>⚠️ {err}</Text>
          ) : null}

          {articles === null ? (
            <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>Loading…</Text>
          ) : Object.keys(byCategory).length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Text style={{ fontSize: 26 }}>🤔</Text>
              <Text style={{ color: C.faint, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                {q.trim() ? 'Nothing found for "' + q.trim() + '"' : 'No help articles yet'}
              </Text>
            </View>
          ) : (
            Object.keys(byCategory).map((cat) => (
              <View key={cat} style={{ marginBottom: 18 }}>
                <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>{cat.toUpperCase()}</Text>
                <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' }}>
                  {byCategory[cat].map((a, i) => {
                    const open = openId === a.id;
                    return (
                      <View key={a.id}>
                        <Pressable onPress={() => { tapSelection(); setOpenId(open ? null : a.id); }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.line }}>
                            <Ionicons name={a.icon || 'help-circle-outline'} size={17} color={C.purple} style={{ marginRight: 11 }} />
                            <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{a.title}</Text>
                            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.faint} />
                          </View>
                        </Pressable>
                        {open ? (
                          <Text style={{ color: C.dim, fontSize: 13, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 16, paddingLeft: 42 }}>{a.body}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          <Pressable onPress={emailUs} style={{ marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft, borderRadius: 14, paddingVertical: 14 }}>
              <Ionicons name="mail-outline" size={17} color={C.purple} />
              <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900', marginLeft: 8 }}>Still stuck? Email us — we actually reply</Text>
            </View>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
};
