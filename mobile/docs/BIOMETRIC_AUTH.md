# iOS Face ID/Touch ID Authentication

This mobile app supports biometric authentication (Face ID on newer iPhones, Touch ID on older devices) for seamless and secure login.

## Features

- **Automatic Detection**: The app automatically detects if your device supports Face ID or Touch ID
- **Secure Storage**: Credentials are stored securely using Expo SecureStore (iOS Keychain)
- **Token-Based Auth**: Uses token-based authentication as per project standards
- **Fallback Support**: Users can fall back to device passcode if biometric auth fails
- **Optional**: Users can choose to enable or disable biometric login

## How It Works

### First-Time Setup

1. User enters their email and password
2. If the device supports biometrics and they're enrolled, a toggle appears: "Enable Face ID login" (or "Touch ID")
3. User enables the toggle and logs in
4. Credentials are securely stored in iOS Keychain via `expo-secure-store`

### Subsequent Logins

1. App launches and automatically prompts for Face ID/Touch ID
2. Upon successful authentication, credentials are retrieved and user is logged in
3. If biometric auth fails or is cancelled, user can manually enter credentials

### Disabling Biometric Auth

- When the user logs out, all stored credentials are automatically cleared
- User must re-enable biometric auth on their next login

## iOS Permissions

The following permission is configured in `app.json`:

```json
{
  "ios": {
    "infoPlist": {
      "NSFaceIDUsageDescription": "Allow $(PRODUCT_NAME) to use Face ID to authenticate and securely access your account."
    }
  }
}
```

This permission message is shown to users when they first attempt to use Face ID.

## API Reference

The biometric authentication utilities are located in `lib/biometric-auth.ts`:

### Functions

- `isBiometricSupported()` - Check if device supports biometric authentication
- `isBiometricEnrolled()` - Check if user has enrolled biometrics (Face ID/Touch ID set up)
- `isBiometricEnabled()` - Check if biometric auth is enabled for this app
- `getBiometricType()` - Returns "Face ID", "Touch ID", or "Biometric"
- `authenticateWithBiometrics()` - Prompt user for biometric authentication
- `enableBiometric(email, password)` - Enable biometric auth and store credentials
- `disableBiometric()` - Disable biometric auth and clear stored credentials
- `loginWithBiometrics()` - Authenticate with biometrics and return stored credentials

## Security Considerations

1. **Secure Storage**: Credentials are stored using `expo-secure-store`, which uses iOS Keychain - the most secure storage available on iOS
2. **Biometric Validation**: Authentication requires actual biometric validation by iOS, not just app-level checks
3. **Device-Specific**: Stored credentials are device-specific and cannot be transferred
4. **Automatic Cleanup**: Credentials are cleared on logout to prevent unauthorized access
5. **No Server-Side Changes**: The biometric flow uses the same backend authentication endpoints - biometrics only automate credential entry

## Testing

Run the test suite:

```bash
npm test lib/__tests__/biometric-auth.test.ts
```

The test suite covers:
- Device capability detection
- Biometric type identification
- Credential storage and retrieval
- Authentication flows
- Error handling

## Development Notes

- The integration works on both iOS and Android (though Android uses fingerprint/iris)
- On iOS Simulator, you can simulate Face ID via: `Features > Face ID > Enrolled`
- On iOS Simulator, trigger Face ID: `Features > Face ID > Matching Face`
- Biometric authentication requires a physical device or simulator with enrolled biometrics

## Troubleshooting

**Issue**: Face ID prompt doesn't appear
- Ensure Face ID is enrolled on the device (Settings > Face ID & Passcode)
- Check that the app has permission (Settings > [App Name])
- Verify `NSFaceIDUsageDescription` is in `app.json`

**Issue**: Credentials not persisting
- Ensure `expo-secure-store` is properly installed
- Check that the device supports SecureStore (iOS Keychain)
- Verify no errors in console during credential storage

**Issue**: "Biometric authentication failed" error
- User may have cancelled the Face ID prompt
- Face ID may not have recognized the user
- User can retry or use manual login as fallback
