import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './_layout';
import Colors from '@/constants/colors';
import Button from '@/components/ui/Button';

const { width } = Dimensions.get('window');

export default function LocationAccessScreen() {
  const { setHasPermissionSeen } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Foreground, 2: Background

  const handleComplete = async () => {
    await AsyncStorage.setItem('hasPermissionSeen', 'true');
    setHasPermissionSeen(true);
    router.replace('/(auth)/login');
  };

  const requestForeground = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          setStep(2);
        } else {
          handleComplete();
        }
      } else {
        Alert.alert(
          'Permission Required',
          'We need your location to show you billboards in Mardan. You can enable this later in settings.',
          [{ text: 'OK', onPress: () => handleComplete() }]
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const requestBackground = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications Limited',
          'Without "Always Allow," we won\'t be able to alert you of deals when the app is closed.',
          [{ text: 'I Understand', onPress: () => handleComplete() }]
        );
      } else {
        handleComplete();
      }
    } catch (err) {
      console.error(err);
      handleComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.visualContainer}>
          <LottieView
            source={require('@/assets/Scan.json')} // Re-using the scanning Lottie for radar effect
            autoPlay
            loop
            style={styles.lottie}
          />
          <View style={styles.iconOverlay}>
            <Ionicons 
              name={step === 1 ? "location" : "notifications"} 
              size={60} 
              color={Colors.white} 
            />
          </View>
        </View>

        <View style={styles.textSection}>
          <Text style={styles.title}>
            {step === 1 ? "Unlock Your City" : "Stay in the Loop"}
          </Text>
          <Text style={styles.description}>
            {step === 1 
              ? "Allow location access to discover premium billboards and hidden offers right where you are in Mardan."
              : "To receive alerts for 50% off deals while you're walking, please select 'Allow all the time' in the next prompt."
            }
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Real-time distance tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Smart proximity notifications</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Verified local business offers</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title={step === 1 ? "Enable Location" : "Enable Background Alerts"}
            onPress={step === 1 ? requestForeground : requestBackground}
            loading={loading}
            style={styles.primaryBtn}
          />
          <TouchableOpacity 
            onPress={handleComplete}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Maybe Later</Text>
          </TouchableOpacity>
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
    padding: 32,
    justifyContent: 'space-between',
  },
  visualContainer: {
    height: width * 0.7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  lottie: {
    width: width * 0.9,
    height: width * 0.9,
    opacity: 0.6,
  },
  iconOverlay: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  textSection: {
    gap: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: '#A0A0A0',
    lineHeight: 24,
  },
  featureList: {
    marginTop: 12,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  featureText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  footer: {
    gap: 20,
    paddingBottom: 20,
  },
  primaryBtn: {
    height: 60,
    borderRadius: 16,
  },
  skipBtn: {
    alignItems: 'center',
  },
  skipText: {
    color: '#6B6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
});
