import React, { useContext } from 'react';
import { View, Text, FlatList, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { Glass } from '../components/Glass';
import { NeonButton } from '../components/NeonButton';
import { FEED } from '../constants/mockData';

export const HomeScreen = () => {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={FEED}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 100, paddingHorizontal: 16 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900', letterSpacing: 5 }}>MOMENTS</Text>
            <Text style={{ color: theme.faint, fontSize: 11, marginTop: 2 }}>Cairo, Egypt 📍</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Glass style={{ marginBottom: 20, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 13 }}>
              <Image source={{ uri: item.user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              <View style={{ marginLeft: 10 }}><Text style={{ color: theme.text, fontWeight: 'bold' }}>{item.user.name}</Text></View>
            </View>
            <ImageBackground source={{ uri: item.media }} style={{ height: 400, justifyContent: 'flex-end' }}>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={{ padding: 15 }}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{item.caption}</Text>
              </LinearGradient>
            </ImageBackground>
            <View style={{ padding: 15 }}>
              <NeonButton label="JOIN THE VIBE" icon="⚡" onPress={() => alert('Magic Flow: Routing to ' + item.place)} />
            </View>
          </Glass>
        )}
      />
    </View>
  );
};
