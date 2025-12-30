import { Link } from 'expo-router';
import { StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ModalScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ThemedText type="title">This is a modal</ThemedText>
        <Link href="/" dismissTo asChild>
          <TouchableOpacity style={styles.link}>
            <ThemedText type="link">Go to home screen</ThemedText>
          </TouchableOpacity>
        </Link>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
