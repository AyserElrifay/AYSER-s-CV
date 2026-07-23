import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { fetchReports, setReportStatus } from '../services/reports';
import { fetchFeedback, markFeedbackSeen } from '../services/feedback';
import { fetchStudioStats } from '../services/feedback';
import { fetchPendingVerifications, decideVerification } from '../services/profiles';
import { fetchTracks, setTrackApproval } from '../services/music';
import { fetchHelpArticles, createHelpArticle, updateHelpArticle, deleteHelpArticle } from '../services/help';
import { fetchBardiConfig, saveBardiConfig, fetchBardiKnowledge, addBardiKnowledge, deleteBardiKnowledge, invalidateBardiBrain } from '../services/bardiOwner';
import { askBardi } from '../services/bardi';
import { AV_NEUTRAL } from '../constants/mockData';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── MOMENTS STUDIO · the owner's control panel ──────────────────────
   One place to run everything: live stats, the report queue, verification
   requests, music approvals and user feedback — all real data, owner-only.
   Bardi is built in: one tap summarises what needs attention. */

const TABS = [
  { k: 'reports', label: 'Reports', icon: 'flag-outline' },
  { k: 'verify', label: 'Verify', icon: 'shield-checkmark-outline' },
  { k: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { k: 'feedback', label: 'Feedback', icon: 'chatbubbles-outline' },
  { k: 'help', label: 'Help', icon: 'help-circle-outline' },
  { k: 'bardi', label: 'Bardi', icon: 'sparkles-outline' },
];

export const AdminPanel = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState('reports');
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null);
  const [verifs, setVerifs] = useState(null);
  const [music, setMusic] = useState(null);
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

  useEffect(() => { fetchStudioStats().then(setStats).catch(() => setStats(null)); }, []);
  useEffect(() => {
    if (tab === 'reports' && reports == null) fetchReports().then(setReports).catch(() => setReports([]));
    if (tab === 'verify' && verifs == null) fetchPendingVerifications().then(setVerifs).catch(() => setVerifs([]));
    if (tab === 'music' && music == null) fetchTracks({ all: true, meId: user && user.id }).then((rows) => setMusic((rows || []).filter((t) => !t.is_approved && !t.is_official))).catch(() => setMusic([]));
    if (tab === 'feedback' && feedback == null) fetchFeedback().then(setFeedback).catch(() => setFeedback([]));
    if (tab === 'help' && help == null) fetchHelpArticles().then(setHelp).catch(() => setHelp([]));
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

  const askBardiSummary = async () => {
    if (bardiBusy) return;
    setBardiBusy(true); setBardiMsg(null);
    try {
      const s = stats || {};
      const rTop = (reports || []).slice(0, 5).map((r) => r.reason + (r.detail ? ': ' + r.detail : '')).join('; ');
      const fTop = (feedback || []).slice(0, 5).map((f) => f.kind + ': ' + f.body).join('; ');
      const prompt = `You are helping me run Moments (a social app). Here's the live state — give me 3 short, prioritised actions.\n`
        + `Users: ${s.users}, Posts: ${s.posts}, Tracks: ${s.tracks}, Open reports: ${s.openReports}, New feedback: ${s.newFeedback}.\n`
        + (rTop ? `Recent reports: ${rTop}.\n` : '')
        + (fTop ? `Recent feedback: ${fTop}.\n` : '');
      const reply = await askBardi([{ role: 'user', content: prompt }], { language: 'ar', profile: { name: 'Ayser' } });
      setBardiMsg(reply);
    } catch (e) { setBardiMsg('باردي مش متاح دلوقتي — جرّب تاني.'); }
    finally { setBardiBusy(false); }
  };

  const Stat = ({ n, l, tint }) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: tint || C.text, fontSize: 19, fontWeight: '900' }}>{n == null ? '—' : n}</Text>
      <Text style={{ color: C.faint, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>{l}</Text>
    </View>
  );
  const Empty = ({ t }) => <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 40 }}>{t}</Text>;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10}><Ionicons name="chevron-down" size={26} color={C.text} /></Pressable>
          <Text style={{ flex: 1, textAlign: 'center', color: C.text, fontSize: 16, fontWeight: '900' }}>Moments Studio</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* live stats */}
        <View style={{ marginHorizontal: 16, backgroundColor: C.bg2, borderRadius: 16, borderWidth: 1, borderColor: C.line, flexDirection: 'row', paddingVertical: 14 }}>
          <Stat n={stats && stats.users} l="USERS" />
          <Stat n={stats && stats.posts} l="POSTS" />
          <Stat n={stats && stats.tracks} l="TRACKS" />
          <Stat n={stats && stats.openReports} l="REPORTS" tint={stats && stats.openReports ? C.coral : C.text} />
          <Stat n={stats && stats.newFeedback} l="FEEDBACK" tint={stats && stats.newFeedback ? C.purple : C.text} />
        </View>

        {/* Bardi assist */}
        <Pressable onPress={askBardiSummary} style={{ marginHorizontal: 16, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purpleSoft, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11 }}>
            <Image source={require('../assets/brand/bardi.png')} style={{ width: 26, height: 26, borderRadius: 8, marginRight: 9 }} />
            <Text style={{ flex: 1, color: C.purple, fontSize: 12.5, fontWeight: '800' }}>{bardiBusy ? 'Bardi is thinking…' : 'Ask Bardi what needs my attention'}</Text>
            {bardiBusy ? <ActivityIndicator size="small" color={C.purple} /> : <Ionicons name="sparkles" size={16} color={C.purple} />}
          </View>
        </Pressable>
        {bardiMsg ? (
          <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
            <Text style={{ color: C.text, fontSize: 13, lineHeight: 20 }}>{bardiMsg}</Text>
          </View>
        ) : null}

        {/* tabs */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4 }}>
          {TABS.map((t) => {
            const on = tab === t.k;
            return (
              <Pressable key={t.k} onPress={() => { tapLight(); setTab(t.k); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: on ? C.purple : 'transparent' }}>
                <Ionicons name={t.icon} size={18} color={on ? C.purple : C.faint} />
                <Text style={{ color: on ? C.purple : C.faint, fontSize: 11, fontWeight: '800', marginTop: 2 }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, paddingBottom: insets.bottom + 30 }}>
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
                <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 4 }}>by {(r.reporter && r.reporter.name) || 'someone'} · {r.content_id.slice(0, 10)}…</Text>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Pressable onPress={async () => { await setReportStatus(r.id, 'reviewed'); setReports((l) => l.map((x) => x.id === r.id ? { ...x, status: 'reviewed' } : x)); tapSuccess(); }} style={{ marginRight: 8 }}>
                    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: C.dim, fontSize: 12, fontWeight: '800' }}>Mark reviewed</Text></View>
                  </Pressable>
                  <Pressable onPress={async () => { await setReportStatus(r.id, 'removed'); setReports((l) => l.map((x) => x.id === r.id ? { ...x, status: 'removed' } : x)); tapSuccess(); }}>
                    <View style={{ borderRadius: 999, backgroundColor: C.coral, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Take down</Text></View>
                  </Pressable>
                </View>
              </View>
            ))
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
            music == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} /> :
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
            ))
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
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
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
