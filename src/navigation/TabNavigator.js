import React, { useContext } from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { VaultScreen } from '../screens/VaultScreen';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  const { theme } = useContext(ThemeContext);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: theme.bg2,
          borderTopWidth: 1, borderTopColor: theme.line,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarActiveTintColor: theme.purple,
        tabBarInactiveTintColor: theme.faint,
        tabBarIcon: ({ color }) => {
          let name = route.name === 'HOME' ? 'home' : route.name === 'MAP' ? 'map' : 'cube';
          return <Ionicons name={name} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HOME" component={HomeScreen} />
      <Tab.Screen name="MAP" component={MapScreen} />
      <Tab.Screen name="VAULT" component={VaultScreen} />
    </Tab.Navigator>
  );
};
