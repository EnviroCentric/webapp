/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#2563eb';
const tintColorDark = '#3b82f6';

export const Colors = {
  light: {
    text: '#111827',        // gray-900
    background: '#ffffff',  // white
    tint: tintColorLight,   // blue-600
    icon: '#6b7280',        // gray-500
    tabIconDefault: '#6b7280',
    tabIconSelected: tintColorLight,
    card: '#f9fafb',        // gray-50
    border: '#e5e7eb',      // gray-200
  },
  dark: {
    text: '#e5e7eb',        // gray-200
    background: '#111827',  // gray-900
    tint: tintColorDark,    // blue-500
    icon: '#9ca3af',        // gray-400
    tabIconDefault: '#9ca3af',
    tabIconSelected: tintColorDark,
    card: '#1f2937',        // gray-800
    border: '#374151',      // gray-700
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
