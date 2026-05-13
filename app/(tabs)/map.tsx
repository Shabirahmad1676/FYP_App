import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
  Alert,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { isARSupportedOnDevice } from '@reactvision/react-viro';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming 
} from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyBillboards } from '@/hooks/useNearbyBillboards';
import BillboardPin from '@/components/Map/BillboardPin';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import { sendLocalNotification } from '@/lib/notifications';
import { logEvent } from '@/lib/analytics';
import {
  fetchWalkingRoute,
  formatDistance,
  formatDuration,
  calculateRemainingRoute,
  hasArrived,
} from '@/lib/navigation';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

// ─── HUD pulse animation ───────────────────────────────────────────────────────
const usePulseAnim = () => {
  const pulse = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return pulse;
};

export default function MapScreen() {
  const router = useRouter();
  const { location } = useLocation();
  const [center, setCenter] = useState<[number, number]>([72.0404, 34.1989]);
  const { billboards, loading } = useNearbyBillboards(center[1], center[0], 50);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [selectedBillboard, setSelectedBillboard] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(true);
  const [searchRadius] = useState(5000);
  const [searchText, setSearchText] = useState('');
  const snapPoints = useMemo(() => ['25%', '50%'], []);
  const initialLock = useRef(false);
  const notifiedIds = useRef(new Set<string>());
  const lastHapticBillboardId = useRef<string | null>(null);

  // ── Navigation State ──────────────────────────────────────────────────────────
  const [navigationMode, setNavigationMode] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [remainingMeta, setRemainingMeta] = useState<{
    distance: string;
    duration: string;
    rawMeters: number;
  } | null>(null);
  const [nextStep, setNextStep] = useState<string>('');
  const [isNavigating, setIsNavigating] = useState(false); // loading state for directions
  const [checkingArLaunch, setCheckingArLaunch] = useState(false);
  const params = useLocalSearchParams<{ navigateId?: string }>();
  const [arrived, setArrived] = useState(false);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);
  const pulse = usePulseAnim();
  const [userTrackingMode, setUserTrackingMode] = useState<MapboxGL.UserTrackingMode | undefined>(undefined);

  // ── Filtered billboards (Moved Up for lint/usage) ─────────────────────────────
  const filteredBillboards = useMemo(() => {
    let result = billboards;
    if (selectedCategory) {
      result = result.filter(bb => {
        const campaign = bb.campaigns?.find((c: any) => c.is_active);
        const billboardCat = (bb.category || '').toLowerCase();
        const campaignCat = (campaign?.category || '').toLowerCase();
        const filterName = selectedCategory.toLowerCase();
        
        // Resilient matching across billboard or active campaign category
        return (billboardCat.includes(filterName) || filterName.includes(billboardCat)) ||
               (campaignCat.includes(filterName) || filterName.includes(campaignCat)) ||
               (filterName === 'electronics' && (billboardCat === 'tech' || campaignCat === 'tech'));
      });
    }
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      result = result.filter(bb => {
        const campaign = bb.campaigns?.find((c: any) => c.is_active);
        return (
          bb.title?.toLowerCase().includes(query) ||
          campaign?.title?.toLowerCase().includes(query) ||
          campaign?.business_name?.toLowerCase().includes(query)
        );
      });
    }
    return result;
  }, [billboards, selectedCategory, searchText]);

  // ── Billboards with distances (Performance optimized) ────────────────────────
  const billboardsWithDist = useMemo(() => {
    if (!location) return filteredBillboards.map(bb => ({ ...bb, distanceStr: undefined }));
    
    return filteredBillboards.map(bb => {
      const d = turf.distance(
        turf.point([location.coords.longitude, location.coords.latitude]),
        turf.point([bb.longitude, bb.latitude]),
        { units: 'kilometers' }
      );
      return { 
        ...bb, 
        distanceStr: d < 1 ? Math.round(d * 1000) + 'm' : d.toFixed(1) + 'km' 
      };
    });
  }, [filteredBillboards, location?.coords.latitude, location?.coords.longitude]);

  // ── User interests ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchInterests = async () => {
      try {
        setInterestsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('profiles')
          .select('interests')
          .eq('id', session.user.id)
          .single();
        if (data?.interests) setUserInterests(data.interests);
      } finally {
        setInterestsLoading(false);
      }
    };
    fetchInterests();
  }, []);

  // ── Auto-Navigate if navigateId param exists (Wait for location & data) ──
  useEffect(() => {
    if (params.navigateId && billboards.length > 0 && location) {
      const target = billboards.find(b => b.id === params.navigateId);
      if (target && !navigationMode) {
        setSelectedBillboard(target);
        // Delay slightly more to ensure Mapbox and GPS are fully synced
        setTimeout(() => {
          startNavigation(target);
          cameraRef.current?.setCamera({
            centerCoordinate: [target.longitude, target.latitude],
            zoomLevel: 15,
            animationDuration: 1000
          });
        }, 800);
      }
    }
  }, [params.navigateId, billboards, location]);

  // ── FIRST OPEN & SMART DISCOVERY ──────────────────────────────────────────────
  useEffect(() => {
    if (!location || billboardsWithDist.length === 0 || initialLock.current) return;

    const runDiscovery = async () => {
      initialLock.current = true;

      // 1. Initial Zoom to User
      cameraRef.current?.setCamera({
        centerCoordinate: [location.coords.longitude, location.coords.latitude],
        zoomLevel: 14.2,
        animationDuration: 2000,
      });

      // 2. Orientation (FollowWithHeading) for new users
      const hasOpened = await AsyncStorage.getItem('MAP_FIRST_OPEN');
      if (!hasOpened) {
        setUserTrackingMode(MapboxGL.UserTrackingMode.FollowWithHeading);
        cameraRef.current?.setCamera({
          zoomLevel: 15,
        });
        await AsyncStorage.setItem('MAP_FIRST_OPEN', 'true');
      }

      // 3. Smart Selection (Interest-Based OR Nearest)
      if (!params.navigateId && !selectedBillboard) {
        const interestMatched = billboardsWithDist.filter(bb => {
          const campaign = bb.campaigns?.find((c: any) => c.is_active);
          return userInterests.includes(campaign?.category || bb.category || '');
        });

        const target = interestMatched.length > 0 
          ? interestMatched[0] // Nearest interest match
          : billboardsWithDist[0]; // Absolutely nearest

        if (target) {
          setSelectedBillboard(target);
          bottomSheetRef.current?.expand();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    };

    runDiscovery();
  }, [location, billboardsWithDist, userInterests, params.navigateId]);

  // ── GOLDEN STATE: Proximity Auto-Selector ─────────────────────────────────────
  useEffect(() => {
    if (navigationMode || !location || billboardsWithDist.length === 0 || interestsLoading) return;

    // Only trigger if we aren't already looking at something or looking at something far away
    const currentDist = selectedBillboard 
      ? turf.distance(
          turf.point([location.coords.longitude, location.coords.latitude]),
          turf.point([selectedBillboard.longitude, selectedBillboard.latitude]),
          { units: 'kilometers' }
        )
      : 999;

    // Find nearest high-value billboard
    const highValueBillboards = billboardsWithDist.filter(bb => {
      const campaign = bb.campaigns?.find((c: any) => c.is_active);
      return userInterests.includes(campaign?.category || bb.category || '');
    });

    const nearestHighValue = highValueBillboards[0];

    // If a high-value billboard is within 500m (0.5km) AND it's not what we're currently looking at
    if (nearestHighValue && nearestHighValue.id !== selectedBillboard?.id && nearestHighValue.distanceStr?.includes('m')) {
      const dKm = turf.distance(
        turf.point([location.coords.longitude, location.coords.latitude]),
        turf.point([nearestHighValue.longitude, nearestHighValue.latitude]),
        { units: 'kilometers' }
      );

      if (dKm < 0.5 && dKm < currentDist) {
        setSelectedBillboard(nearestHighValue);
        bottomSheetRef.current?.expand();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        
        // Auto-toast proximity if foreground
        sendLocalNotification(
          "Interest Detected! 🎯", 
          `${nearestHighValue.campaigns?.[0]?.business_name || 'Billboard'} is just ${nearestHighValue.distanceStr} away!`
        );
      }
    }
  }, [location, billboardsWithDist, userInterests, navigationMode, interestsLoading]);

  // ── HAPTIC RADAR & PROXIMITY WATCH ──────────────────────────────────────────
  useEffect(() => {
    if (navigationMode || !location || billboardsWithDist.length === 0) return;

    // Check all nearby billboards for proximity alerts
    billboardsWithDist.forEach(bb => {
      const dKm = turf.distance(
        turf.point([location.coords.longitude, location.coords.latitude]),
        turf.point([bb.longitude, bb.latitude]),
        { units: 'kilometers' }
      );
      const dMeters = dKm * 1000;

      // Haptic Radar: Vibrate if entering 500m radius for the first time
      if (dMeters < 500 && lastHapticBillboardId.current !== bb.id) {
        lastHapticBillboardId.current = bb.id;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Proximity Notification: Alert if < 200m and not yet notified this session
      if (dMeters < 200 && !notifiedIds.current.has(bb.id)) {
        notifiedIds.current.add(bb.id);
        const name = bb.campaigns?.[0]?.business_name || 'Nearby Offer';
        sendLocalNotification(
          "Exclusive Deal Detected! 🎯", 
          `${name} is just ${Math.round(dMeters)}m away. Open the AR scanner to reveal it!`
        );
      }
    });
  }, [location, billboardsWithDist, navigationMode]);

  // ── Stop watching location on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      watchSubscription.current?.remove();
    };
  }, []);

  // ── Recalculate remaining distance in real time ───────────────────────────────
  const onLiveLocationUpdate = useCallback(
    (loc: Location.LocationObject) => {
      if (!routeInfo) return;
      const userCoords: [number, number] = [loc.coords.longitude, loc.coords.latitude];

      // Check arrival
      if (!arrived && hasArrived(userCoords, routeInfo.destinationCoords)) {
        setArrived(true);
        watchSubscription.current?.remove();
        watchSubscription.current = null;
        return;
      }

      // Update remaining route
      const { remainingDistance, remainingDuration } = calculateRemainingRoute(
        userCoords,
        routeInfo.geometry,
        routeInfo.distance,
        routeInfo.duration
      );

      setRemainingMeta({
        distance: formatDistance(remainingDistance),
        duration: formatDuration(remainingDuration),
        rawMeters: remainingDistance,
      });

      // Next step instruction (simplified: use first step whose distance > 10m)
      if (routeInfo.steps.length > 0) {
        const closestStep = routeInfo.steps.find((s: any) => s.distance > 10);
        if (closestStep) setNextStep(closestStep.maneuver.instruction);
      }
    },
    [routeInfo, arrived]
  );

  // ── Start real-time GPS watch when route exists ───────────────────────────────
  useEffect(() => {
    if (navigationMode && routeInfo) {
      watchSubscription.current?.remove();
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3, // update every 3 meters
        },
        onLiveLocationUpdate
      ).then(sub => {
        watchSubscription.current = sub;
      });
    } else {
      watchSubscription.current?.remove();
      watchSubscription.current = null;
    }
  }, [navigationMode, routeInfo]);

  // ── Filtered billboards ───────────────────────────────────────────────────────
  // (MOVED UP)

  // ── Billboards with distances (Performance optimized) ────────────────────────
  // (MOVED UP)

  // ── GeoJSON for clustering ────────────────────────────────────────────────────
  const billboardGeoJSON = useMemo(() => {
    return turf.featureCollection(
      billboardsWithDist.map(bb => turf.point([bb.longitude, bb.latitude], { ...bb }))
    );
  }, [billboardsWithDist]);

  // ── Search radius circle ──────────────────────────────────────────────────────
  const radiusCircle = useMemo(() => {
    if (!location) return null;
    const pt = turf.point([location.coords.longitude, location.coords.latitude]);
    return turf.buffer(pt, searchRadius, { units: 'meters' });
  }, [location, searchRadius]);

  // ── Pin press ──────────────────────────────────────────────────────────────────
  const handlePinPress = (billboard: any) => {
    if (navigationMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Fog of War: Check distance
    if (location) {
      const d = turf.distance(
        turf.point([location.coords.longitude, location.coords.latitude]),
        turf.point([billboard.longitude, billboard.latitude]),
        { units: 'kilometers' }
      );
      if (d > 10) {
        Alert.alert(
          'Travel Closer!',
          `This AR Zone is ${(d - 10).toFixed(1)}km outside your current action radius. Move closer to unlock secrets!`
        );
        return;
      }
    }

    setSelectedBillboard(billboard);
    bottomSheetRef.current?.expand();
    const activeCampaign = billboard.campaigns?.find((c: any) => c.is_active);
    logEvent('map_view', billboard.id, activeCampaign?.id || null, {
      latitude: billboard.latitude,
      longitude: billboard.longitude,
    });
  };

  const onClusterPress = (e: any) => {
    const feature = e.features[0];
    if (!feature.properties?.cluster) {
      handlePinPress(feature.properties);
    }
  };

  // ── Start navigation ──────────────────────────────────────────────────────────
  const startNavigation = async (billboard: any) => {
    if (!location) {
      Alert.alert('Location needed', 'Enable location to get directions.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsNavigating(true);
    try {
      const data = await fetchWalkingRoute(
        [location.coords.longitude, location.coords.latitude],
        [billboard.longitude, billboard.latitude]
      );

      if (data) {
        setRouteInfo(data);
        setRemainingMeta({
          distance: formatDistance(data.distance),
          duration: formatDuration(data.duration),
          rawMeters: data.distance,
        });
        if (data.steps.length > 0) {
          setNextStep(data.steps[0].maneuver.instruction);
        }
        setArrived(false);
        setNavigationMode(true);
        bottomSheetRef.current?.close();

        // Fly camera to route origin
        cameraRef.current?.flyTo(
          [location.coords.longitude, location.coords.latitude],
          800
        );
      } else {
        Alert.alert('No route found', 'Could not find a walking route to this location.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch directions. Check your connection.');
    } finally {
      setIsNavigating(false);
    }
  };

  const handleLaunchARScanner = async () => {
    if (checkingArLaunch) return;

    if (!selectedBillboard?.id) {
      Alert.alert('Select a Billboard', 'Choose a billboard on the map before opening AR scanner.');
      return;
    }

    setCheckingArLaunch(true);
    try {
      let billboardForAr = selectedBillboard;

      if (!billboardForAr?.image_target_url) {
        const { data: billboardData, error: billboardError } = await supabase
          .from('billboards')
          .select('id, image_target_url')
          .eq('id', selectedBillboard.id)
          .single();

        if (!billboardError && billboardData?.image_target_url) {
          billboardForAr = { ...selectedBillboard, image_target_url: billboardData.image_target_url };
          setSelectedBillboard((prev: any) =>
            prev?.id === billboardData.id
              ? { ...prev, image_target_url: billboardData.image_target_url }
              : prev
          );
        } else {
          Alert.alert('Missing AR Target', 'This billboard has no AR target image configured.');
          return;
        }
      }

      if (Platform.OS === 'web') {
        throw new Error('UNSUPPORTED');
      }

      const support = await isARSupportedOnDevice();
      if (support?.isARSupported) {
        router.push({
          pathname: '/ar-scanner',
          params: { id: billboardForAr.id },
        });
        return;
      }

      throw new Error('UNSUPPORTED');
    } catch {
      Alert.alert(
        'AR Not Supported',
        'Your device cannot run AR scanner. You can continue with QR scan.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use QR Scan', onPress: () => router.push('/qr-scan') },
        ]
      );
    } finally {
      setCheckingArLaunch(false);
    }
  };

  // ── Exit navigation ───────────────────────────────────────────────────────────
  const exitNavigation = () => {
    setNavigationMode(false);
    setRouteInfo(null);
    setRemainingMeta(null);
    setNextStep('');
    setArrived(false);
    watchSubscription.current?.remove();
    watchSubscription.current = null;
  };

  const activeCampaign = selectedBillboard?.campaigns?.find((c: any) => c.is_active);

  // ── Bearing icon helper ───────────────────────────────────────────────────────
  const getManeuverIcon = (type: string): any => {
    switch (type) {
      case 'turn': return 'arrow-forward';
      case 'depart': return 'walk';
      case 'arrive': return 'location';
      case 'roundabout': return 'refresh';
      default: return 'navigate';
    }
  };

  const nextManeuverType = routeInfo?.steps?.[0]?.maneuver?.type || 'depart';

  return (
    <View style={styles.container}>
      {/* ── MAP ── */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={navigationMode}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          followUserLocation={navigationMode || !!userTrackingMode}
          followUserMode={navigationMode ? MapboxGL.UserTrackingMode.FollowWithHeading : userTrackingMode}
          followPitch={navigationMode ? 60 : (userTrackingMode ? 45 : 0)}
          followZoomLevel={navigationMode ? 17.5 : undefined}
          animationDuration={1000}
        />

        {/* Search Radius Ring */}
        {radiusCircle && !navigationMode && (
          <MapboxGL.ShapeSource id="radiusSource" shape={radiusCircle as any}>
            <MapboxGL.FillLayer
              id="radiusFill"
              style={{ fillColor: 'rgba(0, 122, 255, 0.05)', fillOutlineColor: 'rgba(0, 122, 255, 0.3)' }}
            />
            <MapboxGL.LineLayer
              id="radiusLine"
              style={{ lineColor: 'rgba(0, 122, 255, 0.4)', lineWidth: 2, lineDasharray: [2, 2] }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* ── Route: outer casing (dark shadow line) + inner blue line ── */}
        {navigationMode && routeInfo && (
          <MapboxGL.ShapeSource
            id="routeSource"
            shape={{ type: 'Feature', properties: {}, geometry: routeInfo.geometry }}
          >
            {/* Outer dark casing for the "Google Maps" look */}
            <MapboxGL.LineLayer
              id="routeCasing"
              style={{
                lineColor: '#0050A8',
                lineWidth: 10,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 1,
              }}
              belowLayerID="routeLine"
            />
            {/* Main bright blue route */}
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#007AFF',
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 1,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Billboard clusters & layer */}
        <MapboxGL.ShapeSource
          id="billboardSource"
          cluster
          clusterRadius={50}
          shape={billboardGeoJSON}
          onPress={onClusterPress}
        >
          <MapboxGL.SymbolLayer
            id="clusterCount"
            style={{
              textField: ['get', 'point_count'],
              textSize: 12,
              textColor: Colors.white,
              textIgnorePlacement: true,
              textAllowOverlap: true,
            }}
          />
          <MapboxGL.CircleLayer
            id="clusters"
            belowLayerID="clusterCount"
            filter={['has', 'point_count']}
            style={{ circleColor: Colors.black, circleRadius: 18, circleStrokeWidth: 2, circleStrokeColor: Colors.white }}
          />
        </MapboxGL.ShapeSource>

        {/* Individual pin markers */}
        {!(loading || interestsLoading) &&
          filteredBillboards.map(bb => {
            const dist = location
              ? turf
                  .distance(
                    turf.point([location.coords.longitude, location.coords.latitude]),
                    turf.point([bb.longitude, bb.latitude]),
                    { units: 'kilometers' }
                  )
                  .toFixed(1) + 'km'
              : undefined;
            const campaign = bb.campaigns?.find((c: any) => c.is_active);
            const isHighValue = userInterests.includes(campaign?.category || bb.category || '');
            return (
              <MapboxGL.MarkerView key={bb.id} id={bb.id} coordinate={[bb.longitude, bb.latitude]}>
                <TouchableOpacity onPress={() => handlePinPress(bb)}>
                  <BillboardPin
                    expiryDate={campaign?.end_date}
                    distance={dist}
                    isSelected={selectedBillboard?.id === bb.id}
                    isHighValue={isHighValue}
                    imageUrl={campaign?.media_url || campaign?.business_logo_url}
                    title={campaign?.business_name || bb.title}
                  />
                </TouchableOpacity>
              </MapboxGL.MarkerView>
            );
          })}

        {/* ── GHOST PINS (Skeleton Loading State) ── */}
        {(loading || interestsLoading) && (
          <>
            {[
              { id: 'ghost1', coords: [72.0404, 34.1989] },
              { id: 'ghost2', coords: [72.0424, 34.2009] },
              { id: 'ghost3', coords: [72.0384, 34.1969] },
              { id: 'ghost4', coords: [72.0444, 34.1949] },
              { id: 'ghost5', coords: [72.0364, 34.2029] },
            ].map((ghost) => (
              <MapboxGL.MarkerView key={ghost.id} id={ghost.id} coordinate={ghost.coords as [number, number]}>
                <View style={styles.ghostWrapper}>
                  <Skeleton theme="dark" width={32} height={32} borderRadius={16} />
                </View>
              </MapboxGL.MarkerView>
            ))}
          </>
        )}

        {location && <MapboxGL.UserLocation animated visible />}
      </MapboxGL.MapView>

      {/* ── ARRIVED OVERLAY ── */}
      {arrived && (
        <View style={styles.arrivedOverlay}>
          <View style={styles.arrivedCard}>
            <Ionicons name="checkmark-circle" size={52} color="#00C851" />
            <Text style={styles.arrivedTitle}>You've Arrived!</Text>
            <Text style={styles.arrivedSub}>You're at your destination.</Text>
            
            <View style={styles.arrivedInstructions}>
              <Ionicons name="camera" size={24} color={Colors.primary} />
              <Text style={styles.arrivedHint}>
                Open the AR Scanner to claim your reward!
              </Text>
            </View>

            <TouchableOpacity style={styles.arrivedBtn} onPress={exitNavigation}>
              <Text style={styles.arrivedBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── NAVIGATION HUD ── */}
      {navigationMode && remainingMeta && !arrived && (
        <SafeAreaView style={styles.navHudWrapper} pointerEvents="box-none">
          {/* Step instruction banner */}
          {nextStep ? (
            <View style={styles.stepBanner}>
              <View style={styles.stepIconCircle}>
                <Ionicons name={getManeuverIcon(nextManeuverType)} size={20} color={Colors.white} />
              </View>
              <Text style={styles.stepText} numberOfLines={2}>
                {nextStep}
              </Text>
            </View>
          ) : null}

          {/* Main distance/time HUD card */}
          <View style={styles.navHudCard}>
            <View style={styles.navHudLeft}>
              <RNAnimated.View style={[styles.navIconCircle, { transform: [{ scale: pulse }] }]}>
                <Ionicons name="walk" size={22} color={Colors.white} />
              </RNAnimated.View>
              <View>
                <Text style={styles.navTime}>{remainingMeta.duration}</Text>
                <Text style={styles.navDist}>{remainingMeta.distance} remaining</Text>
              </View>
            </View>

            {/* Progress pill */}
            <View style={styles.navRight}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(
                        5,
                        ((routeInfo!.distance - remainingMeta.rawMeters) / routeInfo!.distance) * 100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <TouchableOpacity style={styles.exitBtn} onPress={exitNavigation}>
                <Ionicons name="close" size={16} color={Colors.black} />
                <Text style={styles.exitText}>Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* ── FLOATING HEADER ── */}
      <View style={[styles.headerWrapper, navigationMode && { opacity: 0, pointerEvents: 'none' }]}>
        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
            {/* Deal Count Badge */}
            {billboards.length > 0 && (
              <View style={styles.dealCountBadge}>
                <Ionicons name="flash" size={14} color="#FFD700" />
                <Text style={styles.dealCountText}>{billboards.length} Active Deals Near You</Text>
              </View>
            )}
            {['All', 'Food', 'Fashion', 'Tech', 'Retail', 'Health', 'Education'].map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip, 
                  (cat === 'All' ? !selectedCategory : selectedCategory === cat) && styles.activeChip
                ]}
                onPress={() => setSelectedCategory(cat === 'All' ? undefined : (selectedCategory === cat ? undefined : cat))}
              >
                <Text style={[
                  styles.chipText, 
                  (cat === 'All' ? !selectedCategory : selectedCategory === cat) && styles.activeChipText
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            placeholder="Search deals in Mardan..."
            placeholderTextColor={Colors.textSecondary}
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* ── SCAN FAB ── */}
      <TouchableOpacity
        style={[styles.scanFab, navigationMode && { bottom: -100 }]}
        onPress={() => router.push('/(tabs)/scan')}
      >
        <Ionicons name="scan" size={24} color={Colors.white} />
        <View style={styles.scanBadge} />
      </TouchableOpacity>

      {/* ── BOTTOM SHEET PREVIEW ── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          {selectedBillboard && (
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <Image 
                  source={activeCampaign?.media_url || activeCampaign?.business_logo_url} 
                  style={styles.previewThumbnail} 
                  contentFit="cover"
                  transition={200}
                />
                <View>
                  <Text style={styles.previewBusiness}>
                    {activeCampaign?.business_name || 'Billboard'}
                  </Text>
                  <Text style={styles.previewOffer}>
                    {activeCampaign?.title || 'Check offers at location'}
                  </Text>
                </View>
              </View>

              {/* Quick distance pill */}
              {location && (
                <View style={styles.distancePill}>
                  <Ionicons 
                    name={
                      (turf.distance(
                        turf.point([location.coords.longitude, location.coords.latitude]),
                        turf.point([selectedBillboard.longitude, selectedBillboard.latitude]),
                        { units: 'kilometers' }
                      ) * 1000) < 20 
                        ? "location" 
                        : "walk-outline"
                    } 
                    size={14} 
                    color="#007AFF" 
                  />
                  <Text style={styles.distancePillText}>
                    {formatDistance(
                      turf.distance(
                        turf.point([location.coords.longitude, location.coords.latitude]),
                        turf.point([selectedBillboard.longitude, selectedBillboard.latitude]),
                        { units: 'meters' }
                      )
                    )}{' '}
                    away
                  </Text>
                </View>
              )}

              <View style={styles.previewActions}>
                <Button
                  title="View Full Offer"
                  onPress={() => {
                    bottomSheetRef.current?.close();
                    router.push(`/billboard/${selectedBillboard.id}`);
                  }}
                  style={styles.actionBtn}
                />
                <Button
                  title="Launch AR Scanner"
                  variant="primary"
                  onPress={handleLaunchARScanner}
                  style={[styles.actionBtn, styles.arLaunchBtn]}
                  icon="camera"
                  loading={checkingArLaunch}
                  disabled={checkingArLaunch}
                />
                <Button
                  title={isNavigating ? 'Routing...' : 'Get Directions'}
                  variant="secondary"
                  onPress={() => startNavigation(selectedBillboard)}
                  style={styles.actionBtn}
                  loading={isNavigating}
                  disabled={isNavigating || !location}
                />
              </View>
              {!selectedBillboard.image_target_url && (
                <Text style={styles.arHintText}>
                  AR target image is not configured for this billboard yet.
                </Text>
              )}
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  map: { flex: 1 },

  // ── Navigation HUD ──────────────────────────────────────────────────────────
  navHudWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    gap: 8,
  },
  stepBanner: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    marginTop: 8,
  },
  stepIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  navHudCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  navHudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  navIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  navTime: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
  },
  navDist: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  navRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  progressBar: {
    width: 80,
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  exitBtn: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exitText: {
    color: Colors.black,
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Arrived overlay ──────────────────────────────────────────────────────────
  arrivedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  arrivedCard: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  arrivedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.black,
  },
  arrivedSub: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  arrivedInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 15,
  },
  arrivedHint: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  arrivedBtn: {
    backgroundColor: Colors.black,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  arrivedBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },

  // ── Floating header ──────────────────────────────────────────────────────────
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
  },
  categoriesContainer: { paddingVertical: 10 },
  categoriesContent: { paddingHorizontal: 20, gap: 10, alignItems: 'center' },
  dealCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  dealCountText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  categoryChip: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeChip: { backgroundColor: Colors.black },
  chipText: { fontSize: 14, fontWeight: '700', color: Colors.black },
  activeChipText: { color: Colors.white },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginTop: 5,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    gap: 12,
  },
  searchInput: { flex: 1, fontSize: 16, color: Colors.black, fontWeight: '600' },

  // ── Scan FAB ──────────────────────────────────────────────────────────────────
  scanFab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  scanBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00C851',
  },

  // ── Bottom Sheet ─────────────────────────────────────────────────────────────
  sheetBackground: { backgroundColor: Colors.white, borderRadius: 32 },
  sheetHandle: { backgroundColor: '#E5E5E5', width: 40 },
  sheetContent: { flex: 1, padding: 24 },
  previewContainer: { gap: 16 },
  previewHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16,
    marginBottom: 4 
  },
  previewThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  previewBusiness: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  previewOffer: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  distancePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  previewActions: { gap: 12 },
  actionBtn: { flex: 1 },
  arLaunchBtn: {
    backgroundColor: '#00C851',
    borderColor: '#00C851',
  },
  arHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  ghostWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
