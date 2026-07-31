import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { C, R } from '../constants/theme';

/* ── NOTHING GOES BLANK ──────────────────────────────────────────────
   When a React tree throws, React unmounts the whole thing. What's
   left is the page background and nothing else — a blank screen, no
   message, no way back. That has happened to us, and a blank screen is
   the worst possible failure: it looks like the app is broken rather
   than like one corner of it hit a snag.

   So the app sits inside this. Anything that throws gets caught here,
   the rest of the app carries on, and the person sees something they
   can act on. `soft` is for a piece of a screen — a sheet, a card —
   where the right answer is to close it and leave everything else
   alone. */
export class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    // Console only, and only in development. Users never see our
    // internals — the message on screen is written for them.
    if (__DEV__ && typeof console !== 'undefined') console.error('[boundary]', err);
    if (this.props.onError) { try { this.props.onError(err); } catch (e) {} }
  }

  retry = () => {
    this.setState({ failed: false });
    if (this.props.onRetry) { try { this.props.onRetry(); } catch (e) {} }
  };

  reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
    else this.retry();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.retry);

    const soft = !!this.props.soft;
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.bg, paddingHorizontal: 34,
      }}>
        <Text style={{ fontSize: 34 }}>🫤</Text>
        <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '900', marginTop: 12, textAlign: 'center' }}>
          {soft ? 'That bit didn\'t open' : 'Something went sideways'}
        </Text>
        <Text style={{ color: C.faint, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          {soft
            ? 'Nothing was lost. Close it and have another go.'
            : 'Nothing you posted is affected. Give it another go.'}
        </Text>
        <Pressable onPress={soft ? this.retry : this.reload} style={{ marginTop: 18 }}>
          <View style={{ backgroundColor: C.purple, borderRadius: R, paddingHorizontal: 26, paddingVertical: 13 }}>
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>
              {soft ? 'Try again' : 'Reload'}
            </Text>
          </View>
        </Pressable>
        {soft && this.props.onClose ? (
          <Pressable onPress={this.props.onClose} style={{ marginTop: 12 }}>
            <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>Close</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
}
