# Floating Dock Navigation

iOS-style floating dock navigation component with interactive animations and haptic feedback.

## Features

- **Floating Design**: Dock floats above content with rounded corners and blur effect
- **Interactive Animations**: Smooth spring animations on press with scale feedback
- **Haptic Feedback**: iOS haptic feedback on interaction (Light on press, Medium on selection)
- **Active State Indicator**: Circular background indicator for active tab
- **Theme Support**: Adapts to light/dark mode with proper blur and colors
- **Smooth Entrance**: Fade and slide-up animation when dock appears

## Usage

The floating dock is already configured in `app/(tabs)/_layout.tsx`:

```tsx
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
  }}
>
```

## Adding Bottom Padding to Screens

Since the dock floats above content, scrollable content needs bottom padding to ensure it's not hidden behind the dock.

### For FlatList or ScrollView:

Add `contentContainerStyle` with bottom padding:

```tsx
<FlatList
  data={data}
  contentContainerStyle={{ paddingBottom: 100 }}
  // ... other props
/>
```

### Using DockSafeArea Component:

Alternatively, wrap your content with the `DockSafeArea` component:

```tsx
import { DockSafeArea } from '@/components/dock-safe-area';

<ScrollView>
  <DockSafeArea>
    {/* Your content */}
  </DockSafeArea>
</ScrollView>
```

## Customization

### Adjusting Dock Appearance

Edit constants in `components/floating-dock.tsx`:

```tsx
const DOCK_HEIGHT = 70;           // Height of the dock
const ICON_SIZE = 28;              // Size of tab icons
const ICON_CONTAINER_SIZE = 56;    // Size of icon touch area
```

### Position

Change the bottom margin in the container style:

```tsx
container: {
  position: 'absolute',
  bottom: 20,  // Adjust this value
  // ...
}
```

### Blur Intensity

Adjust blur intensity for light/dark themes:

```tsx
<BlurView
  intensity={effectiveTheme === 'dark' ? 80 : 60}  // Adjust these values
  tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
  // ...
/>
```

## Animation Configuration

Spring animation config can be adjusted:

```tsx
const SPRING_CONFIG = {
  damping: 15,      // Higher = less bounce
  stiffness: 150,   // Higher = faster animation
  mass: 0.5,        // Higher = more inertia
};
```

## Dependencies

- `expo-blur`: Provides BlurView component
- `react-native-reanimated`: Powers all animations
- `expo-haptics`: iOS haptic feedback
- `@react-navigation/bottom-tabs`: Tab navigation structure
