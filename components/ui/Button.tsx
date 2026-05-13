import React from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  disabled?: boolean;
  icon?: React.ReactNode | string;
}

const Button: React.FC<ButtonProps> = ({ 
  title, 
  onPress, 
  loading, 
  variant = 'primary', 
  style, 
  textStyle,
  disabled,
  icon
}) => {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity 
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        style as any
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading || disabled}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? Colors.white : Colors.black} />
      ) : (
        <View style={styles.content}>
          {icon && (
            <View style={styles.iconContainer}>
              {typeof icon === 'string' ? (
                <Ionicons 
                  name={icon as any} 
                  size={20} 
                  color={isPrimary ? Colors.white : Colors.black} 
                />
              ) : (
                icon
              )}
            </View>
          )}
          <Text style={[
            styles.text,
            isPrimary ? styles.primaryText : styles.secondaryText,
            textStyle
          ]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  primary: {
    backgroundColor: Colors.black,
  },
  secondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.black,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryText: {
    color: Colors.white,
  },
  secondaryText: {
    color: Colors.black,
  },
});

export default Button;
