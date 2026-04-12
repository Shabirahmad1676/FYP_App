import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Colors from '@/constants/colors';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'error' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', style, textStyle }) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'success': return { backgroundColor: Colors.success };
      case 'error': return { backgroundColor: Colors.error };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border };
      default: return { backgroundColor: Colors.surface };
    }
  };

  const getTextColor = () => {
    if (variant === 'outline') return Colors.black;
    if (variant === 'default') return Colors.textSecondary;
    return Colors.white;
  };

  return (
    <View style={[styles.badge, getVariantStyle(), style]}>
      <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default Badge;
