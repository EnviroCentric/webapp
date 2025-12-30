# Face ID/Touch ID Setup Guide

## Overview

Face ID/Touch ID authentication has been integrated into the mobile app. Users can now login using biometric authentication instead of entering their credentials every time.

## What Was Added

### 1. Dependencies
- `expo-local-authentication` - Handles Face ID/Touch ID authentication
- `expo-secure-store` - Securely stores credentials in iOS Keychain

### 2. New Files
- `lib/biometric-auth.ts` - Core biometric authentication utilities
- `lib/__tests__/biometric-auth.test.ts` - Test suite
- `docs/BIOMETRIC_AUTH.md` - Complete documentation

### 3. Modified Files
- `app/login.tsx` - Updated login screen with biometric support
- `context/AuthContext.tsx` - Added biometric credential clearing on logout
- `app.json` - Added iOS Face ID permission
- `package.json` - Added new dependencies

## Testing on iOS

### Using iOS Simulator

1. Start the app:
   ```bash
   npm run ios
   ```

2. Enable Face ID in simulator:
   - Go to: `Features > Face ID > Enrolled`

3. Test the login flow:
   - Enter email and password
   - Toggle "Enable Face ID login"
   - Login
   - Close and reopen the app
   - You should be prompted for Face ID

4. Simulate Face ID authentication:
   - `Features > Face ID > Matching Face` (success)
   - `Features > Face ID > Non-matching Face` (failure)

### Using Physical iOS Device

1. Ensure Face ID is set up on the device
2. Build and run on your device:
   ```bash
   npx expo run:ios --device
   ```

3. The first time you attempt to use Face ID, iOS will prompt for permission
4. Accept the permission and test the login flow

## User Flow

### First Login
1. User enters email and password
2. If device supports Face ID/Touch ID, a toggle appears: "Enable Face ID login"
3. User enables the toggle and logs in
4. Credentials are securely stored

### Subsequent Logins
1. App automatically prompts for Face ID/Touch ID
2. Upon success, user is logged in automatically
3. If biometric fails, user can manually enter credentials

### Logout
- Stored credentials are automatically cleared
- User must re-enable biometric auth on next login

## Security Notes

- Credentials are stored in iOS Keychain via `expo-secure-store`
- Biometric authentication is handled by iOS, not the app
- Credentials are device-specific and can't be transferred
- Same backend authentication is used (token-based)

## Configuration

The Face ID permission message can be customized in `app.json`:

```json
{
  "ios": {
    "infoPlist": {
      "NSFaceIDUsageDescription": "Your custom message here"
    }
  }
}
```

## Troubleshooting

**Face ID doesn't work in simulator:**
- Ensure you've enabled Face ID: `Features > Face ID > Enrolled`

**Permission denied error:**
- Check that `NSFaceIDUsageDescription` is in `app.json`
- Rebuild the app after adding the permission

**Credentials not persisting:**
- Verify `expo-secure-store` is installed
- Check device logs for SecureStore errors

## Testing

Run the test suite:
```bash
npm test lib/__tests__/biometric-auth.test.ts
```

## Next Steps

- The implementation works for both iOS (Face ID/Touch ID) and Android (fingerprint)
- Consider adding a settings screen where users can disable biometric auth
- Consider adding re-authentication for sensitive actions
- Monitor user adoption and feedback

## Resources

- [Expo Local Authentication Docs](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [Expo Secure Store Docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
- Full documentation: `docs/BIOMETRIC_AUTH.md`
