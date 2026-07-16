import React from 'react';
import { SafeAreaView, StyleSheet, Alert } from 'react-native';
import { MomentsMap } from './MomentsMap';

/* Drop-in demo you can register as a screen to test the prototype.
   Two of the sample people (Nour & Omar) are placed a few metres apart
   so you can see the "Bump" spark fire immediately. */

const CAIRO = { latitude: 30.0444, longitude: 31.2357, latitudeDelta: 0.02, longitudeDelta: 0.02 };
const av = (s) => `https://api.dicebear.com/9.x/personas/png?seed=${s}&size=120`;
const pic = (s) => `https://picsum.photos/seed/${s}/120/120`;

const MOMENTS = [
  { id: 'me', name: 'You', avatar: av('you'), coords: { latitude: 30.0444, longitude: 31.2357 }, doing: '☕', thumb: pic('m-you'), fresh: true },
  { id: 'nour', name: 'Nour', avatar: av('nour'), coords: { latitude: 30.0459, longitude: 31.2361 }, doing: '⛰️', thumb: pic('m-nour'), fresh: true },
  { id: 'omar', name: 'Omar', avatar: av('omar'), coords: { latitude: 30.0461, longitude: 31.2364 }, doing: '🤿', thumb: pic('m-omar') }, // ~35m from Nour → bump
  { id: 'malak', name: 'Malak', avatar: av('malak'), coords: { latitude: 30.0502, longitude: 31.2401 }, doing: '🎧', thumb: pic('m-malak'), fresh: true },
  // three co-located → a "3 Moments" cluster
  { id: 'c1', name: 'Ziad', avatar: av('ziad'), coords: { latitude: 30.0408, longitude: 31.2299 }, thumb: pic('m-c1') },
  { id: 'c2', name: 'Farida', avatar: av('farida'), coords: { latitude: 30.0409, longitude: 31.2301 }, thumb: pic('m-c2') },
  { id: 'c3', name: 'Adam', avatar: av('adam'), coords: { latitude: 30.0407, longitude: 31.2298 }, thumb: pic('m-c3') },
];

export default function DemoScreen() {
  return (
    <SafeAreaView style={styles.fill}>
      <MomentsMap
        moments={MOMENTS}
        me={{ id: 'me' }}
        region={CAIRO}
        onOpenMoment={(m) =>
          Alert.alert('Open Moment', Array.isArray(m) ? `${m.length} Moments here` : `${m.name}'s Moment`)
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
