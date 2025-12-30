import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  isBiometricSupported,
  isBiometricEnrolled,
  isBiometricEnabled,
  getBiometricType,
  authenticateWithBiometrics,
  storeCredentials,
  getStoredCredentials,
  clearStoredCredentials,
  enableBiometric,
  disableBiometric,
  loginWithBiometrics,
} from '../biometric-auth';

jest.mock('expo-local-authentication');
jest.mock('expo-secure-store');
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

describe('biometric-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isBiometricSupported', () => {
    it('should return true when device supports biometrics', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      const result = await isBiometricSupported();
      expect(result).toBe(true);
    });

    it('should return false when device does not support biometrics', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
      const result = await isBiometricSupported();
      expect(result).toBe(false);
    });

    it('should return false on unsupported platforms', async () => {
      (Platform as any).OS = 'web';
      const result = await isBiometricSupported();
      expect(result).toBe(false);
    });
  });

  describe('isBiometricEnrolled', () => {
    it('should return true when biometrics are enrolled', async () => {
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
      const result = await isBiometricEnrolled();
      expect(result).toBe(true);
    });
  });

  describe('isBiometricEnabled', () => {
    it('should return true when biometric auth is enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
      const result = await isBiometricEnabled();
      expect(result).toBe(true);
    });

    it('should return false when biometric auth is not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const result = await isBiometricEnabled();
      expect(result).toBe(false);
    });
  });

  describe('getBiometricType', () => {
    it('should return Face ID for facial recognition', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ]);
      const result = await getBiometricType();
      expect(result).toBe('Face ID');
    });

    it('should return Touch ID for fingerprint', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      ]);
      const result = await getBiometricType();
      expect(result).toBe('Touch ID');
    });

    it('should return Biometric for unknown types', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([]);
      const result = await getBiometricType();
      expect(result).toBe('Biometric');
    });
  });

  describe('authenticateWithBiometrics', () => {
    it('should return true on successful authentication', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
      const result = await authenticateWithBiometrics();
      expect(result).toBe(true);
    });

    it('should return false on failed authentication', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });
      const result = await authenticateWithBiometrics();
      expect(result).toBe(false);
    });

    it('should return false on authentication error', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValue(new Error('Auth error'));
      const result = await authenticateWithBiometrics();
      expect(result).toBe(false);
    });
  });

  describe('storeCredentials', () => {
    it('should store credentials securely', async () => {
      await storeCredentials('test@example.com', 'password123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'user_credentials',
        JSON.stringify({ email: 'test@example.com', password: 'password123' })
      );
    });
  });

  describe('getStoredCredentials', () => {
    it('should retrieve stored credentials', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({ email: 'test@example.com', password: 'password123' })
      );
      const result = await getStoredCredentials();
      expect(result).toEqual({ email: 'test@example.com', password: 'password123' });
    });

    it('should return null when no credentials are stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const result = await getStoredCredentials();
      expect(result).toBeNull();
    });

    it('should return null on invalid JSON', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('invalid-json');
      const result = await getStoredCredentials();
      expect(result).toBeNull();
    });
  });

  describe('clearStoredCredentials', () => {
    it('should clear stored credentials and biometric flag', async () => {
      await clearStoredCredentials();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user_credentials');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_enabled');
    });
  });

  describe('enableBiometric', () => {
    it('should store credentials and enable biometric flag', async () => {
      await enableBiometric('test@example.com', 'password123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'user_credentials',
        JSON.stringify({ email: 'test@example.com', password: 'password123' })
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometric_enabled', 'true');
    });
  });

  describe('disableBiometric', () => {
    it('should clear credentials when disabling biometric', async () => {
      await disableBiometric();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user_credentials');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('biometric_enabled');
    });
  });

  describe('loginWithBiometrics', () => {
    it('should return credentials on successful authentication', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === 'biometric_enabled') return Promise.resolve('true');
        if (key === 'user_credentials')
          return Promise.resolve(JSON.stringify({ email: 'test@example.com', password: 'password123' }));
        return Promise.resolve(null);
      });
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

      const result = await loginWithBiometrics();
      expect(result).toEqual({ email: 'test@example.com', password: 'password123' });
    });

    it('should return null when biometric is not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const result = await loginWithBiometrics();
      expect(result).toBeNull();
    });

    it('should return null on failed authentication', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });

      const result = await loginWithBiometrics();
      expect(result).toBeNull();
    });
  });
});
