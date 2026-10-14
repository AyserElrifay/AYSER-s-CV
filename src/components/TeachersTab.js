import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image, Linking } from 'react-native';
import { C } from '../constants/theme';
import { ownerTeachers, ownerDecideTeacher } from '../services/offers';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── THE STUDIO · PEOPLE WHO WANT TO TEACH ───────────────────────────
   Read it, look at their work, say yes or no. Yes puts the subjects on
   their profile; then name them on a workshop in Trips & deals → Who
   leads it (role: Teacher). Anybody teaching children: meet them in
   person first. Owner-only, enforced by the database. */

const Btn = ({ label, onPress, solid, danger }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ marginEnd: 8, marginTop: 8 }}>
    <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: solid ? C.text : 'transparent', borderWidth: 1, borderColor: danger ? '#DC2626' : solid ? C.text : C.line }}>
      <Text style={{ color: solid ? C.bg : danger ? '#DC2626' : C.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

export const TeachersTab = () => {
  const [rows, setRows] = useState(null);
  const load = () => ownerTeachers().then((r) => setRows(Array.isArray(r) ? r : false));
  useEffect(() => { load(); }, []);
  if (rows === false) return <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 40 }}>Run the latest SQL to turn on teacher applications.</Text>;
  if (rows == null) return <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} />;
  if (!rows.length) return <Text style={{ color: C.dim, textAlign: 'center', paddingVertical: 30 }}>Nobody has applied to teach yet.</Text>;
  const decide = async (r, yes) => { tapLight(); const x = await ownerDecideTeacher(r.id, yes); if (x && x.ok) { tapSuccess(); load(); } };
  return (
    <View>
      {rows.map((r) => (
        <View key={r.id} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {r.avatar ? <Image source={{ uri: r.avatar }} style={{ width: 38, height: 38, borderRadius: 19, marginEnd: 10 }} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }}>{r.name || 'Member'}</Text>
              <Text style={{ color: C.dim, fontSize: 12.5 }}>{(r.subjects || []).join(' · ') + (r.years != null ? ' · ' + r.years + ' yrs' : '') + (r.city ? ' · ' + r.city : '')}</Text>
            </View>
            <Text style={{ color: r.status === 'approved' ? C.green : r.status === 'declined' ? '#DC2626' : '#D97706', fontSize: 12, fontWeight: '900' }}>{r.status.toUpperCase()}</Text>
          </View>
          {r.about ? <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, marginTop: 8 }}>{r.about}</Text> : null}
          {r.kids ? <Text style={{ color: '#B45309', fontSize: 12.5, fontWeight: '800', marginTop: 6 }}>🧸 Wants to teach children — meet them in person before saying yes.</Text> : null}
          {r.link ? <Pressable onPress={() => Linking.openURL(r.link).catch(() => {})}><Text style={{ color: C.purple, fontSize: 13, marginTop: 6 }} numberOfLines={1}>{r.link}</Text></Pressable> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {r.status !== 'approved' ? <Btn label="Approve" solid onPress={() => decide(r, true)} /> : null}
            {r.status !== 'declined' ? <Btn label={r.status === 'approved' ? 'Take it back' : 'Decline'} danger onPress={() => decide(r, false)} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
};
