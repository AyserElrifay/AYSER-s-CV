import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { fetchReports, setReportStatus } from '../services/reports';
import { removeGatheringPhoto } from '../services/green';
import { fetchPendingHosts, documentUrl, decideHost } from '../services/hosts';
import { fetchSafetyQueue, decideReport, coachDone } from '../services/standing';
import { fetchTeam, teamAction, TEAM_ROLES } from '../services/team';
import { askAdvice } from '../services/advice';
import { useLang } from '../context/LanguageContext';
import { fetchFeedback, markFeedbackSeen } from '../services/feedback';
import { fetchStudioStats } from '../services/feedback';
import { fetchPendingVerifications, decideVerification, fetchPendingVenues, decideVenue } from '../services/profiles';
import { fetchTracks, setTrackApproval, harvestFreeMusic, harvestPublicDomainClassics, clearImportedTracks, countImportedTracks } from '../services/music';
import { fetchHelpArticles, createHelpArticle, updateHelpArticle, deleteHelpArticle } from '../services/help';
import { checkDatabase } from '../services/dbReadiness';
import { fetchBardiConfig, saveBardiConfig, fetchBardiKnowledge, addBardiKnowledge, deleteBardiKnowledge, invalidateBardiBrain } from '../services/bardiOwner';
import { AV_NEUTRAL } from '../constants/mockData';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useStable } from '../hooks/useStable';
import { recent, clearCrashes, asText } from '../lib/crashLog';
import { SheetHandle } from './SheetHandle';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── MOMENTS STUDIO · the owner's control panel ──────────────────────
   One place to run everything: live stats, the report queue, verification
   requests, music approvals and user feedback — all real data, owner-only.
   Bardi is built in: one tap summarises what needs attention. */

/* area: which team role may open it (studio_can in RUN_ME.sql). No
   area means the owner only. The server enforces this on every call;
   hiding a tab is only so nobody is shown a door that will not open. */
const TABS = [
  { k: 'safety', label: 'Safety', icon: 'shield-outline', area: 'safety' },
  { k: 'reports', label: 'Reports', icon: 'flag-outline', area: 'safety' },
  { k: 'hosts', label: 'Guides', icon: 'id-card-outline', area: 'verify' },
  { k: 'team', label: 'Team', icon: 'people-outline' },
  { k: 'venues', label: 'Venues', icon: 'business-outline' },
  { k: 'verify', label: 'Verify', icon: 'shield-checkmark-outline' },
  { k: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { k: 'feedback', label: 'Feedback', icon: 'chatbubbles-outline' },
  { k: 'help', label: 'Help', icon: 'help-circle-outline' },
  { k: 'bardi', label: 'Bardi', icon: 'sparkles-outline' },
  { k: 'errors', label: 'Errors', icon: 'bug-outline' },
  { k: 'db', label: 'Setup', icon: 'server-outline' },
];
const canOpen = (access, t) => !!access && (access.owner || (!!t.area && (access.role === 'all' || access.role === t.area)));

/* ── BARDI'S ADVICE, ON EVERY DECISION ───────────────────────────────
   Asked by itself when an item is shown (kept on the server after the
   first time, so it is paid for once). A recommendation, how sure, and
   the checks behind it — the buttons underneath are still the
   decision. See supabase/functions/studio-advice. */
const REC = {
  approve: ['Bardi: approve', '#16A34A'], reject: ['Bardi: reject', '#DC2626'], ask_more: ['Bardi: ask for more', '#D97706'],
  remove: ['Bardi: take it down', '#DC2626'], keep: ['Bardi: keep it', '#16A34A'],
};
const MARK = { ok: '✓', problem: '✗', unclear: '?' };
const ADVICE_ERR = { not_configured: 'Bardi needs ANTHROPIC_API_KEY to read applications.', not_allowed: 'Your role cannot ask about this.', no_item: 'Already decided.' };
const BardiAdvice = ({ kind, refId }) => {
  const { lang } = useLang();
  const [a, setA] = useState(null);       // null = asking
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(false);
  const ask = (refresh) => {
    setA(null); setErr(null);
    askAdvice(kind, refId, { lang: lang === 'ar' ? 'ar' : 'en', refresh }).then((r) => {
      if (r && r.ok && r.advice) setA(r.advice); else { setErr(ADVICE_ERR[r && r.error] || 'Bardi could not read this one.'); setA(false); }
    });
  };
  useEffect(() => { ask(false); }, [kind, refId]); // eslint-disable-line react-hooks/exhaustive-deps
  const rec = a && REC[a.recommendation];
  return (
    <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: C.purpleSoft }}>
      {a === null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={C.purple} />
          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800', marginStart: 8 }}>Bardi is reading it…</Text>
        </View>
      ) : !a ? (
        <Text style={{ color: C.dim, fontSize: 12.5 }}>{err}</Text>
      ) : (
        <>
          <Pressable onPress={() => { tapLight(); setOpen((o) => !o); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: rec ? rec[1] : C.text, fontSize: 13, fontWeight: '900', flex: 1 }}>{(rec ? rec[0] : 'Bardi') + ' · ' + a.confidence + ' confidence'}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.dim} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>{a.summary}</Text>
          {open ? (a.checks || []).map((c, i) => (
            <Text key={i} style={{ color: c.result === 'problem' ? C.coral : C.text, fontSize: 12, lineHeight: 17, marginTop: 5 }}>
              {MARK[c.result] + '  ' + c.label + (c.note ? ' — ' + c.note : '')}
            </Text>
          )) : null}
          {open ? (
            <Pressable onPress={() => ask(true)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={{ color: C.purple, fontSize: 12, fontWeight: '800' }}>Ask again</Text>
            </Pressable>
          ) : null}
        </>
      )}
      <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 6 }}>Advice only — you decide.{kind === 'host' ? ' Comparing the face with the card is yours.' : ''}</Text>
    </View>
  );
};

/* What is waiting, counted, each line opening its tab; then Bardi's
   three actions for today when the function can answer. */
