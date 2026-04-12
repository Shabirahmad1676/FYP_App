import React, { useEffect, useState, createContext, useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { useGeoNotifications } from '@/hooks/useGeoNotifications';
import '@/lib/geofencing'; // Ensure the background task is defined globally
import MapboxGL from '@rnmapbox/maps';

// Initialize Mapbox globally
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
import Colors from '@/constants/colors';

// Prevent splash screen from hiding automatically
SplashScreen.preventAutoHideAsync();

// Simple Auth Context
const AuthContext = createContext<{
  session: Session | null;
  isLoading: boolean;
  hasSeenOnboarding: boolean | null;
  hasPermissionSeen: boolean | null;
  hasSelectedInterests: boolean | null;
  setHasSeenOnboarding: (value: boolean) => void;
  setHasPermissionSeen: (value: boolean) => void;
  setHasSelectedInterests: (value: boolean) => void;
}>({
  session: null,
  isLoading: true,
  hasSeenOnboarding: null,
  hasPermissionSeen: null,
  hasSelectedInterests: null,
  setHasSeenOnboarding: () => { },
  setHasPermissionSeen: () => { },
  setHasSelectedInterests: () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

function RootNavigator() {
  const { session, isLoading: isAuthLoading, hasSeenOnboarding, hasPermissionSeen, hasSelectedInterests } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Handle notification clicks
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const billboardId = response.notification.request.content.data.billboardId;
      if (billboardId) {
        router.push(`/billboard/${billboardId}`);
      }
    });

    return () => subscription.remove();
  }, [router]);

  // Auth Guard and Redirection Logic
  useEffect(() => {
    const isReady = !isAuthLoading && hasSeenOnboarding !== null && hasPermissionSeen !== null && hasSelectedInterests !== null;

    if (isReady) {
      SplashScreen.hideAsync();
    } else {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inLocation = segments[0] === 'location-access';
    const inInterests = segments[0] === 'interests';

    console.log('DEBUG: Navigation Guard Status:', {
      session: !!session,
      hasSeenOnboarding,
      hasPermissionSeen,
      hasSelectedInterests,
      currentSegment: segments[0],
      inInterests
    });

    if (!hasSeenOnboarding) {
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
    } else if (!hasPermissionSeen) {
      if (!inLocation) {
        router.replace('/location-access');
      }
    } else if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (!hasSelectedInterests) {
      if (!inInterests) {
        router.replace('/interests');
      }
    } else if (inAuthGroup || inOnboarding || inLocation || inInterests) {
      // Redirect to main app if all checks pass and we are in setup screens
      router.replace('/(tabs)');
    }
  }, [session, isAuthLoading, hasSeenOnboarding, hasPermissionSeen, hasSelectedInterests, segments]);

  if (isAuthLoading || hasSeenOnboarding === null || hasPermissionSeen === null || hasSelectedInterests === null) {
    // Android Optimization: Return a themed background instead of "null" to prevent white flashes
    return <View style={{ flex: 1, backgroundColor: Colors.black }} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="location-access" />
        <Stack.Screen name="interests" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ar-scanner" />
        <Stack.Screen name="qr-scan" />
        {/* billboard/[id] is automatically discovered from the filesystem */}
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // App initialization states
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [hasPermissionSeen, setHasPermissionSeen] = useState<boolean | null>(null);
  const [hasSelectedInterests, setHasSelectedInterests] = useState<boolean | null>(null);

  const { setupGeofencing } = useGeoNotifications();

  useEffect(() => {
    async function initializeApp() {
      try {
        // Parallelized Startup: Perform all checks at once
        const [sessionResponse, onboarding, permission, interests] = await Promise.all([
          supabase.auth.getSession(),
          AsyncStorage.getItem('hasSeenOnboarding'),
          AsyncStorage.getItem('hasPermissionSeen'),
          AsyncStorage.getItem('hasSelectedInterests'),
        ]);

        const currentSession = sessionResponse.data.session;
        setSession(currentSession);
        setHasSeenOnboarding(onboarding === 'true');
        setHasPermissionSeen(permission === 'true');
        setHasSelectedInterests(interests === 'true');

        if (currentSession) {
          setupGeofencing();
        }
      } catch (e) {
        console.error('Initialization error:', e);
        // Fallback for safety
        setHasSeenOnboarding(false);
        setHasPermissionSeen(false);
        setHasSelectedInterests(false);
      } finally {
        setIsLoading(false);
      }
    }

    initializeApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setupGeofencing();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={{
        session,
        isLoading,
        hasSeenOnboarding,
        hasPermissionSeen,
        hasSelectedInterests,
        setHasSeenOnboarding,
        setHasPermissionSeen,
        setHasSelectedInterests
      }}>
        <RootNavigator />
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}
