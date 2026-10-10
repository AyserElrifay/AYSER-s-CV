import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { lockFactors, passkeySupported, addPasskey, unlockWithPasskey, startCode, unlockWithCode, lockError } from '../services/studioLock';

/* ─── THE STUDIO IS LOCKED ────────────────────────────────────────────
   Shown before the Studio every time it is opened, and again after it
   has been in the background or open for a while. The database refuses
   every Studio action without a second step in the last 30 minutes
   (studio_fresh in RUN_ME.sql); this screen is how that step is taken.

   First time: set up a passkey (Face ID / fingerprint) and, as the way
   back if the phone is lost, an authenticator-app code. After that: one
   tap, or six digits. */

const Big = ({ icon, title, sub, onPress, busy, tone }) => (
  <Pressable onPress={onPress} disabled={busy} accessibilityRole="button"
    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, marginTop: 12, backgroundColor: tone || C.glass, borderWidth: tone ? 0 : 1, borderColor: C.line, opacity: busy ? 0.6 : 1 }}>
    <Ionicons name={icon} size={26} color={tone ? '#FFF' : C.text} />
    <View style={{ flex: 1, marginStart: 12 }}>
      <Text style={{ color: tone ? '#FFF' : C.text, fontSize: 15.5, fontWeight: '800' }}>{title}</Text>
      {sub ? <Text style={{ color: tone ? 'rgba(255,255,255,0.85)' : C.dim, fontSize: 12.5, marginTop: 2 }}>{sub}</Text> : null}
    </View>
    {busy ? <ActivityIndicator color={tone ? '#FFF' : C.text} /> : null}
  </Pressable>
);

export const StudioLock = ({ identity, onUnlocked, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const [f, setF] = useState(null);           // { passkeys, codes }
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);   // { id, qr, secret } while adding a code
  const load = () => lockFactors().then(setF).catch(() => setF({ passkeys: [], codes: [] }));
  useEffect(() => { load(); }, []);

  const run = async (key, fn) => {
    setBusy(key); setErr(null);
    try { await fn(); tapSuccess(); onUnlocked(); } catch (e) { setErr(lockError(e)); }
    setBusy(null);
  };
  const hasAny = f && (f.passkeys.length || f.codes.length);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 22, paddingBottom: insets.bottom + 30 }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={{ alignSelf: 'flex-start' }}>
            <Ionicons name="close" size={26} color={C.text} />
          </Pressable>
          <Text style={{ fontSize: 40, marginTop: 18 }}>🔒</Text>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{hasAny ? 'Unlock the Studio' : 'Lock the Studio first'}</Text>
          <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
            {hasAny
              ? 'Your password is not enough here. The server opens nothing without this step, and asks again after 30 minutes.'
              : (identity === 'team' ? 'Before your first look, add a lock only you can open.' : 'Before anything opens, add a lock only you can open — the server will refuse every Studio action without it.')}
          </Text>

          {f == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> : hasAny && !setup ? (
            <>
              {f.passkeys.length && passkeySupported() ? (
                <Big icon="finger-print" title="Face ID / fingerprint" tone={C.purple} busy={busy === 'pk'}
                  onPress={() => { tapLight(); run('pk', () => unlockWithPasskey(f.passkeys[0].id)); }} />
              ) : null}
              {f.codes.length ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1 }}>{f.passkeys.length ? 'OR A CODE FROM YOUR APP' : 'CODE FROM YOUR AUTHENTICATOR APP'}</Text>
                  <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
                    placeholder="123 456" placeholderTextColor={C.faint} maxLength={6}
                    style={{ color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: 6, borderBottomWidth: 1.5, borderBottomColor: C.line, paddingVertical: 10, marginTop: 6 }} />
                  <Big icon="key-outline" title="Unlock with the code" busy={busy === 'code'}
                    onPress={() => { if (code.length === 6) run('code', () => unlockWithCode(f.codes[0].id, code)); }} />
                </View>
              ) : null}
              {/* the second kind, as a way back if a phone is lost */}
              {!f.codes.length ? (
                <Pressable onPress={async () => { setBusy('setup'); setErr(null); try { setSetup(await startCode()); } catch (e) { setErr(lockError(e)); } setBusy(null); }} style={{ marginTop: 18 }}>
                  <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' }}>Add a code too, in case this phone is lost</Text>
                </Pressable>
              ) : null}
              {!f.passkeys.length && passkeySupported() ? (
                <Pressable onPress={() => run('addpk', addPasskey)} style={{ marginTop: 14 }}>
                  <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' }}>Use Face ID / fingerprint on this phone</Text>
                </Pressable>
              ) : null}
            </>
          ) : setup ? (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 21 }}>1. Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and scan this — or type the key.</Text>
              {setup.qr ? <Image source={{ uri: setup.qr }} style={{ width: 200, height: 200, alignSelf: 'center', marginTop: 14, backgroundColor: '#FFF', borderRadius: 12 }} /> : null}
              <Text selectable style={{ color: C.text, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 10, letterSpacing: 1 }}>{setup.secret}</Text>
              <Text style={{ color: C.text, fontSize: 14.5, marginTop: 16 }}>2. Type the 6 digits it shows.</Text>
              <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6}
                placeholder="123 456" placeholderTextColor={C.faint}
                style={{ color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: 6, borderBottomWidth: 1.5, borderBottomColor: C.line, paddingVertical: 10, marginTop: 6 }} />
              <Big icon="checkmark-circle-outline" title="Turn the code on" tone={C.purple} busy={busy === 'verify'}
                onPress={() => { if (code.length === 6) run('verify', () => unlockWithCode(setup.id, code)); }} />
            </View>
          ) : (
            <>
              {passkeySupported() ? (
                <Big icon="finger-print" title="Face ID / fingerprint" sub="This phone unlocks the Studio with your face or finger" tone={C.purple} busy={busy === 'addpk'}
                  onPress={() => { tapLight(); run('addpk', addPasskey); }} />
              ) : null}
              <Big icon="keypad-outline" title="A code from an authenticator app" sub="Works on any phone — keep it as your way back" busy={busy === 'setup'}
                onPress={async () => { tapLight(); setBusy('setup'); setErr(null); try { setSetup(await startCode()); } catch (e) { setErr(lockError(e)); } setBusy(null); }} />
              <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 14 }}>Best: both. Face ID for every day, the code if the phone is ever lost.</Text>
            </>
          )}

          {err ? <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 16 }}>{err}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
