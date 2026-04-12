import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, isToday, parseISO } from 'date-fns';
import Colors from '@/constants/colors';

interface BillboardPinProps {
  expiryDate?: string;
  distance?: string;
  isSelected?: boolean;
  isHighValue?: boolean;
  imageUrl?: string;
  title?: string;
}

const BillboardPin: React.FC<BillboardPinProps> = ({ expiryDate, distance, isSelected, isHighValue, imageUrl, title }) => {
  const scale = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  
  // Secondary pulse for "breathing" effect on high value
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity2 = useSharedValue(0);

  useEffect(() => {
    // Entrance animation
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });

    // Primary Pulse
    pulseScale.value = withRepeat(
      withTiming(isSelected ? 3 : 2.2, { duration: 2500 }),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withTiming(0, { duration: 2500 }),
      -1,
      false
    );

    // High Value "Breathing" Glow
    if (isHighValue) {
      pulseScale2.value = withRepeat(
        withTiming(1.8, { duration: 1800 }),
        -1,
        true
      );
      pulseOpacity2.value = withRepeat(
        withTiming(0.5, { duration: 1800 }),
        -1,
        true
      );
    }
  }, [isHighValue, isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const pulseStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale2.value }],
    opacity: pulseOpacity2.value,
    display: isHighValue ? 'flex' : 'none',
  }));

  const getPinColor = () => {
    if (isHighValue) return '#FFD700'; // Gold
    if (!expiryDate) return Colors.black;
    const date = parseISO(expiryDate);
    if (isToday(date)) return Colors.error;
    if (differenceInDays(date, new Date()) <= 7) return '#FFBF00'; // Amber
    return Colors.black;
  };

  const pinColor = getPinColor();

  return (
    <View style={styles.container}>
      {/* Primary Ripple */}
      <Animated.View style={[styles.pulse, pulseStyle, { backgroundColor: pinColor }]} />
      
      {/* High Value Breathing Glow */}
      <Animated.View style={[styles.pulse, pulseStyle2, { backgroundColor: '#FFD700', borderRadius: 20 }]} />

      {/* Distance Label */}
      {distance && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{distance}</Text>
        </View>
      )}

      {/* Mini Callout (Title) */}
      {isSelected && title && (
        <View style={styles.calloutContainer}>
          <Text style={styles.calloutText} numberOfLines={1}>{title}</Text>
        </View>
      )}

      {/* Core Pin */}
      <Animated.View style={[
        styles.pin, 
        animatedStyle, 
        { borderColor: pinColor },
        isSelected && styles.selectedPin,
        isHighValue && styles.highValuePin
      ]}>
        {imageUrl ? (
          <Image 
            source={imageUrl} 
            style={styles.pinImage} 
            contentFit="cover"
            transition={300}
          />
        ) : (
          <Ionicons 
            name={isHighValue ? "star" : "business"} 
            size={isHighValue ? 16 : 14} 
            color={isHighValue ? Colors.black : Colors.white} 
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.black,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 2,
    overflow: 'hidden',
  },
  pinImage: {
    width: '100%',
    height: '100%',
  },
  pulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    zIndex: 1,
  },
  glow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.4)',
    zIndex: 0,
  },
  labelContainer: {
    position: 'absolute',
    top: -25,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 3,
  },
  labelText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  selectedPin: {
    transform: [{ scale: 1.2 }],
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  highValuePin: {
    borderColor: '#FFF',
    borderWidth: 2,
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  calloutContainer: {
    position: 'absolute',
    bottom: -35,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  calloutText: {
    color: Colors.black,
    fontSize: 11,
    fontWeight: '800',
  },
});

export default React.memo(BillboardPin);
