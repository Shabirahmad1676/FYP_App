import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type SkeletonTheme = 'light' | 'dark';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
  theme?: SkeletonTheme;
}

/**
 * A high-end shimmering skeleton loader.
 * Uses React Native Reanimated and Expo Linear Gradient for 0-jank performance.
 * 
 * theme="light" → grey shimmer for white/light screens (default)
 * theme="dark"  → white shimmer for dark/map overlays
 */
const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  theme = 'light',
}) => {
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [-1, 1], [-(width as number), (width as number)]);
    return { transform: [{ translateX }] };
  });

  const bgColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#E8ECF0';
  const shimmerColors: [string, string, string] =
    theme === 'dark'
      ? ['transparent', 'rgba(255, 255, 255, 0.18)', 'transparent']
      : ['transparent', 'rgba(255, 255, 255, 0.7)', 'transparent'];

  return (
    <View
      style={[
        styles.container,
        { width: width as any, height: height as any, borderRadius, backgroundColor: bgColor },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={shimmerColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFill, animatedStyle]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
});

export default Skeleton;
