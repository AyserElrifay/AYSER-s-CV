import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';

/* The legal document — Terms of Use, the content-ownership rule that
   shifts liability to uploaders, and the DMCA / takedown policy that
   protects the app owner. Plain, honest, readable. Update SUPPORT_EMAIL
   / the DMCA agent line with your real details before launch. */

const SUPPORT_EMAIL = 'ayseryourlifecoach@gmail.com';

const H = ({ children }) => (
  <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 20, marginBottom: 6 }}>{children}</Text>
);
const P = ({ children }) => (
  <Text style={{ color: C.dim, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>{children}</Text>
);

export const TermsSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ marginRight: 6 }}>
            <Ionicons name="chevron-back" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>Terms & Content Policy</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: C.faint, fontSize: 12, marginBottom: 4 }}>Moments — Terms of Use · last updated {new Date().getFullYear()}</Text>

          <H>1. Using Moments</H>
          <P>Moments is a social app for sharing photos, videos, moments, music and messages with real people. You must be old enough to use it under the laws of your country. Be kind and follow these terms — accounts that break them can be limited or removed.</P>

          <H>2. Your content is yours — and your responsibility</H>
          <P>You keep ownership of everything you post or upload. By uploading, you confirm that you own it or have the right to share it, and you give Moments a licence to host and display it inside the app so other users can see it.</P>
          <P>You must NOT upload anything you don't have the rights to — including music, video, or work owned by someone else. Uploading copyrighted material you don't own is against these terms, and the responsibility for it is yours, not the app's.</P>

          <H>3. Music</H>
          <P>Tracks in the Music Hub are either supplied by Moments under a royalty-free / open licence (shown with the track), or uploaded by creators who confirm they own the rights. Only use a track in your own posts through the in-app tools, which keep the required credit attached.</P>

          <H>4. What's not allowed</H>
          <P>No content that is illegal, hateful, harassing, violent, sexual involving minors, or that infringes someone's copyright or privacy. No spam or scams. No impersonation.</P>

          <H>5. Reporting & takedowns (DMCA)</H>
          <P>Every piece of content has a Report button. If you believe something infringes your copyright or breaks these rules, report it — or contact our designated agent at the address below with: your details, the work concerned, the link to the content, and a statement that you own the rights. We remove content that genuinely infringes rights or breaks the rules.</P>
          <Pressable onPress={() => Linking.openURL('mailto:' + SUPPORT_EMAIL + '?subject=Copyright%20%2F%20Takedown%20notice')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purpleSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 }}>
              <Ionicons name="mail-outline" size={17} color={C.purple} />
              <Text style={{ color: C.purple, fontSize: 13, fontWeight: '800', marginLeft: 9 }}>{SUPPORT_EMAIL}</Text>
            </View>
          </Pressable>

          <H>6. Repeat infringers</H>
          <P>Accounts that repeatedly upload infringing or abusive content will be suspended or removed.</P>

          <H>7. The app is provided "as is"</H>
          <P>We work hard to keep Moments running and safe, but we can't promise it will always be perfect or available. To the extent the law allows, Moments is provided as-is and we're not liable for content posted by users — that content belongs to, and is the responsibility of, the people who post it.</P>

          <H>8. Changes & contact</H>
          <P>We may update these terms as the app grows; continued use means you accept the current version. Questions? Reach us any time.</P>
          <Pressable onPress={() => Linking.openURL('mailto:' + SUPPORT_EMAIL)}>
            <Text style={{ color: C.purple, fontSize: 13, fontWeight: '800', marginTop: 2 }}>{SUPPORT_EMAIL}</Text>
          </Pressable>

          <Text style={{ color: C.faint, fontSize: 11, marginTop: 24, lineHeight: 16 }}>
            This is a plain-language policy to keep users and the app safe. For a public launch in your market, have a lawyer review it and register a DMCA agent (≈ $6, US Copyright Office) so safe-harbour protection fully applies.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};
