import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    setScanned(true);
    
    Alert.alert(
      "Alat Terdeteksi!",
      `MAC Address: ${data}\n\nApakah Anda ingin mengikat (bind) alat ini ke aplikasi Anda?`,
      [
        {
          text: "Batal",
          style: "cancel",
          onPress: () => setScanned(false)
        },
        {
          text: "Ya, Simpan",
          onPress: async () => {
            try {
              await AsyncStorage.setItem('my_device_mac', data);
              Alert.alert("Tersimpan", "Alat berhasil diikat. Siap untuk koneksi Bluetooth!");
              router.back();
            } catch (e) {
              console.error("Gagal menyimpan alat", e);
            }
          }
        }
      ]
    );
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text>Meminta izin kamera...</Text>
      </View>
    );
  }
  
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>Aplikasi membutuhkan akses kamera untuk memindai QR Code Alat.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Berikan Izin Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { marginTop: 10, backgroundColor: '#666' }]} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />
      
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Pindai QR Alat</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.scanArea}>
          <View style={styles.scanFrame} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Arahkan kamera ke QR Code yang menempel pada bodi Alat GM Radiasi Anda.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  button: { backgroundColor: Colors.light.primary, padding: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold' },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'space-between' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.7)', paddingBottom: 15 },
  backButton: { width: 40 },
  headerText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  
  scanArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: Colors.light.primary, backgroundColor: 'transparent', borderRadius: 16 },
  
  footer: { backgroundColor: 'rgba(0,0,0,0.7)', padding: 30, alignItems: 'center' },
  footerText: { color: 'white', textAlign: 'center', fontSize: 14, lineHeight: 20 },
});