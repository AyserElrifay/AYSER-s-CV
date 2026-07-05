import React from 'react';
import { Text, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { Chip } from './Chip';

export const PosterCard = ({ item }) => (
  <ImageBackground
    source={{ uri: item.img }}
    style={{ width: 128, height: 184, marginRight: 12, justifyContent: 'space-between' }}
    imageStyle={{ borderRadius: 16 }}
  >
    <Chip label={item.tag} tint="rgba(18,18,20,0.75)" color="#CDB4FF" style={{ alignSelf: 'flex-start', margin: 8 }} />
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.92)']} style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 9, paddingTop: 30 }}>
      <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }} numberOfLines={1}>{item.title}</Text>
      <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 2 }}>{item.meta}</Text>
    </LinearGradient>
  </ImageBackground>
);
