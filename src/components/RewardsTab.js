import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { C } from '../constants/theme';
import { ownerRewards, ownerDecideReward } from '../services/green';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── THE STUDIO · REWARDS PEOPLE ASKED FOR ───────────────────────────
   A Plus discount, a training seat or a grant, asked for with XP that
   can only be earned by showing up. A person decides; the training and
   the grant come with sessions the member runs for others afterwards
   — mark them Done once they have. Owner-only, enforced by the
   database. */

const KIND = { plus_off: 'Half-price Plus · 3 months', training: 'Free training seat (teaches 1 session)', grant: 'Grant for a course or trip (runs 2 sessions)' };

const Btn = ({ label, onPress, solid, danger }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ marginEnd: 8, marginTop: 8 }}>
    <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: solid ? C.text : 'transparent', borderWidth: 1, borderColor: danger ? '#DC2626' : solid ? C.text : C.line }}>
      <Text style={{ color: solid ? C.bg : danger ? '#DC2626' : C.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

export const RewardsTab = () => {
  const [rows, setRows] = useState(null);
  const load = () => ownerRewards().then((r) => setRows(Array.isArray(r) ? r : false));
  useEffect(() => { load(); }, []);
  if (rows === false) return <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 40 }}>Run the latest SQL to turn on rewards.</Text>;
  if (rows == null) return <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} />;
  const set = async (r, status) => { tapLight(); const x = await ownerDecideReward(r.id, status); if (x && x.ok) { tapSuccess(); load(); } };
  if (!rows.length) return <Text style={{ color: C.dim, marginTop: 8 }}>Nobody has asked for a reward yet.</Text>;
  return (
    <View>
      {rows.map((r) => (
        <View key={r.id} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginTop: 10, opacity: r.status === 'pending' ? 1 : 0.7 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{KIND[r.kind] || r.kind}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{(r.name || '') + ' · ' + (r.email || '') + ' · ' + r.xp + ' XP · ' + r.status}</Text>
          {r.note ? <Text style={{ color: C.text, fontSize: 13.5, marginTop: 4, fontStyle: 'italic' }}>{'“' + r.note + '”'}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {r.status === 'pending' ? <Btn label="Approve" solid onPress={() => set(r, 'approved')} /> : null}
            {r.status === 'pending' ? <Btn label="Decline" danger onPress={() => set(r, 'declined')} /> : null}
            {r.status === 'approved' ? <Btn label="Done — they paid it forward" onPress={() => set(r, 'done')} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
};
