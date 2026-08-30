import React from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useLang } from '../context/LanguageContext';
import { SQUADS, DMS } from '../constants/mockData';
import { HomeScreen } from '../screens/HomeScreen';
import { Boundary } from '../components/Boundary';
import { SwipeTabs } from './SwipeTabs';
import { lazyScreen } from '../lib/lazyScreen';

/* ─── ONLY THE FEED IS IN THE FIRST DOWNLOAD ─────────────────────────
   Home is what you land on, so it is here in full. The other five are
   fetched the moment you first go to them and then kept, which on a
   phone is the difference between waiting for the map, the camera and
   five games before your own feed appears, and not.

   Measured on the built bundle rather than assumed — the numbers are
   in the commit. */
/* These are named exports, and React.lazy only understands a default —
   hence the one-line rename on the way through. */
const MapScreen = lazyScreen(() => import('../screens/MapScreen').then((m) => ({ default: m.MapScreen })));
const ReelsScreen = lazyScreen(() => import('../screens/ReelsScreen').then((m) => ({ default: m.ReelsScreen })));
const ChillScreen = lazyScreen(() => import('../screens/ChillScreen').then((m) => ({ default: m.ChillScreen })));
const ChatsScreen = lazyScreen(() => import('../screens/ChatsScreen').then((m) => ({ default: m.ChatsScreen })));
const ProfileScreen = lazyScreen(() => import('../screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen })));

/* Each tab renders inside its own boundary. If one screen throws, that
   tab shows a "try again" instead of the whole app going down with it —
   a broken Chats shouldn't cost you the map, the camera and your feed.
   The root boundary in App.js is the backstop; this is the fuse. */
const guarded = (Screen, name) => {
  const Guarded = (props) => (
    // the name is what the crash log records — "Chats" is worth far
    // more than "screen" when you're reading it back later
    <Boundary soft name={name}>
      {/* The swipe lives inside the boundary on purpose: a screen that
          throws still loses only itself, and you can still swipe off it
          to somewhere that works instead of being stranded — including
          off one that is still arriving. */}
      <SwipeTabs>
        <Screen {...props} />
      </SwipeTabs>
    </Boundary>
  );
  Guarded.displayName = 'Guarded(' + (name || Screen.displayName || Screen.name || 'Screen') + ')';
  return Guarded;
};

const HomeTab = guarded(HomeScreen, 'Home');
const MapTab = guarded(MapScreen, 'Map');
const ReelsTab = guarded(ReelsScreen, 'Reels');
const ChillTab = guarded(ChillScreen, 'Chill');
const ChatsTab = guarded(ChatsScreen, 'Chats');
const ProfileTab = guarded(ProfileScreen, 'Profile');

/* ─────────────────────── NAVIGATION SHELL ─────────────────────── */

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  HOME: { lib: 'ion', on: 'home', off: 'home-outline' },
  MAP: { lib: 'ion', on: 'map', off: 'map-outline' },
  REELS: { lib: 'mci', on: 'star-four-points', off: 'star-four-points-outline' },
  CHILL: { lib: 'mci', on: 'popcorn', off: 'popcorn' },
  CHATS: { lib: 'ion', on: 'chatbubbles', off: 'chatbubbles-outline' },
  SPACE: { lib: 'ion', on: 'person', off: 'person-outline' },
};

/* ─── THE BAR YOU LOOK AT ALL DAY ───────────────────────────────────
   It was six 21px outlines in grey, under 9.5px capitals spaced out
   like a spreadsheet header. Small, thin and colourless — the reason
   Ayser said the app looks old, more than any single screen does,
   because this is the one thing on screen the whole time.

   Now the tab you are on sits in a soft violet pill, and everything is
   bigger: the icon, the label, the row. Bigger is not only friendlier
   to a nine-year-old's aim and to eyes that are not twenty any more —
   it is also what current design looks like, and the two wants turn
   out to be the same want. */
const renderTabIcon = (routeName, focused, color) => {
  const cfg = TAB_ICONS[routeName];
  const name = focused ? cfg.on : cfg.off;
  const glyph = cfg.lib === 'mci'
    ? <MaterialCommunityIcons name={name} size={24} color={color} />
    : <Ionicons name={name} size={24} color={color} />;
  return (
    <View style={{
      minWidth: 56, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: focused ? C.purpleSoft : 'transparent',
    }}>
      {glyph}
    </View>
  );
};

/* Demo-mode only: the sample chats carry sample unread counts. In real
   mode there is NO badge unless it reflects something true — a made-up
   number on the tab bar is exactly the kind of fake we don't do. */
const UNREAD_TOTAL = SUPABASE_READY
  ? undefined
  : SQUADS.reduce((n, s) => n + s.unread, 0) + DMS.reduce((n, d) => n + d.unread, 0);

// A function, not a frozen object — `C`'s values get mutated in place
// when dark mode toggles, so this must be re-read at render time, not
// baked once at module import.
export const buildNavTheme = () => ({
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card: C.bg2,
    border: C.line,
    primary: C.purple,
    text: C.text,
  },
});

const TAB_LABEL_KEY = {
  HOME: 'tab_home', MAP: 'tab_map', REELS: 'tab_reels', CHILL: 'tab_chill', CHATS: 'tab_chats', SPACE: 'tab_space',
};

export const TabNavigator = () => {
  const { t } = useLang();
  const { width } = useWindowDimensions();
  // On a wide screen (laptop/desktop) the bottom tab bar becomes a real
  // left sidebar — the VK / Facebook desktop shell — with icon + label
  // rows; on phones it stays the familiar bottom bar.
  const sidebar = Platform.OS === 'web' && width >= 820;
  return (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      // A cut between tabs reads as a glitch when a finger caused it;
      // a shift reads as movement, which is what the finger did.
      animation: 'shift',
      tabBarPosition: sidebar ? 'left' : 'bottom',
      tabBarActiveTintColor: C.purple,
      tabBarInactiveTintColor: C.faint,
      tabBarLabelPosition: sidebar ? 'beside-icon' : 'below-icon',
      tabBarStyle: sidebar
        ? {
            width: 224,
            backgroundColor: C.bg2,
            borderRightColor: C.line,
            borderRightWidth: 1,
            borderTopWidth: 0,
            paddingTop: 22,
            paddingHorizontal: 10,
          }
        : {
            backgroundColor: C.bg2,
            borderTopColor: C.line,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 92 : 74,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 0 : 6,
          },
      tabBarItemStyle: sidebar
        ? { height: 50, borderRadius: 12, marginBottom: 4, justifyContent: 'flex-start', paddingLeft: 6 }
        : undefined,
      tabBarLabelStyle: sidebar
        ? { fontSize: 14, fontWeight: '800', letterSpacing: 0.4, marginLeft: 10, textAlign: 'left' }
        : { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6, marginTop: 3 },
      tabBarLabel: t(TAB_LABEL_KEY[route.name]),
      tabBarIcon: ({ focused, color }) => renderTabIcon(route.name, focused, color),
    })}
  >
    <Tab.Screen name="HOME" component={HomeTab} />
    <Tab.Screen name="MAP" component={MapTab} />
    <Tab.Screen name="REELS" component={ReelsTab} />
    <Tab.Screen name="CHILL" component={ChillTab} />
    <Tab.Screen
      name="CHATS"
      component={ChatsTab}
      options={{
        tabBarBadge: UNREAD_TOTAL,
        tabBarBadgeStyle: { backgroundColor: C.coral, color: '#fff', fontSize: 10, fontWeight: '900' },
      }}
    />
    <Tab.Screen name="SPACE" component={ProfileTab} />
  </Tab.Navigator>
  );
};
