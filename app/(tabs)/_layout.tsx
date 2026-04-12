import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { Platform, StyleSheet, View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.black,
        tabBarInactiveTintColor: '#A0A0A0',
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 88 : 80,
          paddingTop: 12,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
          marginBottom: Platform.OS === 'ios' ? 0 : 40,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.scanIconContainer}>
              <Ionicons name="scan" size={26} color={Colors.white} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scanIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : 4,
  },
});
