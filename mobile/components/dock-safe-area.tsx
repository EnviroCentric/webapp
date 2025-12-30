import React from 'react';
import { View, StyleSheet } from 'react-native';

interface DockSafeAreaProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that adds bottom padding to account for the floating dock.
 * Use this for FlatList or ScrollView content containers.
 */
export function DockSafeArea({ children }: DockSafeAreaProps) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 100, // 70px dock height + 20px bottom margin + 10px extra spacing
  },
});
