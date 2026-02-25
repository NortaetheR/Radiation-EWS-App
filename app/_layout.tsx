import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme } from '@/hooks/useColorScheme';


import React from 'react';
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PaperProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Layar Utama: Peta */}
        <Stack.Screen name="index" />
        
        {/* Layar Detail Alat (Akan kita buat setelah ini) */}
        <Stack.Screen 
          name="device/[id]" 
          options={{ 
            headerShown: true, 
            title: 'Detail Perangkat',
            headerBackTitle: 'Peta' 
          }} 
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </PaperProvider>
  );
}