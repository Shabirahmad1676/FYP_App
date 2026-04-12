import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleReset = async () => {
    if (!email) return;
    setLoading(true);
    setStatus('idle');
    
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      setStatus('error');
      setMessage(error.message);
      setLoading(false);
    } else {
      setStatus('success');
      setMessage('Reset link sent to your email.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.branding}>BillboardAR</Text>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Enter your email to receive a password reset link.</Text>
        </View>

        <View style={styles.form}>
          <Input
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {status !== 'idle' && (
            <Text style={[styles.message, status === 'error' ? styles.errorText : styles.successText]}>
              {message}
            </Text>
          )}

          <Button 
            title="Send reset link" 
            onPress={handleReset} 
            loading={loading}
            style={styles.resetBtn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 80,
  },
  backBtn: {
    marginBottom: 40,
  },
  header: {
    marginBottom: 48,
  },
  branding: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 24,
    color: Colors.black,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  form: {
    width: '100%',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
  },
  successText: {
    color: Colors.success,
  },
  resetBtn: {
    marginTop: 12,
  },
});
