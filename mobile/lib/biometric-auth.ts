import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CREDENTIALS_KEY = 'user_credentials';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export interface StoredCredentials {
  email: string;
  password: string;
}

/**
 * Check if the device supports biometric authentication
 */
export async function isBiometricSupported(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }
  
  const compatible = await LocalAuthentication.hasHardwareAsync();
  return compatible;
}

/**
 * Check if biometrics are enrolled on the device
 */
export async function isBiometricEnrolled(): Promise<boolean> {
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Check if biometric authentication is enabled for this app
 */
export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return enabled === 'true';
}

/**
 * Get the available biometric types (Face ID, Touch ID, etc.)
 */
export async function getBiometricType(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Touch ID';
  } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }
  
  return 'Biometric';
}

/**
 * Authenticate using biometrics
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to login',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    
    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return false;
  }
}

/**
 * Store user credentials securely
 */
export async function storeCredentials(email: string, password: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const credentials: StoredCredentials = { email, password };
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials));
}

/**
 * Get stored credentials
 */
export async function getStoredCredentials(): Promise<StoredCredentials | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  const stored = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!stored) {
    return null;
  }
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear stored credentials
 */
export async function clearStoredCredentials(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

/**
 * Enable biometric authentication
 */
export async function enableBiometric(email: string, password: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await storeCredentials(email, password);
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
}

/**
 * Disable biometric authentication
 */
export async function disableBiometric(): Promise<void> {
  await clearStoredCredentials();
}

/**
 * Attempt to login with biometrics
 * Returns credentials if successful, null otherwise
 */
export async function loginWithBiometrics(): Promise<StoredCredentials | null> {
  const enabled = await isBiometricEnabled();
  if (!enabled) {
    return null;
  }
  
  const authenticated = await authenticateWithBiometrics();
  if (!authenticated) {
    return null;
  }
  
  return await getStoredCredentials();
}
