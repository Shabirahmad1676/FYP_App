import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './_layout';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  interpolate,
  useSharedValue,
  withDelay
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    heading: "Billboards,\nReimagined",
    subtext: "Scan any billboard in Mardan to unlock exclusive offers",
    visual: 'scan-outline',
  },
  {
    id: '2',
    heading: "Never Miss\na Deal",
    subtext: "Get notified when your favourite brands have offers nearby",
    visual: 'notifications-outline',
  },
  {
    id: '3',
    heading: "Your City,\nYour Offers",
    subtext: "Save deals, track offers, redeem at the store",
    visual: 'wallet-outline',
  },
];

const AnimatedIcon = ({ name }: { name: any }) => {
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.1]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.8, 1]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.5]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.1, 0]),
  }));

  return (
    <View style={styles.iconCircle}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={name} size={80} color={Colors.white} />
      </Animated.View>
      <Animated.View style={[styles.glow, glowStyle]} />
    </View>
  );
};

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const { setHasSeenOnboarding } = useAuth();
  const router = useRouter();

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      pagerRef.current?.setPage(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setHasSeenOnboarding(true);
    router.replace('/location-access');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}
      >
        {SLIDES.map((slide, index) => (
          <View key={slide.id} style={styles.slide}>
            <View style={styles.visualContainer}>
              {index === 0 ? (
                <LottieView
                  source={require('@/assets/Scan.json')}
                  autoPlay
                  loop
                  style={{ width: 280, height: 280 }}
                />
              ) : (
                <AnimatedIcon name={slide.visual as any} />
              )}
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.heading}>{slide.heading}</Text>
              <Text style={styles.subtext}>{slide.subtext}</Text>
            </View>
          </View>
        ))}
      </PagerView>

      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                currentIndex === index && styles.activeIndicator,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.btn, currentIndex < SLIDES.length - 1 ? styles.nextBtn : styles.getStartedBtn]} 
          onPress={handleNext}
        >
          <Text style={currentIndex < SLIDES.length - 1 ? styles.nextBtnText : styles.getStartedBtnText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 30,
    zIndex: 10,
  },
  skipText: {
    color: '#6B6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  visualContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  textContainer: {
    width: '100%',
  },
  heading: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
    marginBottom: 20,
    lineHeight: 48,
  },
  subtext: {
    fontSize: 18,
    color: '#6B6B6B',
    lineHeight: 28,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  glow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 80,
    backgroundColor: '#FFF',
    opacity: 0.05,
  },
  footer: {
    padding: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 60,
  },
  indicatorContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  activeIndicator: {
    backgroundColor: '#FFF',
    width: 24,
  },
  btn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  nextBtn: {
    borderWidth: 1,
    borderColor: '#FFF',
  },
  getStartedBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 32,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  getStartedBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
