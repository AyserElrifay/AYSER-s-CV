import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator } from 'react-native';
import { C } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { tapLight, tapSuccess, tapSelection } from '../utils/feedback';
import { promoSave, promoList, promoOff, promoToCheckout, members, giftMembership, endGift, stopRenewing } from '../services/gifts';
import { setStanding } from '../services/studioPeople';
import { safetyList, safetyPhotoUrl, safetyDecide } from '../services/mvp';
import { studioGlobalList, studioGlobalContacted } from '../services/loop';

/* ─── THE OWNER'S MEMBERS DESK ────────────────────────────────────────
   Ayser: promo codes made here, with the discount she chooses, and
   everybody in one list with filters — to make an offer, gift a
   membership, close an account or send money back. Every action is
   checked again by the database (RUN_ME.sql, "THE OWNER'S MEMBERS DESK")
   or by functions/owner-billing. */

const SITE = 'https://therealmoments.com/';
const Chip = ({ label, on, onPress }) => (
  <Pressable onPress={() => { tapSelection(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: !!on }} style={{ marginEnd: 6, marginBottom: 6 }}>
    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? C.text : C.line, backgroundColor: on ? C.text : 'transparent', paddingHorizontal: 12, paddingVertical: 7 }}>
      <Text style={{ color: on ? C.bg : C.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  </Pressable>
);
const Act = ({ label, onPress, strong, busy }) => (
  <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={{ marginEnd: 6, marginTop: 6 }}>
    <View style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: strong ? C.text : 'transparent', borderWidth: 1, borderColor: strong ? C.text : C.line }}>
      {busy ? <ActivityIndicator color={strong ? C.bg : C.text} /> : <Text style={{ color: strong ? C.bg : C.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>}
    </View>
  </Pressable>
);
const Head = ({ children, sub }) => (
  <View style={{ marginTop: 22, marginBottom: 6 }}>
    <Text style={{ color: C.text, fontSize: 17, fontWeight: '800' }}>{children}</Text>
    {sub ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3, lineHeight: 18 }}>{sub}</Text> : null}
  </View>
);
const copy = (s) => { try { navigator.clipboard.writeText(s); } catch (e) {} };

