import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.branding}>BillboardAR</Text>
          <Text style={styles.title}>Welcome back</Text>
        </View>

        <View style={styles.form}>
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity 
            style={styles.forgotBtn} 
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button 
            title="Sign In" 
            onPress={handleSignIn} 
            loading={loading}
            style={styles.signInBtn}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Button 
            title="Create account" 
            onPress={() => router.push('/(auth)/register')}
            variant="secondary"
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
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
  },
  form: {
    width: '100%',
  },
  forgotBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  forgotText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  signInBtn: {
    marginBottom: 24,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
