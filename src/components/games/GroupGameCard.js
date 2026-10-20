import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Image, TextInput, ActivityIndicator } from 'react-native';
import { C } from '../../constants/theme';
import { AV_NEUTRAL } from '../../constants/mockData';
import { gameState, gameMove, revealGame, onGroupPing, pingGroup } from '../../services/squadGames';
import { gw, fill } from './words';
import { tapLight, tapSelection, tapSuccess } from '../../utils/feedback';

/* ─── ONE GROUP GAME, INSIDE THE CHAT ─────────────────────────────────
   The card a game message turns into. What it shows is the server's
   state (sgame_state): who is in, who voted for whom, which squares
   are done. A move is sent, the state is fetched again, and the other
   phones in the chat are told to look (services/squadGames.js). */

const Face = ({ p, size = 26, on }) => (
  <Image source={{ uri: (p && p.avatar) || AV_NEUTRAL }}
    style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: on ? C.green : C.bg2 }} />
);

const Btn = ({ label, onPress, ghost, busy, disabled }) => (
  <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" style={{ flex: 1 }}>
    <View style={{ borderRadius: 999, paddingVertical: 10, alignItems: 'center', backgroundColor: ghost ? C.glassHi : C.purple, opacity: disabled ? 0.5 : 1 }}>
      {busy ? <ActivityIndicator size="small" color={ghost ? C.text : '#FFF'} />
        : <Text style={{ color: ghost ? C.text : '#FFF', fontSize: 13.5, fontWeight: '900' }}>{label}</Text>}
    </View>
  </Pressable>
);

