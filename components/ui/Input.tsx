import React, { useState } from 'react';
import { 
  StyleSheet, 
  TextInput, 
  TextInputProps, 
  View, 
  Text 
} from 'react-native';
import Colors from '@/constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, style, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor="#A0A0A0"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.black,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: Colors.black,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default Input;
