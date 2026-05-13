import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isARSupportedOnDevice } from '@reactvision/react-viro';
import Colors from '@/constants/colors';
import Card from '@/components/ui/Card';

export default function ScanScreen() {
  const router = useRouter();
  const [arSupported, setArSupported] = useState(false);
  const [checkingArSupport, setCheckingArSupport] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkArSupport = async () => {
      if (Platform.OS === 'web') {
        if (mounted) {
          setArSupported(false);
          setCheckingArSupport(false);
        }
        return;
      }

      try {
        const support = await isARSupportedOnDevice();
        if (mounted) {
          setArSupported(!!support?.isARSupported);
        }
      } catch {
        if (mounted) {
          setArSupported(false);
        }
      } finally {
        if (mounted) {
          setCheckingArSupport(false);
        }
      }
    };

    checkArSupport();

    return () => {
      mounted = false;
    };
  }, []);

  const handleARPress = () => {
    if (checkingArSupport) return;

    if (arSupported) {
      Alert.alert(
        'Select Billboard First',
        'Open Map, tap a billboard, then launch AR Scanner from the billboard preview.'
      );
      router.push('/(tabs)/map');
      return;
    }

    Alert.alert(
      'AR Not Supported',
      'This device does not support AR scanning. Use QR scan instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use QR Scan', onPress: () => router.push('/qr-scan') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.branding}>BillboardAR</Text>
          <Text style={styles.title}>Scan & Discover</Text>
          <Text style={styles.subtitle}>Choose your scanning method to unlock offers.</Text>
        </View>

        <View style={styles.options}>
          {/* AR Scan Card */}
          <TouchableOpacity
            onPress={handleARPress}
            disabled={!arSupported || checkingArSupport}
            activeOpacity={0.8}
          >
            <Card style={[styles.scanCard, styles.arCard, (!arSupported || checkingArSupport) && styles.disabledCard]}>
              <View style={styles.iconCircle}>
                <Ionicons name="cube-outline" size={40} color={Colors.white} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>Scan Billboard</Text>
                <Text style={styles.cardSubtitle}>
                  {checkingArSupport
                    ? 'Checking AR compatibility...'
                    : arSupported
                    ? "Point camera at any billboard"
                    : "AR Scanning not available on this device"}
                </Text>
              </View>
              {arSupported && !checkingArSupport && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>PREMIUM</Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>

          {/* QR Scan Card */}
          <TouchableOpacity
            onPress={() => router.push('/qr-scan')}
            activeOpacity={0.8}
          >
            <Card style={[styles.scanCard, styles.qrCard]}>
              <View style={[styles.iconCircle, styles.qrIconCircle]}>
                <Ionicons name="qr-code-outline" size={40} color={Colors.black} />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.cardTitle, styles.qrCardTitle]}>Scan QR Code</Text>
                <Text style={[styles.cardSubtitle, styles.qrCardSubtitle]}>
                  Quick access via billboard QR
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        <View style={styles.hintContainer}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.hintText}>
            For the best experience, ensure you have a stable data connection.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 48,
  },
  branding: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6B6B',
    lineHeight: 24,
  },
  options: {
    gap: 20,
  },
  scanCard: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    height: 140,
    borderWidth: 1,
  },
  arCard: {
    backgroundColor: '#000',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qrCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  disabledCard: {
    opacity: 0.5,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrIconCircle: {
    backgroundColor: Colors.surface,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
  },
  qrCardTitle: {
    color: Colors.black,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  qrCardSubtitle: {
    color: Colors.textSecondary,
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.black,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 48,
    paddingHorizontal: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
});
