import { DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';
import { ThemeProvider as AppThemeProvider, useAppTheme } from '@/context/ThemeContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

const lightNavigationTheme = {
  ...NavLightTheme,
  colors: {
    ...NavLightTheme.colors,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    primary: Colors.light.tint,
    border: Colors.light.border,
  },
};

const darkNavigationTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    background: Colors.dark.background,
    card: Colors.dark.background,
    text: Colors.dark.text,
    primary: Colors.dark.tint,
    border: Colors.dark.border,
  },
};

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { effectiveTheme } = useAppTheme();

  if (loading) {
    return null;
  }

  const navigationTheme = effectiveTheme === 'dark' ? darkNavigationTheme : lightNavigationTheme;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        {!isAuthenticated ? (
          <Stack.Screen name="login" options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        )}
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </AuthProvider>
  );
}