const WAITING = [
  ['threats', 'safety', '⚠️', ['threat report — first', 'threat reports — first']],
  ['safetyOpen', 'safety', '🛡', ['reported chat', 'reported chats']],
  ['coachWaiting', 'safety', '🤝', ['person waiting for a coach session', 'people waiting for a coach session']],
  ['hostsPending', 'hosts', '🪪', ['guide / host application', 'guide / host applications']],
  ['venuesPending', 'venues', '🏢', ['organisation waiting', 'organisations waiting']],
  ['reportsOpen', 'reports', '🚩', ['content report', 'content reports']],
  ['feedbackNew', 'feedback', '💬', ['new feedback', 'new feedback']],
];
const Attention = ({ a, tabs, onTab, onClose }) => {
  const c = a.counts || {};
  const can = (k) => tabs.some((t) => t.k === k);
  const rows = WAITING.filter(([key, tab]) => c[key] > 0 && can(tab) && !(key === 'safetyOpen' && c.threats >= c.safetyOpen));
  return (
    <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, maxHeight: 300 }}>
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>WAITING FOR YOU</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={18} color={C.dim} /></Pressable>
        </View>
        {rows.length ? rows.map(([key, tab, emoji, label]) => (
          <Pressable key={key} onPress={() => { tapLight(); onTab(tab); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
            <Text style={{ width: 24, fontSize: 15 }}>{emoji}</Text>
            <Text style={{ flex: 1, color: C.text, fontSize: 13.5, fontWeight: '700' }}>{c[key] + ' ' + label[c[key] === 1 ? 0 : 1]}</Text>
            <Ionicons name="chevron-forward" size={15} color={C.faint} />
          </Pressable>
        )) : <Text style={{ color: C.text, fontSize: 13.5, marginTop: 6 }}>Nothing is waiting on a decision. ✓</Text>}
        {(a.actions || []).length ? (
          <>
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 12 }}>BARDI · TODAY</Text>
            {a.actions.map((x, i) => (
              <Pressable key={i} disabled={!x.tab || !can(x.tab)} onPress={() => { tapLight(); onTab(x.tab); }} style={{ marginTop: 8 }}>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{(i + 1) + '. ' + x.title}</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 1 }}>{x.why}</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 10 }}>
            {a.error === 'not_configured' ? "Bardi's three actions need ANTHROPIC_API_KEY." : a.error === 'no_function' ? "Bardi's three actions need the studio-advice function deployed." : a.error ? 'Bardi could not answer this time.' : ''}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

/* ── THE TEAM: made, paused and removed here, by the owner only ──────
   A member signs in on the normal sign-in screen with the username and
   password made here. Nothing is emailed anywhere. */
const makePassword = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(14);
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 1e9); }
  return Array.from(a, (n) => abc[n % abc.length]).join('');
};
const TEAM_ERR = { username: 'Username: 3–20 letters, numbers, _ or .', password: 'Password: at least 10 characters.', taken: 'That username is taken.', not_owner: 'Only the owner can do this.', create_failed: 'Could not create it — try another username.' };
const field = () => ({ color: C.text, fontSize: 14.5, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.bg2, marginTop: 8 });
const RolePick = ({ value, onChange }) => (
  <View style={{ flexDirection: 'row', marginTop: 8 }}>
    {TEAM_ROLES.map((r) => (
      <Pressable key={r.k} onPress={() => { tapLight(); onChange(r.k); }} style={{ marginRight: 6 }}>
        <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: value === r.k ? C.text : C.line, backgroundColor: value === r.k ? C.text : 'transparent' }}>
          <Text style={{ color: value === r.k ? C.bg : C.text, fontSize: 12.5, fontWeight: '800' }}>{r.label}</Text>
        </View>
      </Pressable>
    ))}
  </View>
);
const TeamMember = ({ m, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState(null);       // a new password being set
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState(null);
  const act = async (action, payload, after) => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { await teamAction(action, { user_id: m.user_id, ...(payload || {}) }); tapSuccess(); if (after) after(); onChanged(); }
    catch (e) { setMsg(TEAM_ERR[e.message] || 'Did not work — try again.'); }
    setBusy(false);
  };
  const btn = (label, onPress, tone) => (
    <Pressable onPress={onPress} disabled={busy} style={{ marginRight: 6, marginTop: 8 }}>
      <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: tone ? 0 : 1, borderColor: C.line, backgroundColor: tone || 'transparent' }}>
        <Text style={{ color: tone ? '#FFF' : C.text, fontSize: 12, fontWeight: '800' }}>{label}</Text>
      </View>
    </Pressable>
  );
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, opacity: busy ? 0.6 : 1 }}>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{m.username}{m.disabled ? '  · paused' : ''}</Text>
      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{m.last_sign_in ? 'Last signed in ' + String(m.last_sign_in).slice(0, 16).replace('T', ' ') : 'Has not signed in yet'}</Text>
      <RolePick value={m.role} onChange={(r) => { if (r !== m.role) act('set_role', { role: r }); }} />
      {pw != null ? (
        <View>
          <TextInput value={pw} onChangeText={setPw} autoCapitalize="none" placeholder="New password (10+ characters)" placeholderTextColor={C.faint} style={field()} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {btn('Make one', () => setPw(makePassword()))}
            {btn('Save password', () => act('set_password', { password: pw }, () => { setMsg('New password: ' + pw + ' — give it to them yourself.'); setPw(null); }), C.purple)}
            {btn('Cancel', () => setPw(null))}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {btn('New password', () => setPw(''))}
          {m.disabled ? btn('Resume', () => act('resume'), C.green) : btn('Pause', () => act('pause'))}
          {btn(armed ? 'Tap again: delete' : 'Remove', () => { if (armed) act('remove'); else setArmed(true); }, armed ? C.coral : null)}
        </View>
      )}
      {msg ? <Text selectable style={{ color: C.dim, fontSize: 12.5, marginTop: 8 }}>{msg}</Text> : null}
    </View>
  );
};
const TeamTab = () => {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [u, setU] = useState('');
  const [pw, setPw] = useState(() => makePassword());
  const [role, setRole] = useState('safety');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const load = () => fetchTeam().then((l) => { setList(l); setErr(null); }).catch(() => { setList([]); setErr(true); });
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (busy) return;
    setBusy(true); setMade(null);
    const username = u.trim().toLowerCase();
    try {
      await teamAction('create', { username, password: pw, role });
      tapSuccess(); setMade({ username, password: pw }); setU(''); setPw(makePassword()); load();
    } catch (e) { setMade({ error: TEAM_ERR[e.message] || 'Did not work. Is the team-admin function deployed?' }); }
    setBusy(false);
  };
  if (err) return <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 40 }}>Run the latest SQL (part 22) to manage the team here.</Text>;
  return (
    <>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 6 }}>ADD SOMEONE</Text>
      <TextInput value={u} onChangeText={setU} autoCapitalize="none" autoCorrect={false} placeholder="Username (e.g. mona)" placeholderTextColor={C.faint} style={field()} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput value={pw} onChangeText={setPw} autoCapitalize="none" autoCorrect={false} placeholder="Password" placeholderTextColor={C.faint} style={[field(), { flex: 1 }]} />
        <Pressable onPress={() => { tapLight(); setPw(makePassword()); }} hitSlop={8} style={{ marginStart: 8, marginTop: 8 }}>
          <Ionicons name="refresh" size={20} color={C.dim} />
        </Pressable>
      </View>
      <RolePick value={role} onChange={setRole} />
      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 6 }}>{(TEAM_ROLES.find((r) => r.k === role) || {}).sub}</Text>
      <Pressable onPress={create} disabled={busy || !u.trim()} style={{ marginTop: 12 }}>
        <View style={{ borderRadius: 14, backgroundColor: C.purple, paddingVertical: 12, alignItems: 'center', opacity: busy || !u.trim() ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>Create account</Text>}
        </View>
      </Pressable>
      {made ? (
        <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: made.error ? C.coralSoft : C.glass, borderWidth: 1, borderColor: C.line }}>
          {made.error ? <Text style={{ color: C.text, fontSize: 13 }}>{made.error}</Text> : (
            <Text selectable style={{ color: C.text, fontSize: 13, lineHeight: 19 }}>
              {'Made. Give them, in person or privately:\nUsername: ' + made.username + '\nPassword: ' + made.password + '\nThey sign in on the normal sign-in screen, then open the Studio link.'}
            </Text>
          )}
        </View>
      ) : null}
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 22 }}>THE TEAM</Text>
      {list == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 20 }} /> :
        list.length ? list.map((m) => <TeamMember key={m.user_id} m={m} onChanged={load} />) :
        <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>Nobody yet — just you.</Text>}
    </>
  );
};

