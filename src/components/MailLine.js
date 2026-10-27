import React from 'react';
import { Text, Pressable, Linking } from 'react-native';
import { C } from '../constants/theme';
import { mailto } from '../constants/contacts';
import { tapLight } from '../utils/feedback';

/* one quiet line: the mailbox that handles this screen (src/constants/contacts.js) */
export const MailLine = ({ to, subject, style }) => (
  <Pressable onPress={() => { tapLight(); Linking.openURL(mailto(to, subject)).catch(() => {}); }} accessibilityRole="link" hitSlop={8} style={[{ alignSelf: 'center', marginTop: 18 }, style]}>
    <Text style={{ color: C.dim, fontSize: 13 }}>{'✉️  '}<Text style={{ color: C.purple, fontWeight: '600' }}>{to}</Text></Text>
  </Pressable>
);
