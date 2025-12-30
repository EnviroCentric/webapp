import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemePreference, useAppTheme } from '@/context/ThemeContext';

const OPTIONS: { label: string; value: ThemePreference; description: string }[] = [
  {
    label: 'Use system setting',
    value: 'system',
    description: 'Match your device appearance',
  },
  {
    label: 'Light',
    value: 'light',
    description: 'Always use light mode',
  },
  {
    label: 'Dark',
    value: 'dark',
    description: 'Always use dark mode',
  },
];

export default function SettingsScreen() {
  const { preference, setPreference, effectiveTheme } = useAppTheme();
  const cardBackground = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  return (
    <ThemedView style={styles.container}>
      <View style={styles.contentWrapper}>
        <ThemedText type="title" style={styles.title}>
          Settings
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          Appearance
        </ThemedText>
        <ThemedText style={styles.description}>
          Choose how the app looks. By default it follows your system setting, just like the website.
        </ThemedText>

        <View style={styles.optionsContainer}>
          {OPTIONS.map((option) => {
            const isActive = preference === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPreference(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: cardBackground,
                    borderColor: isActive ? useThemeColor({}, 'tint') : borderColor,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}>
                <View style={styles.optionTextContainer}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={isActive ? styles.optionLabelActive : styles.optionLabel}>
                    {option.label}
                  </ThemedText>
                  <ThemedText style={styles.optionDescription}>{option.description}</ThemedText>
                </View>
                {isActive && (
                  <View style={styles.badge}>
                    <ThemedText type="defaultSemiBold" style={styles.badgeText}>
                      Active
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={styles.footerText}>
          Current theme: {effectiveTheme === 'dark' ? 'Dark' : 'Light'}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  contentWrapper: {
    flex: 1,
    gap: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginTop: 8,
  },
  description: {
    marginTop: 4,
  },
  optionsContainer: {
    marginTop: 16,
    gap: 12,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  optionLabel: {},
  optionLabelActive: {},
  optionDescription: {
    opacity: 0.8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
  },
  footerText: {
    marginTop: 'auto',
    opacity: 0.7,
  },
});