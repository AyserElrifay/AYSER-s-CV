import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { C } from '../../constants/theme';
import { PLAY_LANGS } from './languages';
import { tapLight } from '../../utils/feedback';

/* ─── لمّة · PICK THE LANGUAGE YOU PLAY IN ───────────────────────────
   A row of chips, not a dropdown. Five options are fewer taps as
   chips, and everybody in the room can see at a glance that the choice
   exists — which is the difference between a feature and a setting
   nobody finds.

   Each chip is written in its OWN language. Nobody hunting for French
   is looking for the word "French".                                  */

export const LangPicker = ({ value, onChange, label }) => (
  <View>
    {label ? (
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </Text>
    ) : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingEnd: 8 }}>
      {PLAY_LANGS.map((l) => {
        const on = l.code === value;
        return (
          <Pressable
            key={l.code}
            onPress={() => { tapLight(); onChange && onChange(l.code); }}
            style={{ marginEnd: 8 }}
          >
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: on ? C.purple : C.glass,
              borderWidth: 1, borderColor: on ? C.purple : C.line,
              borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9,
            }}>
              <Text style={{ fontSize: 14 }}>{l.flag}</Text>
              <Text style={{
                color: on ? '#FFF' : C.text, fontSize: 13.5, fontWeight: '900', marginStart: 7,
              }}>
                {l.native}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);
