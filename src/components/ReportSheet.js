import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { REPORT_REASONS, reportContent } from '../services/reports';
import { tapLight, tapSuccess } from '../utils/feedback';

/* A real report/takedown sheet, reusable for any content. Pick a reason,
   add an optional note (e.g. a rights-holder's copyright claim), send —
   it writes a genuine content_reports row. */
export const ReportSheet = ({ contentType, contentId, contentLabel, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reason, setReason] = useState(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true); setErr(null);
    try {
      if (SUPABASE_READY) {
        await reportContent({ reporterId: user && user.id, contentType, contentId, reason: reason.code, detail });
      }
      tapSuccess();
      setDone(true);
      setTimeout(() => onClose && onClose(), 1400);
    } catch (e) {
      setErr(e.message || 'Could not send the report — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: C.line, maxHeight: '82%', paddingBottom: insets.bottom + 14 }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 6 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>Report{contentLabel ? ' · ' + contentLabel : ''}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>

        {done ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30 }}>
            <Text style={{ fontSize: 34 }}>✅</Text>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>Thanks — we got it</Text>
            <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
              Our team reviews every report. If it breaks the rules or the law, it comes down.
            </Text>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text style={{ color: C.faint, fontSize: 12, marginBottom: 10, paddingHorizontal: 2 }}>
              Why are you reporting this? {contentType === 'track' ? 'For copyright, we may need your rights details below.' : ''}
            </Text>
            {REPORT_REASONS.map((r) => {
              const on = reason && reason.code === r.code;
              return (
                <Pressable key={r.code} onPress={() => { tapLight(); setReason(r); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purpleSoft : C.glass, borderWidth: 1, borderColor: on ? C.purple : C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{r.label}</Text>
                      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{r.hint}</Text>
                    </View>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? C.purple : C.faint} />
                  </View>
                </Pressable>
              );
            })}

            {reason ? (
              <TextInput
                placeholder={reason.code === 'copyright' ? 'Your name + proof you own the rights (link, release, etc.)' : 'Add any detail (optional)'}
                placeholderTextColor={C.faint}
                value={detail}
                onChangeText={setDetail}
                multiline
                style={{ color: C.text, fontSize: 13.5, minHeight: 64, textAlignVertical: 'top', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 2 }}
              />
            ) : null}

            {err ? <Text style={{ color: C.coral, fontSize: 12, marginTop: 10 }}>⚠️ {err}</Text> : null}

            <Pressable onPress={submit} disabled={!reason || busy} style={{ marginTop: 14 }}>
              <View style={{ backgroundColor: reason && !busy ? C.coral : C.glassHi, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: reason && !busy ? '#FFF' : C.faint, fontSize: 14.5, fontWeight: '900' }}>{busy ? 'Sending…' : 'Send report'}</Text>
              </View>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};
