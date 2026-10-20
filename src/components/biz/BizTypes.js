import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { C } from '../../constants/theme';
import { bw, TYPES, tname } from './words';
import { tapSelection } from '../../utils/feedback';

/* The nine kinds, as a grid on the partner page — pick one and see what
   that kind gets. Hosts are sent on to be verified with an ID. */
export const BizTypes = ({ lang, value, onPick, onHost }) => {
  const B = (k) => bw(lang, k);
  const ty = TYPES.find((x) => x.k === value) || TYPES[0];
  const get = lang === 'ar' ? ty.get.ar : ty.get.en;
  return (
    <View>
      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginTop: 26 }}>{B('pick').toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginTop: 8 }}>
        {TYPES.map((x) => {
          const on = x.k === ty.k;
          return (
            <Pressable key={x.k} onPress={() => { tapSelection(); onPick(x.k); }} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ width: '33.33%', padding: 4 }}>
              <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purpleSoft : C.glass, paddingVertical: 12, alignItems: 'center', minHeight: 84, justifyContent: 'center' }}>
                <Text style={{ fontSize: 24 }}>{x.e}</Text>
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '900', marginTop: 4, textAlign: 'center' }} numberOfLines={2}>{tname(lang, x)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginTop: 14 }}>{B('for_you').toUpperCase()}</Text>
      {get.map((g) => (
        <View key={g} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold, marginEnd: 10 }} />
          <Text style={{ color: C.text, fontSize: 14, flex: 1 }}>{g}</Text>
        </View>
      ))}
      {ty.host ? (
        <View style={{ borderRadius: 18, padding: 14, backgroundColor: C.purpleSoft, marginTop: 14 }}>
          <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }}>{B('host_go')}</Text>
          <Pressable onPress={onHost} accessibilityRole="button" style={{ marginTop: 10 }}>
            <View style={{ borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: C.purple }}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{B('host_btn')}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};
