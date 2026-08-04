import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useLang } from '../context/LanguageContext';
import { SQUADS, DMS } from '../constants/mockData';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { ReelsScreen } from '../screens/ReelsScreen';
import { ChillScreen } from '../screens/ChillScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { Boundary } from '../components/Boundary';

/* Each tab renders inside its own boundary. If one screen throws, that
   tab shows a "try again" instead of the whole app going down with it —
   a broken Chats shouldn't cost you the map, the camera and your feed.
   The root boundary in App.js is the backstop; this is the fuse. */
const guarded = (Screen, name) => {
  const Guarded = (props) => (
    // the name is what the crash log records — "Chats" is worth far
    // more than "screen" when you're reading it back later
    <Boundary soft name={name}>
      <Screen {...props} />
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

const renderTabIcon = (routeName, focused, color) => {
  const cfg = TAB_ICONS[routeName];
  const name = focused ? cfg.on : cfg.off;
  if (cfg.lib === 'mci') return <MaterialCommunityIcons name={name} size={21} color={color} />;
  return <Ionicons name={name} size={21} color={color} />;
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
            height: Platform.OS === 'ios' ? 84 : 66,
            paddingTop: 6,
          },
      tabBarItemStyle: sidebar
        ? { height: 50, borderRadius: 12, marginBottom: 4, justifyContent: 'flex-start', paddingLeft: 6 }
        : undefined,
      tabBarLabelStyle: sidebar
        ? { fontSize: 14, fontWeight: '800', letterSpacing: 0.4, marginLeft: 10, textAlign: 'left' }
        : { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4 },
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
