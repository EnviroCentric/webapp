import React, { useState, useEffect } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { 
  isBiometricSupported, 
  isBiometricEnrolled, 
  isBiometricEnabled,
  getBiometricType,
  enableBiometric,
  loginWithBiometrics 
} from '@/lib/biometric-auth';

export default function LoginScreen() {
  const { loginWithCredentials, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [enableBiometricAuth, setEnableBiometricAuth] = useState(false);
  const [biometricCurrentlyEnabled, setBiometricCurrentlyEnabled] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  useEffect(() => {
    const initBiometric = async () => {
      await checkBiometricSupport();
      await attemptBiometricLogin();
    };
    initBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkBiometricSupport = async () => {
    const supported = await isBiometricSupported();
    const enrolled = await isBiometricEnrolled();
    const enabled = await isBiometricEnabled();
    
    if (supported && enrolled) {
      setBiometricSupported(true);
      const type = await getBiometricType();
      setBiometricType(type);
      setBiometricCurrentlyEnabled(enabled);
    }
  };

  const attemptBiometricLogin = async () => {
    try {
      const credentials = await loginWithBiometrics();
      if (credentials) {
        await loginWithCredentials(credentials.email, credentials.password);
        router.replace('/(tabs)/projects/index');
      }
    } catch {
      // Biometric login failed or was cancelled, allow manual login
      console.log('Biometric login not available or failed');
    }
  };

  const handleBiometricLogin = async () => {
    setError(null);
    try {
      const credentials = await loginWithBiometrics();
      if (credentials) {
        await loginWithCredentials(credentials.email, credentials.password);
        router.replace('/(tabs)/projects/index');
      } else {
        setError('Biometric authentication failed');
      }
    } catch (e: any) {
      setError(e.message ?? 'Biometric login failed');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      await loginWithCredentials(email, password);
      
      // If user enabled biometric auth, save credentials
      if (enableBiometricAuth && biometricSupported) {
        await enableBiometric(email, password);
      }
      
      if (isAuthenticated) {
        router.replace('/(tabs)/projects/index');
      }
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={[styles.container, { backgroundColor }] }>
      <ThemedText type="title" style={styles.title}>
        Field Tech Login
      </ThemedText>
      
      {biometricCurrentlyEnabled && biometricSupported && (
        <TouchableOpacity 
          style={[styles.biometricButton, { backgroundColor: tintColor }]}
          onPress={handleBiometricLogin}
        >
          <Text style={styles.biometricButtonText}>Login with {biometricType}</Text>
        </TouchableOpacity>
      )}
      
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={iconColor}
        style={[
          styles.input,
          { borderColor, color: textColor, backgroundColor: cardBackground },
        ]}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor={iconColor}
        style={[
          styles.input,
          { borderColor, color: textColor, backgroundColor: cardBackground },
        ]}
      />
      
      {biometricSupported && !biometricCurrentlyEnabled && (
        <ThemedView style={styles.biometricToggle}>
          <ThemedText style={styles.biometricToggleText}>Enable {biometricType} login</ThemedText>
          <Switch
            value={enableBiometricAuth}
            onValueChange={setEnableBiometricAuth}
            trackColor={{ true: tintColor, false: borderColor }}
            thumbColor={tintColor}
          />
        </ThemedView>
      )}
      
      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: tintColor }]}
          onPress={handleSubmit}
        >
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>
      )}
    </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  biometricButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'center',
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  biometricToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  biometricToggleText: {
    fontSize: 16,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginTop: 16,
  },
  error: {
    color: 'red',
    marginBottom: 12,
    textAlign: 'center',
  },
});
