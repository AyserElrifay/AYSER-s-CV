import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { C } from '../constants/theme';
import { VOD_ROWS, GAMES, QUESTS } from '../constants/mockData';
import { Page, ScreenHeader, SectionHeader, Glass, Chip, NeonButton, PosterCard } from '../components';

/* ────────────────── TAB 3 · CHILL ZONE — ENTERTAINMENT ─────────────── */

export const ChillScreen = () => {
  const [orders, setOrders] = useState({});
  return (
    <Page>
      <ScreenHeader kicker="Entertainment · Delivered" title="Chill Zone 🍿" />

      {VOD_ROWS.map((row) => (
        <View key={row.title} style={{ marginBottom: 24 }}>
          <SectionHeader title={row.title} action="See all" onAction={() => {}} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {row.items.map((it) => (
              <PosterCard key={it.id} item={it} />
            ))}
          </ScrollView>
        </View>
      ))}

      <SectionHeader title="Order to Pin 📦 → 📍" />
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: -6, marginBottom: 14, lineHeight: 18 }}>
        Physical games delivered to your exact GPS pin. No address, no gate codes — the courier walks to the dot.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 26 }}>
        {GAMES.map((g) => {
          const on = !!orders[g.id];
          return (
            <Glass key={g.id} style={{ width: 156, padding: 14, marginRight: 12 }}>
              <Text style={{ fontSize: 30 }}>{g.emoji}</Text>
              <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 8 }}>{g.name}</Text>
              <Text style={{ color: C.dim, fontSize: 11.5, marginTop: 3 }}>{g.price} · ⏱ {g.eta}</Text>
              {on ? (
                <View style={{ marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)', backgroundColor: C.greenSoft, paddingVertical: 9, alignItems: 'center' }}>
                  <Text style={{ color: C.green, fontSize: 11, fontWeight: '900' }}>ON THE WAY · {g.eta}</Text>
                </View>
              ) : (
                <NeonButton small label="DROP TO MY PIN" style={{ marginTop: 12 }} onPress={() => setOrders((o) => ({ ...o, [g.id]: true }))} />
              )}
            </Glass>
          );
        })}
      </ScrollView>

      <SectionHeader title="AR Quests · earn $MOMENT" />
      {QUESTS.map((q) => {
        const complete = q.done >= q.steps;
        return (
          <Glass key={q.id} style={{ padding: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 22 }}>{q.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{q.title}</Text>
                <Text style={{ color: C.dim, fontSize: 12, marginTop: 3, lineHeight: 17 }}>{q.desc}</Text>
              </View>
              <Chip label={'+' + q.reward + ' $M'} color={C.green} tint={C.greenSoft} style={{ borderColor: 'rgba(16,185,129,0.4)', alignSelf: 'flex-start', marginLeft: 8 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <View style={{ flexDirection: 'row', flex: 1 }}>
                {Array.from({ length: q.steps }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 22, height: 6, borderRadius: 3, marginRight: 5,
                      backgroundColor: i < q.done ? C.purple : C.glassHi,
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: C.faint, fontSize: 11, marginRight: 12 }}>📍 {q.dist}</Text>
              {complete ? (
                <Chip label="COMPLETED ✓" color={C.green} tint={C.greenSoft} style={{ borderColor: 'rgba(16,185,129,0.4)' }} />
              ) : (
                <Pressable>
                  <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900' }}>Start quest →</Text>
                </Pressable>
              )}
            </View>
          </Glass>
        );
      })}
    </Page>
  );
};
