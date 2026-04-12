import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { logEvent } from '@/lib/analytics';

export default function QRScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission]);

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (scanned) return;
    setScanned(true);

    // Haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Validate UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data);
      
      if (!isUUID) {
        alert('Invalid Billboard QR Code format');
        setScanned(false);
        return;
      }

      // Lookup billboard by ID
      const { data: billboard, error } = await supabase
        .from('billboards')
        .select('id')
        .eq('id', data)
        .single();

      if (!error && billboard) {
        logEvent('scan', billboard.id, null);
        router.push(`/billboard/${billboard.id}`);
      } else {
        alert('Invalid Billboard QR Code');
        // Reset after 2 seconds
        setTimeout(() => setScanned(false), 2000);
      }
    } catch (err) {
      console.error('QR Scan Error:', err);
      setTimeout(() => setScanned(false), 2000);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission is required to scan QR codes.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Scan QR Code</Text>
        </View>

        <View style={styles.frameContainer}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        <View style={styles.bottomHint}>
          <Text style={styles.hintText}>Point at billboard QR code</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    height: 52,
    paddingHorizontal: 32,
    backgroundColor: Colors.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: Colors.black,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: Colors.white,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  bottomHint: {
    padding: 40,
    alignItems: 'center',
  },
  hintText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