/* ── promo codes ── */
const Promos = () => {
  const [kind, setKind] = useState('days');
  const [tier, setTier] = useState('vip');
  const [days, setDays] = useState(30);
  const [pct, setPct] = useState(20);
  const [uses, setUses] = useState(10);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [list, setList] = useState([]);
  const load = () => promoList().then((r) => setList((r && r.codes) || []));
  useEffect(() => { load(); }, []);
  const make = async () => {
    setBusy(true); setNote(null);
    const r = await promoSave({ kind, tier, days, pct, max_uses: uses || null, code });
    if (!(r && r.ok)) { setBusy(false); setNote(r && r.reason === 'taken' ? 'That code is already used — pick another.' : 'Could not make it (owner only, Studio unlocked).'); return; }
    let extra = '';
    if (kind === 'percent') {
      const b = await promoToCheckout(r.code);
      extra = b && b.ok ? ' It works at the checkout now.'
        : b && b.reason === 'not_configured' ? ' Saved — it starts working at the checkout once the Lemon Squeezy key is set.'
        : ' Saved, but Lemon Squeezy did not take it yet — tap "Send to checkout" on it below.';
    }
    setBusy(false); tapSuccess(); setCode(''); copy(SITE + '?code=' + r.code);
    setNote('Code ' + r.code + ' is ready. The link ' + SITE + '?code=' + r.code + ' is copied.' + extra);
    load();
  };
  return (
    <View>
      <Head sub="Free days come in at once when the code is typed (no card). A % code comes off at the Lemon Squeezy checkout — 100% is a free first month.">Promo codes</Head>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Free days" on={kind === 'days'} onPress={() => setKind('days')} />
        <Chip label="% off at checkout" on={kind === 'percent'} onPress={() => setKind('percent')} />
      </View>
      {kind === 'days' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="Moments Black" on={tier === 'vip'} onPress={() => setTier('vip')} />
            <Chip label="Moments+" on={tier === 'basic'} onPress={() => setTier('basic')} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[7, 30, 90].map((n) => <Chip key={n} label={n === 30 ? '1 month' : n === 90 ? '3 months' : '1 week'} on={days === n} onPress={() => setDays(n)} />)}
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[10, 20, 30, 50, 100].map((n) => <Chip key={n} label={n + '%'} on={pct === n} onPress={() => setPct(n)} />)}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[1, 10, 100, 0].map((n) => <Chip key={n} label={n ? (n === 1 ? 'One person' : 'Up to ' + n) : 'No limit'} on={uses === n} onPress={() => setUses(n)} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <TextInput value={code} onChangeText={(x) => setCode(x.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="Code (empty = made up for you)" placeholderTextColor={C.faint} maxLength={32} autoCapitalize="characters"
          style={{ flex: 1, color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, outlineStyle: 'none' }} />
        <Act label="Make" strong busy={busy} onPress={make} />
      </View>
      {note ? <Text style={{ color: C.text, fontSize: 13, marginTop: 8, lineHeight: 19 }} selectable>{note}</Text> : null}
      {list.map((c) => (
        <View key={c.code} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, opacity: c.active ? 1 : 0.45 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', letterSpacing: 1 }} selectable>{c.code}</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>
              {(c.kind === 'days' ? c.days + ' days of ' + (c.tier === 'vip' ? 'Black' : 'Moments+') : c.pct + '% off at checkout' + (c.in_ls ? '' : ' · not at checkout yet'))
                + ' · used ' + c.uses + (c.max_uses ? '/' + c.max_uses : '') + (c.for_name ? ' · for ' + c.for_name : '')}
            </Text>
          </View>
          {c.active && c.kind === 'percent' && !c.in_ls ? <Act label="Send to checkout" onPress={async () => { const b = await promoToCheckout(c.code); setNote(b && b.ok ? c.code + ' works at the checkout now.' : 'Lemon Squeezy: ' + ((b && b.reason) || 'no answer')); load(); }} /> : null}
          {c.active ? <Act label="Copy link" onPress={() => { tapLight(); copy(SITE + '?code=' + c.code); setNote('Copied ' + SITE + '?code=' + c.code); }} /> : null}
          {c.active ? <Act label="Turn off" onPress={async () => { await promoOff(c.code); load(); }} /> : null}
        </View>
      ))}
    </View>
  );
};

/* ── everybody, filtered ── */
const FILTERS = [['all', 'Everybody'], ['free', 'Free'], ['plus', 'Moments+'], ['black', 'Black'], ['paying', 'Paying'], ['gift', 'Gift / code'], ['closed', 'Closed']];
const tierWord = (t) => (t === 'VIP' ? 'Black' : t === 'BASIC' ? 'Moments+' : 'Free');

const Person = ({ p, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const run = async (k, fn, ok) => {
    setBusy(k); setNote(null);
    const r = await fn();
    setBusy(null);
    if (r && r.ok) { tapSuccess(); setNote(ok); onChanged(); }
    else setNote((r && r.reason === 'paying') ? 'They already pay for longer.' : (r && r.reason === 'not_configured') ? 'Needs the Lemon Squeezy key on the server.' : (r && r.reason === 'team') ? 'Studio team accounts are not closed from here.' : 'Did not work (' + ((r && r.reason) || 'no answer') + ').');
  };
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Pressable onPress={() => { tapLight(); setOpen((x) => !x); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
        <Image source={{ uri: p.avatar_url || AV_NEUTRAL }} style={{ width: 34, height: 34, borderRadius: 17, marginEnd: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{(p.name || '—') + (p.handle ? '  @' + p.handle : '')}</Text>
          <Text style={{ color: C.dim, fontSize: 12, marginTop: 1 }} numberOfLines={1} selectable>{[p.email, p.city].filter(Boolean).join(' · ')}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700' }}>{p.standing === 'closed' ? 'Closed' : tierWord(p.tier)}</Text>
          {p.source ? <Text style={{ color: C.faint, fontSize: 11 }}>{p.source === 'lemonsqueezy' ? 'paying' : p.source}{p.until ? ' · ' + new Date(p.until).toLocaleDateString() : ''}</Text> : null}
        </View>
      </Pressable>
      {open ? (
        <View style={{ paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Act label="Gift Black · 1 month" busy={busy === 'gb'} onPress={() => run('gb', () => giftMembership(p.id, 'vip', 30), 'Black for a month, nothing to pay.')} />
            <Act label="Gift Moments+ · 1 month" busy={busy === 'gp'} onPress={() => run('gp', () => giftMembership(p.id, 'basic', 30), 'Moments+ for a month, nothing to pay.')} />
            {p.source === 'gift' || p.source === 'promo' ? <Act label="End the gift" busy={busy === 'eg'} onPress={() => run('eg', () => endGift(p.id), 'Gift ended.')} /> : null}
            <Act label="A code just for them" busy={busy === 'cd'} onPress={async () => {
              setBusy('cd'); const r = await promoSave({ kind: 'days', tier: 'vip', days: 30, max_uses: 1, for_user: p.id }); setBusy(null);
              if (r && r.ok) { copy(SITE + '?code=' + r.code); setNote('Code ' + r.code + ' (a month of Black, only for them). Link copied: ' + SITE + '?code=' + r.code); } else setNote('Could not make a code.');
            }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {p.has_sub ? <Act label="Stop renewing" busy={busy === 'st'} onPress={() => run('st', () => stopRenewing(p.id), 'It will not renew; they keep it until the paid period ends.')} /> : null}
            {p.has_sub || p.source === 'lemonsqueezy' ? <Act label="Refund (Lemon Squeezy)" onPress={() => { tapLight(); try { window.open('https://app.lemonsqueezy.com/orders?search=' + encodeURIComponent(p.email || ''), '_blank'); } catch (e) {} }} /> : null}
            {p.standing === 'closed'
              ? <Act label="Reopen account" busy={busy === 'ro'} onPress={() => run('ro', () => setStanding(p.id, 'clear'), 'Account reopened.')} />
              : <Act label="Close account" busy={busy === 'cl'} onPress={() => run('cl', () => setStanding(p.id, 'closed'), 'Account closed.' + (p.has_sub ? ' Stop their renewal too, and refund what is fair.' : ''))} />}
          </View>
          {note ? <Text style={{ color: C.text, fontSize: 12.5, marginTop: 8, lineHeight: 18 }} selectable>{note}</Text> : null}
        </View>
      ) : null}
    </View>
  );
};

const Everybody = () => {
  const [f, setF] = useState('all');
  const [q, setQ] = useState('');
  const [r, setR] = useState(null);
  const [more, setMore] = useState(0);
  const load = (off = 0) => members(f, q, off).then((x) => {
    if (!(x && x.ok)) { setR({ ok: false }); return; }
    setR((old) => (off && old && old.people ? { ...x, people: old.people.concat(x.people) } : x));
    setMore(off);
  });
  useEffect(() => { const t = setTimeout(() => load(0), q ? 300 : 0); return () => clearTimeout(t); }, [f, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = (r && r.counts) || {};
  return (
    <View>
      <Head sub="Tap anybody for the actions. Filter, then make an offer to just that group with a code.">Everybody</Head>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {FILTERS.map(([k, label]) => <Chip key={k} label={label + (n[k] != null ? ' · ' + n[k] : '')} on={f === k} onPress={() => setF(k)} />)}
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder="Name, @handle, email or city" placeholderTextColor={C.faint}
        style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4, outlineStyle: 'none' }} />
      {r == null ? <ActivityIndicator color={C.text} style={{ marginTop: 20 }} />
        : r.ok === false ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 14 }}>Owner only — unlock the Studio again, and run the latest server setup.</Text>
        : (
          <>
            {r.people.map((p) => <Person key={p.id} p={p} onChanged={() => load(0)} />)}
            {r.people.length < r.total ? <Act label={'More (' + (r.total - r.people.length) + ')'} onPress={() => load(more + 50)} /> : null}
          </>
        )}
    </View>
  );
};

export const MembersTab = () => (
  <View>
    <Promos />
    <Everybody />
  </View>
);

/* ── SAFETY CHECKS ── the photo each person sent (a live selfie or a
   card), shown for five minutes from the private bucket; Approve or Turn
   down, and the photo is deleted at once (zero storage). Owner or the
   Studio's verify team (RUN_ME.sql, studio_safety_decide). */
const CheckRow = ({ p, onDone }) => {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => { if (p.photo_path) safetyPhotoUrl(p.photo_path).then(setUrl); }, [p.photo_path]);
  const decide = async (ok) => { setBusy(ok ? 'y' : 'n'); const r = await safetyDecide(p.user_id, ok); setBusy(null); if (r && r.ok) { tapSuccess(); onDone(); } };
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
      {url ? <Image source={{ uri: url }} style={{ width: 96, height: 128, borderRadius: 12, backgroundColor: C.glassHi, marginEnd: 12 }} />
        : <View style={{ width: 96, height: 128, borderRadius: 12, backgroundColor: C.glassHi, marginEnd: 12 }} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{p.name || '—'}</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{(p.kind === 'selfie' ? 'Live selfie' : 'ID / university card') + (p.city ? ' · ' + p.city : '')}</Text>
        {p.handle ? <Text style={{ color: C.text, fontSize: 13, marginTop: 4 }} selectable>{p.handle}</Text> : null}
        {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18, marginTop: 8 }} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Act label="Approve" strong busy={busy === 'y'} onPress={() => decide(true)} />
          <Act label="Turn down" busy={busy === 'n'} onPress={() => decide(false)} />
        </View>
      </View>
    </View>
  );
};
export const SafetyChecksTab = () => {
  const [r, setR] = useState(null);
  const load = () => safetyList().then(setR);
  useEffect(() => { load(); }, []);
  return (
    <View>
      <Head sub="One check per person, before they book a Drop or start a chat. Compare the photo with their profile; the photo is deleted the moment you decide, either way.">Safety checks</Head>
      {r == null ? <ActivityIndicator color={C.text} style={{ marginTop: 20 }} />
        : !r.ok ? <Text style={{ color: C.dim, fontSize: 13 }}>Owner or the verify team only — unlock the Studio again.</Text>
        : !r.people.length ? <Text style={{ color: C.dim, fontSize: 13.5 }}>Nobody is waiting.</Text>
        : r.people.map((p) => <CheckRow key={p.user_id} p={p} onDone={load} />)}
      <GlobalReady />
    </View>
  );
};

/* Level 3 and 4 members who said which programme they are ready for
   (RUN_ME.sql, global_apply). Contact them yourself; mark it here. */
const GK = { exchange: 'Erasmus+ youth exchange', volunteer: 'International volunteering', travel: 'Partner travel programme' };
const GlobalReady = () => {
  const [r, setR] = useState(null);
  const load = () => studioGlobalList().then(setR);
  useEffect(() => { load(); }, []);
  return (
    <View style={{ marginTop: 26 }}>
      <Head sub="Members at level 3 or 4 who told the team which programme they are ready for. Reach out yourself, then mark them contacted.">Global Track · ready to go</Head>
      {r == null ? <ActivityIndicator color={C.text} style={{ marginTop: 20 }} />
        : !r.ok ? <Text style={{ color: C.dim, fontSize: 13 }}>Owner or the verify team only.</Text>
        : !r.rows.length ? <Text style={{ color: C.dim, fontSize: 13.5 }}>Nobody yet.</Text>
        : r.rows.map((x) => (
          <View key={x.user_id + x.kind} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Image source={{ uri: x.avatar_url || AV_NEUTRAL }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            <View style={{ flex: 1, marginStart: 10 }}>
              <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }}>{(x.name || 'Member') + (x.handle ? '  @' + x.handle : '')}</Text>
              <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{GK[x.kind] + ' · level ' + x.level + ' · ' + new Date(x.at).toLocaleDateString()}</Text>
            </View>
            {x.contacted_at ? <Text style={{ color: C.faint, fontSize: 12.5 }}>Contacted</Text> : (
              <Pressable onPress={() => { tapLight(); studioGlobalContacted(x.user_id, x.kind).then(load); }} accessibilityRole="button"
                style={{ borderWidth: 1, borderColor: C.text, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700' }}>Mark contacted</Text>
              </Pressable>
            )}
          </View>
        ))}
    </View>
  );
};
