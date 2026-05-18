import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ViroARSceneNavigator, ViroARTrackingTargets } from '@reactvision/react-viro';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device'; // Added for AR capability check
import Colors from '@/constants/colors';
import ARScene from '@/components/AR/ARScene';
import { supabase } from '@/lib/supabase';
import { useBillboard } from '@/hooks/useBillboard';
import { useNearbyBillboards } from '@/hooks/useNearbyBillboards';
import { useLocation } from '@/hooks/useLocation';
import ScannerOverlay from '@/components/AR/ScannerOverlay';
import * as Haptics from 'expo-haptics';
import { logEvent } from '@/lib/analytics';

export default function ARScanScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const isFocused = useIsFocused();
  
  const arMountedRef = useRef(false);
  const [arMounted, setArMounted] = React.useState(false);
  const [targetReady, setTargetReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isDeviceSupported, setIsDeviceSupported] = useState<boolean | null>(null);

  // 1. Data Layer & GPS Location Acquisition
  const { billboard, campaign, loading: dataLoading } = useBillboard(id ?? null);
  const { location } = useLocation();

  // Guard coordinates: Don't search at (0,0) if we don't have location yet in free-scan mode
  const currentLat = id ? 0 : (location?.coords.latitude ?? null);
  const currentLng = id ? 0 : (location?.coords.longitude ?? null);

  const { billboards: nearbyBillboards, loading: nearbyLoading } = useNearbyBillboards(
    id ? 0 : (currentLat ?? 0),
    id ? 0 : (currentLng ?? 0),
    10 // Increased range to find up to 10 local billboards
  );

  const [detectedNearbyBillboard, setDetectedNearbyBillboard] = useState<any>(null);
  const [isDetected, setIsDetected] = useState(false);
  const [scanStatus, setScanStatus] = useState<'searching' | 'detected' | 'timeout'>('searching');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [noLocalBillboardsFound, setNoLocalBillboardsFound] = useState(false);
  const [fallbackBillboards, setFallbackBillboards] = useState<any[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState('BOOTING');
  
  const detectedTargetRef = useRef<string | null>(null);
  const isDetectedRef = useRef(false);
  const initialScene = useRef({ scene: ARScene as any }).current;

  const resolveTargetUrl = (url?: string | null) => {
    if (!url) return null;
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  };

  const resolvePhysicalWidth = (width?: number | string | null) => {
    const parsed = typeof width === 'string' ? Number(width) : width;
    if (!parsed || !Number.isFinite(parsed)) {
      return 0.4;
    }
    // AR image tracking is more stable with realistic target widths.
    return Math.min(1.2, Math.max(0.1, parsed));
  };

  const hasTrackableTarget = (bb: any) => !!resolveTargetUrl(bb?.image_target_url);

  // AR Hardware & Performance Compatibility Check
  useEffect(() => {
    async function checkARSupport() {
      // Rule out Emulators/Simulators which break native AR tracking loops
      if (!Device.isDevice) {
        setIsDeviceSupported(false);
        return;
      }
      
      if (Platform.OS === 'android') {
        // Modern Android devices require ARCore capabilities
        setIsDeviceSupported(true); 
      } else {
        setIsDeviceSupported(true);
      }
    }
    checkARSupport();
  }, []);

  useEffect(() => {
    isDetectedRef.current = isDetected;
  }, [isDetected]);

  // Unified Lifecycle Management
  useEffect(() => {
    if (isFocused && !arMountedRef.current) {
      arMountedRef.current = true;
      setArMounted(true);
    }
    if (!isFocused && arMountedRef.current) {
      const t = setTimeout(() => {
        if (!arMountedRef.current) return;
        arMountedRef.current = false;
        setArMounted(false);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isFocused]);

  useEffect(() => {
    return () => {
      arMountedRef.current = false;
      setArMounted(false);
      setTargetReady(false);
    };
  }, []);

  // Searching timeout loop
  useEffect(() => {
    if (scanStatus !== 'searching' || !isFocused) return;
    const timer = setTimeout(() => {
      setScanStatus('timeout');
    }, 15000);
    return () => clearTimeout(timer);
  }, [scanStatus, isFocused, retryCount]);

  // Camera permissions hook
  useEffect(() => {
    const checkPermissions = async () => {
      if (Platform.OS === 'web') return;
      const { status } = await requestCameraPermission();
      if (status === 'granted') {
        setHasPermissions(true);
      }
      setInitializing(false);
    };
    checkPermissions();
  }, []);

  // Free scan fallback: if local geo query misses, load a small global target set.
  useEffect(() => {
    if (id || currentLat === null || currentLng === null || nearbyLoading) {
      return;
    }

    const localTrackable = nearbyBillboards.filter(hasTrackableTarget);
    if (localTrackable.length > 0) {
      setFallbackBillboards([]);
      return;
    }

    const loadFallbackTargets = async () => {
      try {
        setFallbackLoading(true);
        const { data, error } = await supabase
          .from('billboards')
          .select('id, image_target_url, physical_width, latitude, longitude, campaigns(*)')
          .not('image_target_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(8);

        if (error) {
          console.warn('[AR-FALLBACK] Failed to load fallback targets:', error.message);
          setFallbackBillboards([]);
          return;
        }

        setFallbackBillboards((data || []).filter(hasTrackableTarget));
      } finally {
        setFallbackLoading(false);
      }
    };

    loadFallbackTargets();
  }, [id, currentLat, currentLng, nearbyLoading, nearbyBillboards]);

  // MATCH & CONFIGURE TARGETS SYNCHRONOUSLY
  // useEffect(() => {
  //   if (id) {
  //     if (!billboard?.image_target_url) {
  //       setTargetReady(false);
  //       return;
  //     }
  //     const targetName = `target_${billboard.id}`;
  //     ViroARTrackingTargets.createTargets({
  //       [targetName]: {
  //         source: { uri: billboard.image_target_url },
  //         orientation: 'Up',
  //         physicalWidth: billboard.physical_width || 1,
  //       },
  //     });
  //     setTargetReady(true);
  //   } else {
  //     // In Free Scan mode, explicitly wait until location resolves and backend returns listings
  //     if (currentLat === null || currentLng === null || nearbyLoading) {
  //       setTargetReady(false);
  //       return;
  //     }

  //     if (nearbyBillboards && nearbyBillboards.length > 0) {
  //       const targets: Record<string, any> = {};
  //       let validTargetsCount = 0;

  //       nearbyBillboards.forEach((bb: any) => {
  //         if (bb.image_target_url) {
  //           targets[`target_${bb.id}`] = {
  //             source: { uri: bb.image_target_url },
  //             orientation: 'Up',
  //             physicalWidth: bb.physical_width || 1,
  //           };
  //           validTargetsCount++;
  //         }
  //       });

  //       if (validTargetsCount > 0) {
  //         ViroARTrackingTargets.createTargets(targets);
  //         console.log(`[Free-Scan Ready] Loaded ${validTargetsCount} targets.`);
  //         // console.log(`[Free-Scan Ready] Loaded ${validTargetsCount} localized targets into native memory.`);
  //         setTargetReady(true);
  //       } else {
  //         setTargetReady(true); // fall-through context if no images found
  //       }
  //     } else if (!nearbyLoading) {
  //       setTargetReady(true);
  //     }
  //   }
  // }, [id, billboard, nearbyBillboards, nearbyLoading, currentLat, currentLng]);

  useEffect(() => {
  if (id) {
    // ... Single billboard mode remains exactly the same
    if (!billboard) {
      setTargetReady(false);
      return;
    }

    const targetUrl = resolveTargetUrl(billboard.image_target_url);
    if (!targetUrl) {
      setTargetReady(false);
      return;
    }

    const targetName = `target_${billboard.id}`;
    ViroARTrackingTargets.createTargets({
      [targetName]: {
        source: { uri: targetUrl },
        orientation: 'Up',
        physicalWidth: resolvePhysicalWidth(billboard.physical_width as any),
      },
    });
    setTargetReady(true);
  } else {
    // FREE SCAN MODE
    console.log(`[GPS-DIAGNOSTIC] Your Phone's Current Location -> Lat: ${currentLat}, Lng: ${currentLng}`);
    if (currentLat === null || currentLng === null || nearbyLoading) {
      setTargetReady(false);
      return;
    }

    const sourceBillboards = nearbyBillboards.filter(hasTrackableTarget).length > 0
      ? nearbyBillboards
      : fallbackBillboards;

    if (sourceBillboards && sourceBillboards.length > 0) {
      const targets: Record<string, any> = {};
      let validTargetsCount = 0;

      sourceBillboards.forEach((bb: any) => {
        const targetUrl = resolveTargetUrl(bb.image_target_url);
        if (targetUrl) {
          targets[`target_${bb.id}`] = {
            source: { uri: targetUrl },
            orientation: 'Up',
            physicalWidth: resolvePhysicalWidth(bb.physical_width),
          };
          validTargetsCount++;
        }
      });

      if (validTargetsCount > 0) {
        ViroARTrackingTargets.createTargets(targets);
        const usingFallback = sourceBillboards === fallbackBillboards;
        console.log(
          `[Free-Scan Ready] Registered ${validTargetsCount} native targets${usingFallback ? ' (fallback mode)' : ''}.`
        );
        setNoLocalBillboardsFound(nearbyBillboards.length === 0);
        setTargetReady(true);
      } else {
        // Billboards exist nearby but they lack image target assets
        setNoLocalBillboardsFound(true);
        setTargetReady(true); 
      }
    } else if (!nearbyLoading && !fallbackLoading) {
      // API call completed but database returned absolutely zero rows [] near these coordinates
      console.log(`[DEBUG-DATA] useNearbyBillboards returned 0 rows at Lat: ${currentLat}, Lng: ${currentLng}`);
      setNoLocalBillboardsFound(true);
      setTargetReady(true); // Force target ready to break out of loading cycle
    }
  }
}, [id, billboard, nearbyBillboards, nearbyLoading, currentLat, currentLng, fallbackBillboards, fallbackLoading]);

  const handleDetected = useCallback((detectedId: string) => {
    const matches = id ? detectedId === id : true;
    if (matches) {
      if (detectedTargetRef.current === detectedId && isDetectedRef.current) {
        return;
      }
      detectedTargetRef.current = detectedId;
      setIsDetected(true);
      setScanStatus('detected');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (!id) {
        const mergedBillboards = [...nearbyBillboards, ...fallbackBillboards];
        const matched = mergedBillboards.find((bb: any) => bb.id === detectedId);
        if (matched) setDetectedNearbyBillboard(matched);
      }
      const activeCampaignId = id ? (campaign?.id ?? null) : null;
      logEvent('scan', detectedId, activeCampaignId);
    }
  }, [id, campaign, nearbyBillboards, fallbackBillboards]);

  const handleLost = useCallback(() => {
    detectedTargetRef.current = null;
    setIsDetected(false);
    setScanStatus('searching');
  }, []);

  const nearbyTargetIds = useMemo(() => {
    const merged = [...nearbyBillboards, ...fallbackBillboards];
    const ids = new Set(
      merged
        .filter(hasTrackableTarget)
        .map((bb: any) => `target_${bb.id}`)
    );
    return Array.from(ids);
  }, [nearbyBillboards, fallbackBillboards]);

  const viroAppProps = useMemo(() => ({
    targetId: id ? `target_${id}` : null,
    targetIds: !id ? nearbyTargetIds : null,
    onDetected: handleDetected,
    onLost: handleLost,
    onTrackingChange: setTrackingStatus,
    isPaused: isDetected,
  }), [handleDetected, handleLost, id, isDetected, nearbyTargetIds]);

  const retryScan = () => {
    setScanStatus('searching');
    setIsDetected(false);
    setDetectedNearbyBillboard(null);
    setRetryCount((count) => count + 1);
  };

  // UI Evaluation States
  if (isDeviceSupported === false) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>AR Feature Not Supported</Text>
        <Text style={styles.errorSubText}>Your physical device doesn't support augmented tracking architectures or is running an emulator.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Replace your existing checking guards with this unified block
const waitingForLocation = !id && currentLat === null;
// const waitingForTargets = !id && (!nearbyTargetIds || nearbyTargetIds.length === 0);
const waitingForTargets = !id && (!nearbyTargetIds || nearbyTargetIds.length === 0) && !noLocalBillboardsFound;

if (initializing || dataLoading || ((nearbyLoading || fallbackLoading) && !noLocalBillboardsFound) || waitingForLocation || waitingForTargets || !targetReady) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>
        {waitingForLocation 
          ? "Acquiring GPS Position..." 
          : "Syncing Regional Campaigns..."}
      </Text>
    </View>
  );
}

  if (!hasPermissions) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>Camera permission is required for AR.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {arMounted && (
        <ViroARSceneNavigator
          initialScene={initialScene}
          autofocus={true}
          videoQuality="High"
          viroAppProps={viroAppProps}
          style={styles.arView}
        />
      )}

      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>


        {/* Place this helper banner inside your main return container */}
{noLocalBillboardsFound && !isDetected && (
  <View style={{
    position: 'absolute',
    top: 100, left: 20, right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // Red indicator flag
    padding: 12, borderRadius: 8, zIndex: 100
  }}>
    <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center', fontSize: 13 }}>
      ⚠️ Sandbox Mode: 0 Billboards found near your current location. Check your database coordinates.
    </Text>
  </View>
)}

        {scanStatus === 'searching' && !isDetected && (
          <View style={styles.searchingContainer}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.instructionText}>Point camera at the billboard</Text>
          </View>
        )}

        <View style={styles.debugBadge}>
          <Text style={styles.debugText}>
            AR: {trackingStatus} | Targets: {id ? 1 : nearbyTargetIds.length}
          </Text>
        </View>

        {scanStatus === 'timeout' && !isDetected && (
          <View style={styles.timeoutContainer}>
            <Ionicons name="help-circle-outline" size={48} color={Colors.white} />
            <Text style={styles.timeoutTitle}>No Billboard Found?</Text>
            <Text style={styles.timeoutText}>Ensure you are facing a registered ad campaign and the screen is unobstructed.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={retryScan}>
              <Text style={styles.retryBtnText}>Retry Engine</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScannerOverlay 
           isDetected={isDetected}
           campaign={id ? campaign : (detectedNearbyBillboard?.campaigns?.find((c: any) => c.is_active) ?? null)}
           billboardId={id ?? (detectedNearbyBillboard?.id ?? null)}
           latitude={id ? billboard?.latitude : detectedNearbyBillboard?.latitude}
           longitude={id ? billboard?.longitude : detectedNearbyBillboard?.longitude}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  arView: { flex: 1 },
  safeArea: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  header: { padding: 20 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#fff', fontSize: 16, textAlign: 'center', paddingHorizontal: 40 },
  errorSubText: { color: '#c9ced6', fontSize: 14, textAlign: 'center', paddingHorizontal: 40, marginTop: 4 },
  backBtn: { marginTop: 20, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  searchingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  debugBadge: {
    position: 'absolute',
    top: 88,
    left: 12,
    right: 12,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  instructionText: {
    color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 24,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4,
  },
  scanFrame: { width: 280, height: 280, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#fff', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  timeoutContainer: {
    position: 'absolute', bottom: 100, left: 40, right: 40,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 24, padding: 24, alignItems: 'center', gap: 12,
  },
  timeoutTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  timeoutText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});