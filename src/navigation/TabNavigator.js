import React from 'react';
import { Platform } from 'react-native';
import { DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SQUADS, DMS } from '../constants/mockData';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { ChillScreen } from '../screens/ChillScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { VaultScreen } from '../screens/VaultScreen';

/* ─────────────────────── NAVIGATION SHELL ─────────────────────── */

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  HOME: { lib: 'ion', on: 'home', off: 'home-outline' },
  MAP: { lib: 'ion', on: 'map', off: 'map-outline' },
  CHILL: { lib: 'mci', on: 'popcorn', off: 'popcorn' },
  CHATS: { lib: 'ion', on: 'chatbubbles', off: 'chatbubbles-outline' },
  VAULT: { lib: 'mci', on: 'safe', off: 'safe' },
};

const renderTabIcon = (routeName, focused, color) => {
  const cfg = TAB_ICONS[routeName];
  const name = focused ? cfg.on : cfg.off;
  if (cfg.lib === 'mci') return <MaterialCommunityIcons name={name} size={21} color={color} />;
  return <Ionicons name={name} size={21} color={color} />;
};

const UNREAD_TOTAL =
  SQUADS.reduce((n, s) => n + s.unread, 0) + DMS.reduce((n, d) => n + d.unread, 0);

export const NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: '#141418',
    border: C.line,
    primary: C.purple,
    text: C.text,
  },
};

export const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: '#CDB4FF',
      tabBarInactiveTintColor: C.faint,
      tabBarStyle: {
        backgroundColor: '#141418',
        borderTopColor: C.line,
        borderTopWidth: 1,
        height: Platform.OS === 'ios' ? 84 : 66,
        paddingTop: 6,
      },
      tabBarLabelStyle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4 },
      tabBarIcon: ({ focused, color }) => renderTabIcon(route.name, focused, color),
    })}
  >
    <Tab.Screen name="HOME" component={HomeScreen} />
    <Tab.Screen name="MAP" component={MapScreen} />
    <Tab.Screen name="CHILL" component={ChillScreen} />
    <Tab.Screen
      name="CHATS"
      component={ChatsScreen}
      options={{
        tabBarBadge: UNREAD_TOTAL,
        tabBarBadgeStyle: { backgroundColor: C.coral, color: '#fff', fontSize: 10, fontWeight: '900' },
      }}
    />
    <Tab.Screen name="VAULT" component={VaultScreen} />
  </Tab.Navigator>
);
