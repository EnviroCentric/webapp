import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '@/context/ThemeContext';

const DOCK_HEIGHT = 70;
const ICON_SIZE = 28;
const ICON_CONTAINER_SIZE = 56;
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

interface FloatingDockItemProps {
  icon: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
  tintColor: string;
}

function FloatingDockItem({ icon, isActive, onPress, tintColor }: FloatingDockItemProps) {
  const scale = useSharedValue(1);
  const activeScale = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    activeScale.value = withSpring(isActive ? 1 : 0, SPRING_CONFIG);
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => {
    const scaleValue = interpolate(scale.value, [1, 0.9], [1, 0.9]);

    return {
      transform: [{ scale: scaleValue }],
    };
  });

  const activeIndicatorStyle = useAnimatedStyle(() => {
    const opacity = interpolate(activeScale.value, [0, 1], [0, 1]);
    const scaleValue = interpolate(activeScale.value, [0, 1], [0.8, 1]);

    return {
      opacity,
      transform: [{ scale: scaleValue }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.9, SPRING_CONFIG);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <PlatformPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={styles.itemContainer}
    >
      <Animated.View style={[styles.itemContent, animatedStyle]}>
        <Animated.View 
          style={[
            styles.activeIndicator, 
            activeIndicatorStyle,
            { backgroundColor: `${tintColor}20` } // 20 = ~12% opacity in hex
          ]} 
        />
        <View style={styles.iconContainer}>{icon}</View>
      </Animated.View>
    </PlatformPressable>
  );
}

export function FloatingDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const { effectiveTheme } = useAppTheme();
  const dockOpacity = useSharedValue(0);

  useEffect(() => {
    dockOpacity.value = withTiming(1, { duration: 300 });
  }, []);

  const animatedDockStyle = useAnimatedStyle(() => ({
    opacity: dockOpacity.value,
    transform: [
      {
        translateY: interpolate(dockOpacity.value, [0, 1], [20, 0]),
      },
    ],
  }));

  // Filter out routes with href: null and routes without icons
  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return options.href !== null && options.tabBarIcon !== undefined;
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dockContainer, animatedDockStyle]}>
        <BlurView
          intensity={effectiveTheme === 'dark' ? 80 : 60}
          tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          <View
            style={[
              styles.dock,
              {
                backgroundColor:
                  effectiveTheme === 'dark'
                    ? 'rgba(30, 30, 30, 0.7)'
                    : 'rgba(255, 255, 255, 0.7)',
                borderColor:
                  effectiveTheme === 'dark'
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
          >
            {visibleRoutes.map((route) => {
              const actualIndex = state.routes.findIndex((r) => r.key === route.key);
              const { options } = descriptors[route.key];
              const isFocused = state.index === actualIndex;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const iconColor = isFocused
                ? (options.tabBarActiveTintColor || (effectiveTheme === 'dark' ? '#0a84ff' : '#007aff'))
                : (options.tabBarInactiveTintColor || '#8e8e93');

              return (
                <FloatingDockItem
                  key={route.key}
                  icon={
                    options.tabBarIcon
                      ? options.tabBarIcon({
                          focused: isFocused,
                          color: iconColor,
                          size: ICON_SIZE,
                        })
                      : null
                  }
                  isActive={isFocused}
                  onPress={onPress}
                  tintColor={options.tabBarActiveTintColor || (effectiveTheme === 'dark' ? '#3b82f6' : '#2563eb')}
                />
              );
            })}
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 20,
    pointerEvents: 'box-none',
  },
  dockContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  blurContainer: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: DOCK_HEIGHT,
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 28,
    borderWidth: 1,
  },
  itemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ICON_CONTAINER_SIZE,
    height: ICON_CONTAINER_SIZE,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  activeIndicator: {
    position: 'absolute',
    width: ICON_CONTAINER_SIZE - 8,
    height: ICON_CONTAINER_SIZE - 8,
    borderRadius: (ICON_CONTAINER_SIZE - 8) / 2,
    // backgroundColor is set dynamically based on tint color
  },
});
