/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#E31B23'; // Merah khas BRIN
const tintColorDark = '#E31B23';

export const Colors = {
  light: {
    text: '#1F2937', // Hitam keabuan agar elegan
    background: '#F8F9FA', // Abu-abu sangat terang
    surface: '#FFFFFF', // Putih bersih untuk Card
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    primary: '#E31B23', // Merah BRIN
    secondary: '#0056A6', // Biru Korporat
    success: '#10B981', // Hijau Aman
    warning: '#F59E0B', // Oranye Waspada
    danger: '#E31B23', // Merah Bahaya
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    surface: '#202425',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    primary: '#E31B23',
    secondary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
};
