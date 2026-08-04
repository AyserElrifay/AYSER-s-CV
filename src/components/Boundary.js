import React from 'react';
import { View, Text, Pressable, Platform, ScrollView } from 'react-native';
import { C, R } from '../constants/theme';
import { note, diagnosticsOn } from '../lib/crashLog';

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
    this.state = { failed: false, detail: null };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err, info) {
    /* Kept, always — see src/lib/crashLog.js. A crash on a real phone
       used to leave nothing behind, so the only way to find the cause
       was to guess. Users still never see any of this; the message on
       screen is written for them. */
    const entry = note(this.props.name || 'screen', err,
      info && info.componentStack ? String(info.componentStack).split('\n').slice(0, 4).join('\n') : null);
    this.setState({ detail: entry });
    if (this.props.onError) { try { this.props.onError(err); } catch (e) {} }
  }

  copy = () => {
    const d = this.state.detail;
    if (!d) return;
    const text = '[' + d.where + '] ' + d.msg + (d.stack ? '\n' + d.stack : '') + (d.extra ? '\n' + d.extra : '');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
    this.setState({ copied: true });
  };

  retry = () => {
    this.setState({ failed: false, copied: false });
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

        {/* The owner, and only the owner, gets the real reason. A person
            using the app is never shown a stack trace. */}
        {diagnosticsOn() && this.state.detail ? (
          <View style={{ marginTop: 22, alignSelf: 'stretch', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, maxHeight: 240 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: C.faint, fontSize: 10, fontWeight: '900', letterSpacing: 1, flex: 1 }}>
                {String(this.state.detail.where).toUpperCase()}
              </Text>
              <Pressable onPress={this.copy} hitSlop={8}>
                <Text style={{ color: C.purple, fontSize: 11, fontWeight: '900' }}>
                  {this.state.copied ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </View>
            <ScrollView>
              <Text selectable style={{ color: C.text, fontSize: 11.5, fontWeight: '700' }}>
                {this.state.detail.msg}
              </Text>
              {this.state.detail.stack ? (
                <Text selectable style={{ color: C.faint, fontSize: 10, marginTop: 6, lineHeight: 14 }}>
                  {this.state.detail.stack}
                </Text>
              ) : null}
              {this.state.detail.extra ? (
                <Text selectable style={{ color: C.dim, fontSize: 10, marginTop: 6, lineHeight: 14 }}>
                  {this.state.detail.extra}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  }
}
