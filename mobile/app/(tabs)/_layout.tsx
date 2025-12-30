import { Tabs, Redirect } from 'expo-router';
import React from 'react';

import { FloatingDock } from '@/components/floating-dock';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

export default function TabLayout() {
  const { effectiveTheme } = useAppTheme();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    // If the user is not authenticated, always send them to the login screen.
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <FloatingDock {...props} />}
      screenOptions={{
        tabBarActiveTintColor: Colors[effectiveTheme].tint,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}>
      <Tabs.Screen
        name="projects/index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape" color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects/[projectId]/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="projects/[projectId]/addresses/[addressId]/samples"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