export const GroupGameCard = ({ gameId, squadId, meId, lang, onMakePlan }) => {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [guess, setGuess] = useState('');
  const T = (k) => gw(lang, k);

  const load = useCallback(() => gameState(gameId).then((r) => { if (r && r.ok) setS(r); else if (r) setErr(T(r.reason === 'setup' ? 'setup' : 'err')); }), [gameId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useEffect(() => onGroupPing(squadId, (g) => { if (!g || g === gameId) load(); }), [squadId, gameId, load]);

  const act = async (fn) => {
    setBusy(true); setErr(null);
    try {
      const r = await fn();
      if (r && r.ok === false) setErr(T(r.reason === 'yours' ? 'yours_err' : r.reason === 'over' || r.reason === 'no_more' || r.reason === 'setup' || r.reason === 'offline' ? r.reason : 'err'));
      else { if (r && r.right === false) setErr(T('wrong')); await load(); pingGroup(squadId, gameId); }
      return r;
    } finally { setBusy(false); }
  };
  const move = (slot, m) => { tapSelection(); return act(() => gameMove(gameId, slot, m)); };

  if (!s) {
    return (
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 14, minWidth: 230 }}>
        {err ? <Text style={{ color: C.dim, fontSize: 13 }}>{err}</Text> : <ActivityIndicator color={C.purple} />}
      </View>
    );
  }

  const members = s.members || [];
  const who = (id) => members.find((m) => m.id === id) || {};
  const moves = s.moves || [];
  const mine = (slot = '') => moves.find((m) => m.user === meId && m.slot === slot);
  const over = s.status === 'done';
  const d = s.data || {};
  const head = { roulette: '🎡 ' + T('roulette'), likely: '🗳️ ' + T('likely'), bingo: '🎯 ' + T('bingo'), spot: '📍 ' + T('spot'), truths: '🤞 ' + T('truths') }[s.kind];

  let body = null;
  if (s.kind === 'roulette') {
    const ins = moves.filter((m) => m.move && m.move.in);
    const me = mine();
    const enough = ins.length >= (d.need || 3);
    body = (
      <>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginTop: 6 }}>{(d.emoji || '✨') + ' ' + d.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          {ins.slice(0, 8).map((m, i) => <View key={m.user} style={{ marginStart: i ? -8 : 0 }}><Face p={who(m.user)} on /></View>)}
          <Text style={{ color: enough ? C.green : C.dim, fontSize: 12.5, fontWeight: '800', marginStart: ins.length ? 8 : 0 }}>
            {enough ? '✓ ' + T('on') : fill(T('need'), { n: ins.length, k: d.need || 3 })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
          <Btn label={T('in')} busy={busy} ghost={!!(me && me.move.in)} onPress={() => move('', { in: true })} />
          <Btn label={T('out')} ghost onPress={() => move('', { in: false })} />
        </View>
        {enough && onMakePlan ? (
          <Pressable onPress={() => { tapSuccess(); onMakePlan({ kind: d.kind, title: d.title, about: d.about || '', hour: d.hour }); }} accessibilityRole="button" style={{ marginTop: 10, alignItems: 'center' }}>
            <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{T('make_plan') + ' →'}</Text>
          </Pressable>
        ) : null}
      </>
    );
  } else if (s.kind === 'likely') {
    const tally = {};
    moves.forEach((m) => { const v = m.move && m.move.vote; if (v) tally[v] = (tally[v] || 0) + 1; });
    const me = mine();
    const top = over && s.result && s.result.top ? who(s.result.top) : null;
    body = (
      <>
        <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '900', marginTop: 6 }}>{T('likely').replace('…', '') + ' ' + d.q + '?'}</Text>
        {top ? (
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Face p={top} size={52} on />
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 6 }}>{fill(T('top'), { name: top.name || '' })}</Text>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{fill(T('picks'), { name: top.name || '' })}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {members.map((p) => {
              const sel = me && me.move.vote === p.id;
              return (
                <Pressable key={p.id} onPress={() => !over && move('', { vote: p.id })} accessibilityRole="radio" accessibilityState={{ selected: !!sel }}
                  style={{ alignItems: 'center', width: 64, marginBottom: 8 }}>
                  <Face p={p} size={40} on={sel} />
                  <Text style={{ color: C.text, fontSize: 11.5, fontWeight: sel ? '900' : '600', marginTop: 3 }} numberOfLines={1}>{p.name}</Text>
                  {tally[p.id] ? <Text style={{ color: C.purple, fontSize: 11, fontWeight: '900' }}>{tally[p.id]}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}
        {!over && (s.mine || s.admin) && moves.length ? (
          <View style={{ flexDirection: 'row', marginTop: 4 }}><Btn label={T('reveal')} busy={busy} onPress={() => act(() => revealGame(gameId))} /></View>
        ) : null}
      </>
    );
  } else if (s.kind === 'bingo') {
    const cells = d.cells || [];
    const by = {};
    moves.forEach((m) => { (by[m.slot] = by[m.slot] || []).push(m.user); });
    const doneN = Object.keys(by).length;
    body = (
      <>
        <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800', marginTop: 4 }}>{fill(T('cells_done'), { n: doneN })}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -3 }}>
          {cells.map((c, i) => {
            const users = by[String(i)] || [];
            const on = users.length > 0;
            return (
              <Pressable key={i} onPress={() => (users.includes(meId) ? move(String(i), null) : move(String(i), { done: true }))}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ width: '33.33%', padding: 3 }}>
                <View style={{ minHeight: 74, borderRadius: 12, padding: 7, justifyContent: 'space-between', backgroundColor: on ? C.greenSoft : C.glassHi, borderWidth: 1, borderColor: on ? C.green : 'transparent' }}>
                  <Text style={{ color: C.text, fontSize: 11.5, fontWeight: '700', lineHeight: 15 }} numberOfLines={3}>{c}</Text>
                  {on ? (
                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                      {users.slice(0, 3).map((u, k) => <View key={u} style={{ marginStart: k ? -6 : 0 }}><Face p={who(u)} size={16} /></View>)}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  } else if (s.kind === 'spot') {
    const me = mine();
    const tries = me && me.move.n ? 5 - me.move.n : 5;
    const by = over && s.result && s.result.by ? who(s.result.by) : null;
    body = (
      <>
        <Image source={{ uri: d.photo }} style={{ width: '100%', height: 190, borderRadius: 14, marginTop: 8, backgroundColor: C.glassHi }} resizeMode="cover" />
        {d.hint ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 6 }}>{'💡 ' + d.hint}</Text> : null}
        {over ? (
          <Text style={{ color: C.green, fontSize: 14.5, fontWeight: '900', marginTop: 10 }}>
            {by ? fill(T('guessed'), { name: by.name || '', a: (s.secret && s.secret.answer) || '' }) : '📍 ' + ((s.secret && s.secret.answer) || '')}
          </Text>
        ) : s.mine ? (
          <View style={{ flexDirection: 'row', marginTop: 10 }}><Btn label={T('reveal')} ghost busy={busy} onPress={() => act(() => revealGame(gameId))} /></View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <TextInput value={guess} onChangeText={setGuess} placeholder={T('guess_ph')} placeholderTextColor={C.faint} maxLength={60}
                style={{ flex: 1, color: C.text, fontSize: 14.5, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.bg }} />
              <View style={{ width: 90, marginStart: 8 }}>
                <Btn label={T('guess')} busy={busy} disabled={!guess.trim() || tries <= 0} onPress={async () => { const r = await move('', { guess: guess.trim() }); if (r && r.ok) setGuess(''); }} />
              </View>
            </View>
            <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 5 }}>{fill(T('tries'), { n: Math.max(0, tries) })}</Text>
          </>
        )}
      </>
    );
  } else if (s.kind === 'truths') {
    const lines = d.lines || [];
    const me = mine();
    const plan = over && s.secret ? s.secret.plan : null;
    const picks = {};
    if (over) moves.forEach((m) => { if (m.move && m.move.pick != null) picks[m.move.pick] = (picks[m.move.pick] || 0) + 1; });
    body = (
      <>
        <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800', marginTop: 4 }}>
          {(s.starter && s.starter.name ? s.starter.name + ' · ' : '') + (s.mine ? T('which_plan') : T('pick_one'))}
        </Text>
        {lines.map((l, i) => {
          const sel = me && me.move.pick === i;
          const isPlan = plan === i;
          return (
            <Pressable key={i} disabled={s.mine || over} onPress={() => move('', { pick: i })} accessibilityRole="radio" accessibilityState={{ selected: !!sel }} style={{ marginTop: 8 }}>
              <View style={{ borderRadius: 12, padding: 11, borderWidth: 1.5, borderColor: isPlan ? C.green : sel ? C.purple : C.line, backgroundColor: isPlan ? C.greenSoft : sel ? C.purpleSoft : C.glass }}>
                <Text style={{ color: C.text, fontSize: 14, lineHeight: 19, fontWeight: sel || isPlan ? '800' : '600' }}>{l}</Text>
                {isPlan ? <Text style={{ color: C.green, fontSize: 12, fontWeight: '900', marginTop: 4 }}>{'✓ ' + T('the_plan')}</Text> : null}
                {over && picks[i] ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{'🗳️ ' + picks[i]}</Text> : null}
              </View>
            </Pressable>
          );
        })}
        {!over && (s.mine || s.admin) ? (
          <View style={{ flexDirection: 'row', marginTop: 10 }}><Btn label={T('reveal')} busy={busy} onPress={() => act(() => revealGame(gameId))} /></View>
        ) : null}
        {over && plan != null && onMakePlan ? (
          <Pressable onPress={() => { tapSuccess(); onMakePlan({ kind: 'circle', title: lines[plan] || '', about: '' }); }} accessibilityRole="button" style={{ marginTop: 10, alignItems: 'center' }}>
            <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{T('who_in') + ' · ' + T('make_plan') + ' →'}</Text>
          </Pressable>
        ) : null}
      </>
    );
  }

  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 14, width: 280, maxWidth: '100%' }}>
      <Pressable onPress={() => { tapLight(); load(); }} accessibilityRole="button">
        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>{(head || '').toUpperCase()}</Text>
      </Pressable>
      {body}
      {err ? <Text style={{ color: C.coral, fontSize: 12.5, fontWeight: '700', marginTop: 8 }}>{err}</Text> : null}
    </View>
  );
};