/* One reported conversation: who, why, Bardi's reading, and the five
   messages themselves. A strike is given here, by a person — never by
   Bardi alone. */
const VERDICT = {
  threat: ['⚠️ Threat', '#DC2626'], violence: ['⚠️ Violence', '#DC2626'], sexual: ['🔞 Sexual', '#DB2777'],
  harassment: ['🚫 Harassment', '#EA580C'], hate: ['✋ Hate', '#EA580C'], unsure: ['❔ Unsure', '#6B7280'], none: ['✓ Nothing found', '#16A34A'],
};
const SafetyReport = ({ r, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const v = VERDICT[r.ai_verdict];
  const decide = async (strike) => {
    if (busy) return;
    setBusy(true);
    try { await decideReport(r.id, strike); if (strike) tapSuccess(); else tapLight(); onDone(r.id); } catch (e) { setBusy(false); }
  };
  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image source={{ uri: r.reported_avatar || AV_NEUTRAL }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{r.reported_name || 'Someone'}{r.strikes ? '  · ' + r.strikes + ' strike' + (r.strikes > 1 ? 's' : '') : ''}</Text>
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 1 }}>Reported for {r.reason} by {r.reporter_name || 'someone'} · {String(r.at || '').slice(0, 16).replace('T', ' ')}</Text>
        </View>
      </View>
      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: v ? v[1] : C.faint, fontSize: 12.5, fontWeight: '900' }}>{v ? 'Bardi: ' + v[0] : 'Bardi has not read it'}</Text>
      </View>
      {r.ai_reason ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{r.ai_reason}</Text> : null}
      <View style={{ marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
        {(r.messages || []).length ? (r.messages || []).map((m, i) => (
          <Text key={i} selectable style={{ color: C.text, fontSize: 13, lineHeight: 19, marginTop: i ? 6 : 0 }}>
            {(m.media ? '📷 ' : '') + (m.body || '')}
          </Text>
        )) : <Text style={{ color: C.faint, fontSize: 12.5 }}>No messages from them were left in the chat.</Text>}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10, opacity: busy ? 0.5 : 1 }}>
        <Pressable onPress={() => decide(false)} disabled={busy} style={{ marginRight: 8 }}>
          <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800' }}>No action</Text></View>
        </Pressable>
        <Pressable onPress={() => { if (armed) decide(true); else { tapLight(); setArmed(true); } }} disabled={busy}>
          <View style={{ borderRadius: 999, backgroundColor: C.coral, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{armed ? (r.strikes >= 1 ? 'Tap again: close the account' : 'Tap again: strike + coach session') : 'Give a strike'}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

/* One guide or host asking for the badge: the document and the selfie
   side by side, through links that expire in ten minutes. Decided here,
   and only here — then both photos are deleted (decideHost). */
const HostReview = ({ h, onDone }) => {
  const [doc, setDoc] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    documentUrl(h.doc_path).then((u) => { if (alive) setDoc(u); }).catch(() => {});
    documentUrl(h.selfie_path).then((u) => { if (alive) setSelfie(u); }).catch(() => {});
    return () => { alive = false; };
  }, [h.doc_path, h.selfie_path]);
  const decide = async (yes) => {
    if (busy) return;
    setBusy(true);
    try { await decideHost(h.user_id, yes); if (yes) tapSuccess(); else tapLight(); onDone(h.user_id); } catch (e) { setBusy(false); }
  };
  const pic = (u, label) => (
    <View style={{ flex: 1, marginRight: 8 }}>
      <View style={{ height: 150, borderRadius: 12, overflow: 'hidden', backgroundColor: C.glassHi }}>
        {u ? <Image source={{ uri: u }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : null}
      </View>
      <Text style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image source={{ uri: h.avatar_url || AV_NEUTRAL }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{(h.role === 'guide' ? '🪪 ' : '🙋 ') + (h.name || 'Someone')}</Text>
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 1 }}>
            {[h.role === 'guide' ? 'Tour guide · licence card' : 'Activity host · national ID', h.city, h.since ? 'since ' + h.since : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      {(h.langs && h.langs.length) || (h.areas && h.areas.length) ? (
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 8 }}>{[(h.langs || []).join(', '), (h.areas || []).join(', ')].filter(Boolean).join('  ·  ')}</Text>
      ) : null}
      {h.about ? <Text style={{ color: C.text, fontSize: 13, marginTop: 6, lineHeight: 18 }}>{h.about}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {pic(doc, h.role === 'guide' ? 'Licence card' : 'ID')}
        {pic(selfie, 'Selfie')}
      </View>
      <Text style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>Signed: {h.terms_version || '—'} · The face, name and photo on the card must match.</Text>
      <BardiAdvice kind="host" refId={h.user_id} />
      <View style={{ flexDirection: 'row', marginTop: 10, opacity: busy ? 0.5 : 1 }}>
        <Pressable onPress={() => decide(false)} disabled={busy} style={{ marginRight: 8 }}>
          <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800' }}>Reject</Text></View>
        </Pressable>
        <Pressable onPress={() => decide(true)} disabled={busy}>
          <View style={{ borderRadius: 999, backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>Approve ✓</Text></View>
        </Pressable>
      </View>
    </View>
  );
};

export const AdminPanel = ({ onClose, access = { owner: true } }) => {
  const tabs = TABS.filter((t) => canOpen(access, t));
  const { lang } = useLang();
  const owner = !!access.owner;
  /* the phone's own back gesture closes this — see src/lib/sheetBack.js */
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState(() => (tabs[0] ? tabs[0].k : 'safety'));
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null);
  const [verifs, setVerifs] = useState(null);
  const [venues, setVenues] = useState(null);
  const [venueErr, setVenueErr] = useState(null);
  const [hosts, setHosts] = useState(null);
  const [safety, setSafety] = useState(null);
  const [safetyErr, setSafetyErr] = useState(null);
  const [hostErr, setHostErr] = useState(null);
  const [crashes, setCrashes] = useState(() => { try { return recent(); } catch (e) { return []; } });
  const [music, setMusic] = useState(null);
  const [importing, setImporting] = useState(null);
  const [imported, setImported] = useState(0);
  const [importErr, setImportErr] = useState(null);
  const [wipeArmed, setWipeArmed] = useState(false);
  const [wipeCount, setWipeCount] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [help, setHelp] = useState(null);
  const [helpEdit, setHelpEdit] = useState(null); // 'new' | article row | null
  const [helpForm, setHelpForm] = useState({ category: '', title: '', body: '' });
  const [helpErr, setHelpErr] = useState(null);
  const [bardiMsg, setBardiMsg] = useState(null);
  const [bardiBusy, setBardiBusy] = useState(false);

  // Bardi Brain portal
  const [bInstr, setBInstr] = useState(null); // owner instructions (null = loading)
  const [bSaved, setBSaved] = useState(false);
  const [bKnow, setBKnow] = useState(null);   // knowledge entries
  const [bTitle, setBTitle] = useState('');
  const [bContent, setBContent] = useState('');
  const [bUrl, setBUrl] = useState('');
  const [bBusy, setBBusy] = useState(false);
  const [bErr, setBErr] = useState(null);
  const [dbRows, setDbRows] = useState(null);

  useEffect(() => { if (owner) fetchStudioStats().then(setStats).catch(() => setStats(null)); }, [owner]);
  useEffect(() => {
    if (tab === 'reports' && reports == null) fetchReports().then(setReports).catch(() => setReports([]));
    if (tab === 'venues' && venues == null) fetchPendingVenues().then(setVenues).catch(() => { setVenues([]); setVenueErr(true); });
    if (tab === 'safety' && safety == null) fetchSafetyQueue().then(setSafety).catch(() => { setSafety({ reports: [], coach: [] }); setSafetyErr(true); });
    if (tab === 'hosts' && hosts == null) fetchPendingHosts().then(setHosts).catch(() => { setHosts([]); setHostErr(true); });
    if (tab === 'verify' && verifs == null) fetchPendingVerifications().then(setVerifs).catch(() => setVerifs([]));
    if (tab === 'music' && music == null) fetchTracks({ all: true, meId: user && user.id }).then((rows) => setMusic((rows || []).filter((t) => !t.is_approved && !t.is_official))).catch(() => setMusic([]));
    if (tab === 'feedback' && feedback == null) fetchFeedback().then(setFeedback).catch(() => setFeedback([]));
    if (tab === 'help' && help == null) fetchHelpArticles().then(setHelp).catch(() => setHelp([]));
    if (tab === 'db' && dbRows == null) checkDatabase().then(setDbRows).catch(() => setDbRows([]));
    if (tab === 'bardi') {
      if (bInstr == null) fetchBardiConfig().then(setBInstr).catch(() => setBInstr(''));
      if (bKnow == null) fetchBardiKnowledge().then(setBKnow).catch(() => setBKnow([]));
    }
  }, [tab]);

  const saveInstr = async () => {
    setBErr(null);
    try { await saveBardiConfig(bInstr || ''); invalidateBardiBrain(); tapSuccess(); setBSaved(true); setTimeout(() => setBSaved(false), 1400); }
    catch (e) { setBErr(/does not exist|schema/i.test(e.message || '') ? 'Run RUN_ME.sql once to turn on the Bardi portal.' : (e.message || 'Could not save.')); }
  };
  // fetch a web page's readable text in the owner's own browser (the
  // sandbox can't, but the owner's browser can) so Bardi can learn from it.
  const fetchUrlText = async () => {
    const url = bUrl.trim();
    if (!url) return;
    setBBusy(true); setBErr(null);
    try {
      const r = await fetch(url);
      const html = await r.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);
      if (text) { setBContent(text); if (!bTitle.trim()) setBTitle(url.replace(/^https?:\/\//, '').slice(0, 60)); }
      else setBErr('Could not read text from that link — paste the content instead.');
    } catch (e) {
      setBErr('Could not fetch that link from your browser (CORS) — open it, copy the text, and paste it here.');
    } finally { setBBusy(false); }
  };
  const addKnowledge = async () => {
    if (!bContent.trim()) { setBErr('Add some content (or fetch a link).'); return; }
    setBBusy(true); setBErr(null);
    try {
      const row = await addBardiKnowledge({ title: bTitle.trim() || 'Untitled', content: bContent.trim(), sourceUrl: bUrl.trim() || null });
      setBKnow((l) => [row, ...(l || [])]);
      invalidateBardiBrain();
      setBTitle(''); setBContent(''); setBUrl(''); tapSuccess();
    } catch (e) {
      setBErr(/does not exist|schema/i.test(e.message || '') ? 'Run RUN_ME.sql once to turn on the Bardi portal.' : (e.message || 'Could not add.'));
    } finally { setBBusy(false); }
  };
  const removeKnowledge = async (id) => {
    try { await deleteBardiKnowledge(id); setBKnow((l) => l.filter((k) => k.id !== id)); invalidateBardiBrain(); tapSuccess(); } catch (e) {}
  };

  const openHelpEditor = (row) => {
    tapLight();
    setHelpErr(null);
    setHelpEdit(row || 'new');
    setHelpForm(row ? { category: row.category, title: row.title, body: row.body } : { category: 'General', title: '', body: '' });
  };
  const saveHelpArticle = async () => {
    if (!helpForm.title.trim() || !helpForm.body.trim()) { setHelpErr('Title and body are both required.'); return; }
    try {
      if (helpEdit === 'new') {
        const row = await createHelpArticle({ category: helpForm.category.trim() || 'General', title: helpForm.title.trim(), body: helpForm.body.trim() });
        setHelp((l) => [...(l || []), row]);
      } else {
        await updateHelpArticle(helpEdit.id, { category: helpForm.category.trim() || 'General', title: helpForm.title.trim(), body: helpForm.body.trim() });
        setHelp((l) => l.map((a) => (a.id === helpEdit.id ? { ...a, category: helpForm.category.trim() || 'General', title: helpForm.title.trim(), body: helpForm.body.trim() } : a)));
      }
      tapSuccess();
      setHelpEdit(null);
    } catch (e) {
      setHelpErr(/does not exist|schema/i.test(e.message || '') ? 'Run RUN_ME.sql once to turn on Help & Support.' : (e.message || 'Could not save.'));
    }
  };
  const removeHelpArticle = async (id) => {
    try { await deleteHelpArticle(id); setHelp((l) => l.filter((a) => a.id !== id)); tapSuccess(); } catch (e) {}
  };

  /* "What needs my attention": first what is really waiting, counted
     (works with no AI at all), then Bardi's three actions from the same
     numbers — supabase/functions/studio-advice, kind 'overview'. */
  const askBardiSummary = async () => {
    if (bardiBusy) return;
    setBardiBusy(true); setBardiMsg(null);
    const r = await askAdvice('overview', 'today', { lang: lang === 'ar' ? 'ar' : 'en' });
    if (r && r.ok && r.counts) { setBardiMsg(r); setBardiBusy(false); return; }
    /* the function is not there yet: count it here, the same queues */
    const [sq, hp, vp] = await Promise.all([
      fetchSafetyQueue().catch(() => null), fetchPendingHosts().catch(() => null), fetchPendingVenues().catch(() => null),
    ]);
    setBardiMsg({
      counts: {
        safetyOpen: sq ? sq.reports.length : 0,
        threats: sq ? sq.reports.filter((x) => ['threat', 'violence', 'sexual'].includes(x.ai_verdict)).length : 0,
        coachWaiting: sq ? sq.coach.length : 0, hostsPending: hp ? hp.length : 0, venuesPending: vp ? vp.length : 0,
        reportsOpen: (stats && stats.openReports) || 0, feedbackNew: (stats && stats.newFeedback) || 0,
      },
      actions: [], error: 'no_function',
    });
    setBardiBusy(false);
  };

  const Stat = useStable(({ n, l, tint }) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: tint || C.text, fontSize: 19, fontWeight: '900' }}>{n == null ? '—' : n}</Text>
      <Text style={{ color: C.faint, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>{l}</Text>
    </View>
  ));
  const Empty = useStable(({ t }) => <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 40 }}>{t}</Text>);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}><Ionicons name="chevron-down" size={26} color={C.text} /></Pressable>
          <Text style={{ flex: 1, textAlign: 'center', color: C.text, fontSize: 16, fontWeight: '900' }}>{owner ? 'Moments Studio' : 'Moments Studio · ' + (access.username || 'team')}</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* live stats — the owner's */}
        {owner ? <View style={{ marginHorizontal: 16, backgroundColor: C.bg2, borderRadius: 16, borderWidth: 1, borderColor: C.line, flexDirection: 'row', paddingVertical: 14 }}>
          <Stat n={stats && stats.users} l="USERS" />
          <Stat n={stats && stats.posts} l="POSTS" />
          <Stat n={stats && stats.tracks} l="TRACKS" />
          <Stat n={stats && stats.openReports} l="REPORTS" tint={stats && stats.openReports ? C.coral : C.text} />
          <Stat n={stats && stats.newFeedback} l="FEEDBACK" tint={stats && stats.newFeedback ? C.purple : C.text} />
        </View> : null}

        {/* Bardi assist */}
        {owner ? <Pressable onPress={askBardiSummary} style={{ marginHorizontal: 16, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purpleSoft, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11 }}>
            <Image source={require('../assets/brand/bardi.png')} style={{ width: 26, height: 26, borderRadius: 8, marginRight: 9 }} />
            <Text style={{ flex: 1, color: C.purple, fontSize: 12.5, fontWeight: '800' }}>{bardiBusy ? 'Bardi is thinking…' : 'Ask Bardi what needs my attention'}</Text>
            {bardiBusy ? <ActivityIndicator size="small" color={C.purple} /> : <Ionicons name="sparkles" size={16} color={C.purple} />}
          </View>
        </Pressable> : null}
        {bardiMsg ? <Attention a={bardiMsg} tabs={tabs} onTab={(k) => { setTab(k); setBardiMsg(null); }} onClose={() => setBardiMsg(null)} /> : null}

        {/* tabs */}
        {/* ten tabs do not fit a phone's width: they scroll sideways */}
        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 12, marginBottom: 4 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {tabs.map((t) => {
            const on = tab === t.k;
            return (
              <Pressable key={t.k} onPress={() => { tapLight(); setTab(t.k); }} style={{ minWidth: 58, paddingHorizontal: 8, alignItems: 'center', paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: on ? C.purple : 'transparent' }}>
                <Ionicons name={t.icon} size={18} color={on ? C.purple : C.faint} />
                <Text style={{ color: on ? C.purple : C.faint, fontSize: 11, fontWeight: '800', marginTop: 2 }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, paddingBottom: insets.bottom + 30 }}>
          {tab === 'reports' ? (
            reports == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> :
            reports.length === 0 ? <Empty t="No reports 🎉" /> :
            reports.map((r) => (
              <View key={r.id} style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: C.coral, fontSize: 13, fontWeight: '900', flex: 1 }}>{r.reason} · {r.content_type}</Text>
                  <Text style={{ color: C.faint, fontSize: 10.5 }}>{r.status}</Text>
                </View>
                {r.detail ? <Text style={{ color: C.text, fontSize: 12.5, marginTop: 4 }}>{r.detail}</Text> : null}
                {/* a reported plan photo: the picture itself, so the decision is made looking at it */}
                {r.content_type === 'plan_photo' && /^https:\/\//.test(r.content_id.split(' ')[1] || '') ? (
                  <Image source={{ uri: r.content_id.split(' ')[1] }} style={{ width: 120, height: 120, borderRadius: 12, marginTop: 8, backgroundColor: C.glassHi }} />
                ) : null}
                <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 4 }}>by {(r.reporter && r.reporter.name) || 'someone'} · {r.content_id.slice(0, 10)}…</Text>
                {r.status === 'open' ? <BardiAdvice kind="report" refId={r.id} /> : null}
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Pressable onPress={async () => { await setReportStatus(r.id, 'reviewed'); setReports((l) => l.map((x) => x.id === r.id ? { ...x, status: 'reviewed' } : x)); tapSuccess(); }} style={{ marginRight: 8 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: C.dim, fontSize: 12, fontWeight: '800' }}>Mark reviewed</Text></View>
                  </Pressable>
                  <Pressable onPress={async () => {
                    /* a plan photo really comes down: off the plan, or the post it came from */
                    if (r.content_type === 'plan_photo') { const [gid, url] = r.content_id.split(' '); await removeGatheringPhoto(gid, url || null); }
                    await setReportStatus(r.id, 'removed'); setReports((l) => l.map((x) => x.id === r.id ? { ...x, status: 'removed' } : x)); tapSuccess();
                  }}>
                    <View style={{ borderRadius: 999, backgroundColor: C.coral, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Take down</Text></View>
                  </Pressable>
                </View>
              </View>
            ))
          ) : null}

          {/* ── WHAT THE DATABASE STILL NEEDS ──────────────────────
              Every one of these degrades honestly on its own, but read
              weeks apart there is no way to see that they share one
              cause and one fix. Owner's panel only — what a database is
              missing is nobody else's reading. */}
          {tab === 'db' ? (
            dbRows == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> : (
              <View>
                {(() => {
                  /* "Could not tell" is not "all fine". Counting only the
                     missing ones made a screen where nothing answered
                     announce that everything was switched on — the exact
                     false reassurance this tab exists to stop. */
                  const asleep = dbRows.filter((r) => r.state === 'missing').length;
                  const unsure = dbRows.filter((r) => r.state === 'unknown').length;
                  const tone = asleep ? 'warn' : unsure ? 'unsure' : 'good';
                  const bg = tone === 'good' ? C.greenSoft : tone === 'warn' ? 'rgba(245,179,1,0.12)' : C.glassHi;
                  const line = tone === 'good' ? 'rgba(16,185,129,0.35)' : tone === 'warn' ? 'rgba(245,179,1,0.4)' : C.line;
                  return (
                    <View style={{ backgroundColor: bg, borderWidth: 1, borderColor: line, borderRadius: 14, padding: 13, marginBottom: 14 }}>
                      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900' }}>
                        {tone === 'warn'
                          ? asleep + (asleep === 1 ? ' feature is asleep' : ' features are asleep')
                          : tone === 'unsure'
                            ? "Couldn't reach the database"
                            : 'Everything is switched on ✅'}
                      </Text>
                      <Text style={{ color: C.dim, fontSize: 12, marginTop: 5, lineHeight: 18 }}>
                        {tone === 'warn'
                          ? 'Open the Supabase SQL editor and run supabase/RUN_ME.sql. It is safe to run again — every statement checks before it changes anything.'
                          : tone === 'unsure'
                            ? 'Nothing here is a verdict until it answers. Check the connection and try again.'
                            : 'Every table and column the app expects is there.'}
                      </Text>
                    </View>
                  );
                })()}
                {dbRows.map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                    <Ionicons
                      name={r.state === 'ready' ? 'checkmark-circle' : r.state === 'missing' ? 'alert-circle' : 'help-circle'}
                      size={18}
                      color={r.state === 'ready' ? C.green : r.state === 'missing' ? C.gold : C.faint}
                      style={{ marginTop: 1 }}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>{r.label}</Text>
                      <Text style={{ color: C.dim, fontSize: 11.5, marginTop: 3, lineHeight: 17 }}>
                        {r.state === 'ready' ? 'Working.'
                          : r.state === 'missing' ? r.what
                          : 'Could not tell — ' + (r.detail || 'no answer from the server') + '.'}
                      </Text>
                    </View>
                  </View>
                ))}
                <Pressable onPress={() => { tapLight(); setDbRows(null); checkDatabase().then(setDbRows).catch(() => setDbRows([])); }} style={{ alignSelf: 'center', marginTop: 6 }}>
                  <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900' }}>Check again</Text>
                </Pressable>
              </View>
            )
          ) : null}

          {/* organisations asking to host: approved here, and only here */}
          {tab === 'venues' ? (
            venues == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> :
            venueErr ? <Empty t="Run the latest SQL (part 14) to see venue applications here." /> :
            venues.length === 0 ? <Empty t="No organisations waiting" /> :
            venues.map((v) => (
              <View key={v.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{(v.emoji || '🏢') + ' ' + v.name}</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
                  {[v.kind, v.sub, v.owner && v.owner.name, v.owner && v.owner.email].filter(Boolean).join(' · ')}
                </Text>
                {v.lat != null ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{Number(v.lat).toFixed(4) + ', ' + Number(v.lng).toFixed(4)}</Text> : null}
                <BardiAdvice kind="venue" refId={v.id} />
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Pressable onPress={async () => { tapLight(); await decideVenue(v.id, false).catch(() => {}); setVenues((q) => q.filter((x) => x.id !== v.id)); }} style={{ marginRight: 8 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800' }}>Reject</Text></View>
                  </Pressable>
                  <Pressable onPress={async () => { await decideVenue(v.id, true).catch(() => {}); tapSuccess(); setVenues((q) => q.filter((x) => x.id !== v.id)); }}>
                    <View style={{ borderRadius: 999, backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>Approve ✓</Text></View>
                  </Pressable>
                </View>
              </View>
            ))
          ) : null}

          {tab === 'team' && owner ? <TeamTab /> : null}

          {/* reported chats, worst first, and who is waiting for a session */}
          {tab === 'safety' ? (
            safety == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> :
            safetyErr ? <Empty t="Run the latest SQL (part 21) to see reported chats here." /> : (
              <>
                {safety.coach.length ? (
                  <>
                    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 6 }}>WAITING FOR A LIFE-COACH SESSION</Text>
                    {safety.coach.map((c) => (
                      <View key={c.user_id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                        <Image source={{ uri: c.avatar || AV_NEUTRAL }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{c.name || 'Someone'}</Text>
                          <Text style={{ color: C.faint, fontSize: 11.5 }}>{c.asked_at ? 'Asked for a session ' + String(c.asked_at).slice(0, 10) : 'Has not asked yet'}</Text>
                        </View>
                        <Pressable onPress={async () => { await coachDone(c.user_id).catch(() => {}); tapSuccess(); setSafety((q) => ({ ...q, coach: q.coach.filter((x) => x.user_id !== c.user_id) })); }}>
                          <View style={{ borderRadius: 999, backgroundColor: C.green, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Session done ✓</Text></View>
                        </Pressable>
                      </View>
                    ))}
                  </>
                ) : null}
                {safety.reports.length ? safety.reports.map((r) => (
                  <SafetyReport key={r.id} r={r} onDone={(id) => { setSafety((q) => ({ ...q, reports: q.reports.filter((x) => x.id !== id) })); fetchSafetyQueue().then(setSafety).catch(() => {}); }} />
                )) : <Empty t="No reported chats" />}
              </>
            )
          ) : null}

          {/* licensed guides and activity hosts */}
          {tab === 'hosts' ? (
            hosts == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> :
            hostErr ? <Empty t="Run the latest SQL (part 20) to see guide applications here." /> :
            hosts.length === 0 ? <Empty t="No guides or hosts waiting" /> :
            hosts.map((h) => <HostReview key={h.user_id} h={h} onDone={(id) => setHosts((q) => q.filter((x) => x.user_id !== id))} />)
          ) : null}

          {/* what failed on THIS phone — kept on the device (src/lib/crashLog.js) */}
          {tab === 'errors' ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
                <Pressable onPress={() => { try { if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(asText()); } catch (e) {} tapSuccess(); }} hitSlop={8} style={{ marginRight: 16 }}>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>Copy all</Text>
                </Pressable>
                <Pressable onPress={() => { clearCrashes(); setCrashes([]); tapLight(); }} hitSlop={8}>
                  <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>Clear</Text>
                </Pressable>
              </View>
              {crashes.length ? crashes.map((c, n) => (
                <View key={n} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 9 }}>
                  <Text style={{ color: C.faint, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>{String(c.where).toUpperCase()} · {String(c.at).replace('T', ' ').slice(5, 16)}</Text>
                  <Text selectable style={{ color: C.text, fontSize: 12, fontWeight: '700', marginTop: 5 }}>{c.msg}</Text>
                  {c.stack ? <Text selectable style={{ color: C.faint, fontSize: 9.5, marginTop: 5, lineHeight: 13 }}>{c.stack}</Text> : null}
                  {c.extra ? <Text selectable style={{ color: C.dim, fontSize: 9.5, marginTop: 5, lineHeight: 13 }}>{c.extra}</Text> : null}
                </View>
              )) : <Empty t="Nothing has failed on this phone since it was last cleared." />}
            </>
          ) : null}

          {tab === 'verify' ? (
            verifs == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> :
            verifs.length === 0 ? <Empty t="No pending verifications" /> :
            verifs.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Image source={{ uri: (r.user && r.user.avatar_url) || AV_NEUTRAL }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{(r.user && r.user.name) || 'Someone'}</Text>
                  <Text style={{ color: C.faint, fontSize: 11.5 }}>{r.kind}{r.user && r.user.artist_genre ? ' · ' + r.user.artist_genre : ''}</Text>
                </View>
                <Pressable onPress={async () => { await decideVerification(r.user_id, false); setVerifs((q) => q.filter((x) => x.id !== r.id)); }} style={{ marginRight: 8 }}>
                  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: C.dim, fontSize: 12, fontWeight: '800' }}>Reject</Text></View>
                </Pressable>
                <Pressable onPress={async () => { await decideVerification(r.user_id, true); tapSuccess(); setVerifs((q) => q.filter((x) => x.id !== r.id)); }}>
                  <View style={{ borderRadius: 999, backgroundColor: C.green, paddingHorizontal: 13, paddingVertical: 7 }}><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Approve ✓</Text></View>
                </Pressable>
              </View>
            ))
          ) : null}

          {tab === 'music' ? (
            <>
              {/* The catalogue tools live here, not in the listener's
                  Music screen. Importing pulls only CC0, Creative
                  Commons, or recordings old enough to be out of
                  copyright — the year filter on the classics import is
                  what keeps that promise honest. */}
              <View style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 14 }}>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900' }}>Grow the library</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 17, marginTop: 3 }}>
                  Everything imported is free to use. Credit is stored either way.
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Pressable
                    disabled={!!importing}
                    onPress={async () => {
                      setImporting('cc'); setImported(0);
                      try { const n = await harvestFreeMusic(user && user.id, setImported); setImported(n); }
                      catch (e) { setImportErr(e && e.message); }
                      finally { setImporting(null); }
                    }}
                    style={{ flex: 1, marginRight: 8, backgroundColor: C.purple, borderRadius: 999, paddingVertical: 10, alignItems: 'center', opacity: importing ? 0.5 : 1 }}
                  >
                    <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>
                      {importing === 'cc' ? 'Importing…' : 'Creative Commons'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={!!importing}
                    onPress={async () => {
                      setImporting('pd'); setImported(0);
                      try { const n = await harvestPublicDomainClassics(user && user.id, setImported); setImported(n); }
                      catch (e) { setImportErr(e && e.message); }
                      finally { setImporting(null); }
                    }}
                    style={{ flex: 1, backgroundColor: C.glassHi, borderRadius: 999, paddingVertical: 10, alignItems: 'center', opacity: importing ? 0.5 : 1 }}
                  >
                    <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '900' }}>
                      {importing === 'pd' ? 'Importing…' : '📻 Pre-1929 classics'}
                    </Text>
                  </Pressable>
                </View>
                {importing || imported ? (
                  <Text style={{ color: C.dim, fontSize: 11.5, marginTop: 8 }}>{imported} added so far</Text>
                ) : null}
                {importErr ? (
                  <Text style={{ color: C.coral, fontSize: 11.5, marginTop: 6 }}>{importErr}</Text>
                ) : null}

                {/* Undoing an import has to be as easy as making one.
                    Two taps, and the first one says the number out loud
                    so nothing large happens by accident. */}
                <Pressable
                  onPress={async () => {
                    if (!wipeArmed) {
                      const n = await countImportedTracks(user && user.id).catch(() => 0);
                      setWipeCount(n); setWipeArmed(true);
                      setTimeout(() => setWipeArmed(false), 6000);
                      return;
                    }
                    setWipeArmed(false);
                    try {
                      const n = await clearImportedTracks(user && user.id);
                      setImported(0); setImportErr(null);
                      setMusic(null);
                      setWipeCount(-n);
                    } catch (e) { setImportErr(e && e.message); }
                  }}
                  style={{ marginTop: 10, borderWidth: 1, borderColor: wipeArmed ? C.coral : C.line, borderRadius: 999, paddingVertical: 9, alignItems: 'center' }}
                >
                  <Text style={{ color: wipeArmed ? C.coral : C.dim, fontSize: 12, fontWeight: '900' }}>
                    {wipeArmed
                      ? 'Tap again to remove ' + wipeCount + ' imported tracks'
                      : wipeCount < 0 ? 'Removed ' + (-wipeCount) : 'Remove everything I imported'}
                  </Text>
                </Pressable>
              </View>
            {music == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> :
            music.length === 0 ? <Empty t="No tracks waiting for approval" /> :
            music.map((t) => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ fontSize: 22, marginRight: 10 }}>{t.cover_emoji || '🎵'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{t.title}</Text>
                  <Text style={{ color: C.faint, fontSize: 11 }} numberOfLines={1}>{t.artist || 'unknown'}{t.license ? ' · ' + t.license : ''}</Text>
                </View>
                <Pressable onPress={async () => { await setTrackApproval(t.id, false).catch(() => {}); setMusic((l) => l.filter((x) => x.id !== t.id)); }} style={{ marginRight: 8 }}>
                  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: C.dim, fontSize: 12, fontWeight: '800' }}>Reject</Text></View>
                </Pressable>
                <Pressable onPress={async () => { await setTrackApproval(t.id, true); tapSuccess(); setMusic((l) => l.filter((x) => x.id !== t.id)); }}>
                  <View style={{ borderRadius: 999, backgroundColor: C.green, paddingHorizontal: 13, paddingVertical: 7 }}><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Approve</Text></View>
                </Pressable>
              </View>
            ))}
            </>
          ) : null}

          {tab === 'feedback' ? (
            feedback == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> :
            feedback.length === 0 ? <Empty t="No feedback yet" /> :
            feedback.map((f) => (
              <View key={f.id} style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '900', flex: 1 }}>{f.kind}{f.user && f.user.name ? ' · ' + f.user.name : ''}</Text>
                  {f.status === 'new' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.purple }} /> : null}
                </View>
                <Text style={{ color: C.text, fontSize: 13, lineHeight: 19 }}>{f.body}</Text>
              </View>
            ))
          ) : null}

          {tab === 'help' ? (
            help == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> : (
              <>
                <Pressable onPress={() => openHelpEditor(null)} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft, borderRadius: 12, paddingVertical: 12 }}>
                    <Ionicons name="add-circle-outline" size={17} color={C.purple} />
                    <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginLeft: 6 }}>Add article</Text>
                  </View>
                </Pressable>
                {help.length === 0 ? <Empty t="No help articles yet — add the first one" /> : help.map((a) => (
                  <View key={a.id} style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 10 }}>
                    <Text style={{ color: C.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{a.category.toUpperCase()}</Text>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 3 }}>{a.title}</Text>
                    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 4, lineHeight: 18 }} numberOfLines={3}>{a.body}</Text>
                    <View style={{ flexDirection: 'row', marginTop: 9 }}>
                      <Pressable onPress={() => openHelpEditor(a)} style={{ marginRight: 8 }}>
                        <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: C.dim, fontSize: 12, fontWeight: '800' }}>Edit</Text></View>
                      </Pressable>
                      <Pressable onPress={() => removeHelpArticle(a.id)}>
                        <View style={{ borderRadius: 999, backgroundColor: C.coralSoft, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: C.coral, fontSize: 12, fontWeight: '800' }}>Delete</Text></View>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            )
          ) : null}

          {tab === 'bardi' ? (
            <>
              <Text style={{ color: C.dim, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
                This is your Bardi control room. Steer Bardi's persona and teach it from books/content — it applies to every user's Bardi instantly, no code changes.
              </Text>

              {/* Bardi's steering instructions */}
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>BARDI'S INSTRUCTIONS</Text>
              {bInstr == null ? <ActivityIndicator color={C.purple} style={{ marginVertical: 20 }} /> : (
                <>
                  <TextInput
                    placeholder="How Bardi should behave, extra rules, tone, things it should always know…"
                    placeholderTextColor={C.faint} multiline value={bInstr} onChangeText={setBInstr}
                    style={{ color: C.text, fontSize: 13.5, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 }}
                  />
                  <Pressable onPress={saveInstr}>
                    <View style={{ backgroundColor: C.purple, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 18 }}>
                      <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>{bSaved ? 'Saved ✓' : 'Save instructions'}</Text>
                    </View>
                  </Pressable>
                </>
              )}

              {/* Knowledge / books */}
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>📚 BOOKS & KNOWLEDGE BARDI LEARNS FROM</Text>
              <View style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 14 }}>
                <TextInput
                  placeholder="Title (e.g. My coaching method, Chapter 1…)" placeholderTextColor={C.faint}
                  value={bTitle} onChangeText={setBTitle}
                  style={{ color: C.text, fontSize: 13.5, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}
                />
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <TextInput
                    placeholder="Paste a link to import its text…" placeholderTextColor={C.faint}
                    value={bUrl} onChangeText={setBUrl} autoCapitalize="none"
                    style={{ flex: 1, color: C.text, fontSize: 12.5, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 }}
                  />
                  <Pressable onPress={fetchUrlText} disabled={bBusy || !bUrl.trim()}>
                    <View style={{ backgroundColor: bUrl.trim() ? C.blue : C.glassHi, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', height: '100%' }}>
                      <Text style={{ color: bUrl.trim() ? '#FFF' : C.faint, fontSize: 12, fontWeight: '900' }}>{bBusy ? '…' : 'Fetch'}</Text>
                    </View>
                  </Pressable>
                </View>
                <TextInput
                  placeholder="…or paste the content (a chapter, notes, an article) Bardi should learn from"
                  placeholderTextColor={C.faint} multiline value={bContent} onChangeText={setBContent}
                  style={{ color: C.text, fontSize: 13, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 90, textAlignVertical: 'top', marginBottom: 8 }}
                />
                {bErr ? <Text style={{ color: C.coral, fontSize: 11.5, marginBottom: 8 }}>{bErr}</Text> : null}
                <Pressable onPress={addKnowledge} disabled={bBusy}>
                  <View style={{ backgroundColor: C.green, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{bBusy ? 'Adding…' : '+ Teach Bardi this'}</Text>
                  </View>
                </Pressable>
              </View>

              {bKnow == null ? <ActivityIndicator color={C.purple} /> :
                bKnow.length === 0 ? <Empty t="No knowledge added yet — teach Bardi something above" /> :
                bKnow.map((k) => (
                  <View key={k.id} style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', flex: 1 }} numberOfLines={1}>📖 {k.title}</Text>
                      <Pressable onPress={() => removeKnowledge(k.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={17} color={C.coral} />
                      </Pressable>
                    </View>
                    <Text style={{ color: C.dim, fontSize: 12, marginTop: 4, lineHeight: 17 }} numberOfLines={3}>{k.content}</Text>
                  </View>
                ))}
            </>
          ) : null}
        </ScrollView>

        {/* inline help-article editor */}
        {helpEdit ? (
          <Pressable onPress={() => setHelpEdit(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: insets.bottom + 20 }}>
        <SheetHandle onClose={onClose} />
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginBottom: 10 }}>{helpEdit === 'new' ? 'Add article' : 'Edit article'}</Text>
              <TextInput
                placeholder="Category (e.g. Account, Privacy & safety)" placeholderTextColor={C.faint}
                value={helpForm.category} onChangeText={(t) => setHelpForm((f) => ({ ...f, category: t }))}
                style={{ color: C.text, fontSize: 13.5, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 9 }}
              />
              <TextInput
                placeholder="Title" placeholderTextColor={C.faint}
                value={helpForm.title} onChangeText={(t) => setHelpForm((f) => ({ ...f, title: t }))}
                style={{ color: C.text, fontSize: 13.5, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 9 }}
              />
              <TextInput
                placeholder="Answer" placeholderTextColor={C.faint} multiline
                value={helpForm.body} onChangeText={(t) => setHelpForm((f) => ({ ...f, body: t }))}
                style={{ color: C.text, fontSize: 13.5, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, minHeight: 110, textAlignVertical: 'top', marginBottom: 9 }}
              />
              {helpErr ? <Text style={{ color: C.coral, fontSize: 11.5, marginBottom: 9 }}>{helpErr}</Text> : null}
              <Pressable onPress={saveHelpArticle}>
                <View style={{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>Save</Text>
                </View>
              </Pressable>
            </Pressable>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
};
