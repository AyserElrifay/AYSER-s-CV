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

export const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card: '#FFFFFF',
    border: C.line,
    primary: C.purple,
    text: C.text,
  },
};

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
            backgroundColor: '#FFFFFF',
            borderRightColor: C.line,
            borderRightWidth: 1,
            borderTopWidth: 0,
            paddingTop: 22,
            paddingHorizontal: 10,
          }
        : {
            backgroundColor: '#FFFFFF',
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
    <Tab.Screen name="HOME" component={HomeScreen} />
    <Tab.Screen name="MAP" component={MapScreen} />
    <Tab.Screen name="REELS" component={ReelsScreen} />
    <Tab.Screen name="CHILL" component={ChillScreen} />
    <Tab.Screen
      name="CHATS"
      component={ChatsScreen}
      options={{
        tabBarBadge: UNREAD_TOTAL,
        tabBarBadgeStyle: { backgroundColor: C.coral, color: '#fff', fontSize: 10, fontWeight: '900' },
      }}
    />
    <Tab.Screen name="SPACE" component={ProfileScreen} />
  </Tab.Navigator>
  );
};
