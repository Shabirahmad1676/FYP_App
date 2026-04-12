import React, { useState, useEffect, useRef } from 'react';
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
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import ARScene from '@/components/AR/ARScene';
import { useBillboard } from '@/hooks/useBillboard';
import ScannerOverlay from '@/components/AR/ScannerOverlay';
import * as Haptics from 'expo-haptics';

export default function ARScanScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isFocused = useIsFocused();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // 1. Data Layer: Hook for specific billboard
  const { billboard, campaign, loading: dataLoading, error: dataError } = useBillboard(id);

  // 2. State Layer: Source of Truth
  const [isDetected, setIsDetected] = useState(false);
  const [scanStatus, setScanStatus] = useState<'searching' | 'detected' | 'timeout'>('searching');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Timeout Logic: Show help after 15 seconds
  useEffect(() => {
    if (scanStatus === 'searching' && isFocused) {
      const timer = setTimeout(() => {
        setScanStatus('timeout');
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [scanStatus, isFocused]);

  // Permissions Check
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

  // Configure Viro Image Target
  useEffect(() => {
    if (billboard?.image_target_url) {
      const targetName = `target_${billboard.id}`;
      console.log('Registering Image Target:', targetName, billboard.image_target_url);
      
      ViroARTrackingTargets.createTargets({
        [targetName]: {
          source: { uri: billboard.image_target_url },
          orientation: 'Up',
          physicalWidth: billboard.physical_width || 1,
        },
      });
    }
  }, [billboard]);

  // Handlers for ARScene events
  const handleDetected = (detectedId: string) => {
    if (detectedId === id || !id) {
       setIsDetected(true);
       setScanStatus('detected');
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleLost = () => {
    setIsDetected(false);
    setScanStatus('searching');
  };

  const retryScan = () => {
    setScanStatus('searching');
  };

  if (initializing || dataLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading AR Assets...</Text>
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
      {isFocused && (
        <ViroARSceneNavigator
          initialScene={{
            scene: ARScene as any,
          }}
          viroAppProps={{ 
            targetId: id ? `target_${id}` : null,
            onDetected: handleDetected,
            onLost: handleLost
          }}
          style={styles.arView}
        />
      )}

      {/* Orchestrator Layout */}
      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>

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

        {scanStatus === 'timeout' && !isDetected && (
          <View style={styles.timeoutContainer}>
            <Ionicons name="help-circle-outline" size={48} color={Colors.white} />
            <Text style={styles.timeoutTitle}>Having trouble?</Text>
            <Text style={styles.timeoutText}>Ensure the billboard is well-lit and you are at a reasonable distance.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={retryScan}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pure UI Layer */}
        <ScannerOverlay 
           isDetected={isDetected}
           campaign={campaign}
           billboardId={id}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  arView: {
    flex: 1,
  },
  safeArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  header: {
    padding: 20,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  searchingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  timeoutContainer: {
    position: 'absolute',
    bottom: 100,
    left: 40,
    right: 40,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  timeoutTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  timeoutText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
