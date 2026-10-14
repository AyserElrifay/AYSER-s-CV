import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { C } from '../constants/theme';
import { ownerPrompts, ownerDecidePrompt, ownerSchedulePrompt } from '../services/reflection';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── THE STUDIO · QUESTIONS OF THE DAY ───────────────────────────────
   Members' suggestions wait here for a person. Approve puts one on the
   first free day (it then shows "suggested by …"); reject keeps it off.
   The team can also write a day's question itself. Owner-only: the
   database refuses anybody else. */

const Btn = ({ label, onPress, solid, danger }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ marginEnd: 8, marginTop: 8 }}>
    <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: solid ? C.text : 'transparent', borderWidth: 1, borderColor: danger ? '#DC2626' : solid ? C.text : C.line }}>
      <Text style={{ color: solid ? C.bg : danger ? '#DC2626' : C.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

export const PromptsTab = () => {
  const [data, setData] = useState(null);
  const [day, setDay] = useState(tomorrow());
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState(null);
  const load = () => ownerPrompts().then((r) => setData(r || false));
  useEffect(() => { load(); }, []);

  if (data === false) return <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 40 }}>Run the latest SQL to turn on Reflection.</Text>;
  if (data == null) return <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} />;

  const decide = async (s, yes) => { tapLight(); const r = await ownerDecidePrompt(s.id, yes, null); if (r && r.ok) { tapSuccess(); setMsg(yes ? 'Scheduled for ' + r.day : 'Rejected'); load(); } };
  const schedule = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || body.trim().length < 5) { setMsg('A date like 2026-10-20 and a question.'); return; }
    const r = await ownerSchedulePrompt(day, body.trim());
    if (r && r.ok) { tapSuccess(); setBody(''); setMsg('Saved for ' + day); load(); } else setMsg('Could not save (' + ((r && r.reason) || 'error') + ')');
  };

  return (
    <View>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>Suggested by members</Text>
      {!data.pending.length ? <Text style={{ color: C.dim, marginTop: 8 }}>Nothing waiting.</Text> : data.pending.map((s) => (
        <View key={s.id} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginTop: 10 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{s.body}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>{'by ' + (s.name || 'a member')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Btn label="Approve — first free day" solid onPress={() => decide(s, true)} />
            <Btn label="Reject" danger onPress={() => decide(s, false)} />
          </View>
        </View>
      ))}

      <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginTop: 24 }}>Write a day's question</Text>
      <TextInput value={day} onChangeText={setDay} placeholder="2026-10-20" placeholderTextColor={C.faint}
        style={{ color: C.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8, marginTop: 8, outlineStyle: 'none' }} />
      <TextInput value={body} onChangeText={setBody} maxLength={200} placeholder="What is one small thing that made you smile today?" placeholderTextColor={C.faint}
        style={{ color: C.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8, marginTop: 8, outlineStyle: 'none' }} />
      <Btn label="Save" solid onPress={schedule} />
      {msg ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{msg}</Text> : null}

      <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginTop: 24 }}>Coming up</Text>
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>Days with no question here use the built-in list of 30.</Text>
      {data.upcoming.map((d) => (
        <View key={d.day} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '800' }}>{d.day + (d.by ? ' · suggested by ' + d.by : '')}</Text>
          <Text style={{ color: C.text, fontSize: 14.5, marginTop: 2 }}>{d.body}</Text>
        </View>
      ))}
    </View>
  );
};
