import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { 
  StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, 
  FlatList, Dimensions, StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

// PERUBAHAN: Import Layout Animations untuk efek Stagger List View & Tabir Loading
import Animated, { 
  useSharedValue, useAnimatedStyle, interpolate, 
  Extrapolation, withTiming, runOnJS,
  FadeIn, FadeOut, FadeInDown, FadeOutDown
} from 'react-native-reanimated';

import { MapView, Camera, MarkerView } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { DeviceData } from '@/constants/RadiationDevices';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import init from 'react_native_mqtt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

init({ size: 10000, storageBackend: AsyncStorage, defaultExpires: 1000 * 3600 * 24, enableCache: true, sync: {} });

const PulseMarker = ({ device, onPress }: { device: DeviceData, onPress: () => void }) => {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.8);

  useEffect(() => {
    pulseScale.value = 1;
    pulseOpacity.value = 0.8;
    pulseScale.value = withTiming(2.5, { duration: 1000 });
    pulseOpacity.value = withTiming(0, { duration: 1000 });
  }, [device.time]);

  const animatedAura = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const color = device.ews_level === 2 ? Colors.light.danger : 
                device.ews_level === 1 ? Colors.light.warning : Colors.light.success;

  return (
    <MarkerView id={device.device_mac} coordinate={[device.longitude, device.latitude]}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.markerContainer}>
        <Animated.View style={[styles.pulseAura, { backgroundColor: color }, animatedAura]} />
        <View style={[styles.markerCore, { backgroundColor: color }]}>
          <Text style={styles.markerText}>{(device.msv || 0).toFixed(1)}</Text>
        </View>
      </TouchableOpacity>
    </MarkerView>
  );
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  
  // STATE INISIALISASI PETA
  const [mapInit, setMapInit] = useState<{ center: number[], bounds?: any } | null>(null);
  
  // STATE TABIR LOADING (Map Booting)
  const [isMapReady, setIsMapReady] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const bootOpacity = useSharedValue(1);

  const [location, setLocation] = useState<number[] | null>(null);
  const [liveDevices, setLiveDevices] = useState<DeviceData[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceData | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [wssStatus, setWssStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [chartData, setChartData] = useState<number[]>(Array(30).fill(0));

  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  const snapPoints = useMemo(() => [ 310 + insets.bottom, 450 + insets.bottom], [insets.bottom]); 
  const MAPTILER_STYLE = `https://api.maptiler.com/maps/dataviz-v4/style.json?key=${process.env.EXPO_PUBLIC_MAPTILER_KEY}`;

  const animatedIndex = useSharedValue(-1); 

  const chartAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(animatedIndex.value, [0, 1], [0, 140], Extrapolation.CLAMP);
    const opacity = interpolate(animatedIndex.value, [0, 0.5, 1], [0, 0.5, 1], Extrapolation.CLAMP);
    return { height, opacity };
  });

  const navBarAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(animatedIndex.value, [-1, 0, 1], [0, 150, 150], Extrapolation.CLAMP);
    return { transform: [{ translateY }] };
  });

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setLocation([loc.coords.longitude, loc.coords.latitude]);
      }
    })();

    fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/v1/telemetry/locations`)
      .then(res => res.json())
      .then(result => {
        if (result.data?.length > 0) {
          setLiveDevices(result.data);
          const validDevices = result.data.filter((d: DeviceData) => d.latitude && d.longitude);
          if (validDevices.length > 0) {
            const lons = validDevices.map((d: DeviceData) => d.longitude);
            const lats = validDevices.map((d: DeviceData) => d.latitude);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            if (minLon === maxLon && minLat === maxLat) {
              setMapInit({ center: [minLon, minLat] });
            } else {
              setMapInit({
                 center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
                 bounds: { ne: [maxLon, maxLat], sw: [minLon, minLat] }
              });
            }
          } else setMapInit({ center: [106.8166, -6.2000] });
        } else setMapInit({ center: [106.8166, -6.2000] });
      }).catch(() => setMapInit({ center: [106.8166, -6.2000] }));

    const client = new Paho.MQTT.Client(`${process.env.EXPO_PUBLIC_WSS_URL}`, 443, `mob_${Math.random().toString(16).substr(2, 5)}`);
    client.onMessageArrived = (msg: any) => {
      try {
        const payload = JSON.parse(msg.payloadString);
        setLiveDevices(prev => {
          const idx = prev.findIndex(d => d.device_mac === payload.device_mac);
          const newList = [...prev];
          const updated = { ...payload, time: new Date().toISOString() };
          if (idx >= 0) newList[idx] = { ...newList[idx], ...updated };
          else newList.push(updated);
          return newList;
        });

        setSelectedDevice(prev => {
          if (prev?.device_mac === payload.device_mac) {
            setChartData(d => [...d.slice(1), payload.msv || 0]);
            return { ...prev, ...payload };
          }
          return prev;
        });
      } catch(e) {}
    };

    client.connect({ useSSL: true, onSuccess: () => { setWssStatus('connected'); client.subscribe("iot/radiation/telemetry"); }, onFailure: () => setWssStatus('error') });
    return () => { try { client.disconnect(); } catch(e) {} };
  }, []);

  // --- FUNGSI MENGANGKAT TABIR SAAT PETA SELESAI RENDER ---
  const onMapFullyLoaded = () => {
    if (!isMapReady && mapInit) {
      setIsMapReady(true);
      // Animasi Pudar Tabir Loading
      bootOpacity.value = withTiming(0, { duration: 800 }, () => {
        runOnJS(setIsBooting)(false);
      });

      // Mainkan Animasi Inisialisasi Kamera (Fly-in)
      setTimeout(() => {
        if (mapInit.bounds) {
          cameraRef.current?.setCamera({
            bounds: { ne: mapInit.bounds.ne, sw: mapInit.bounds.sw, paddingLeft: 60, paddingRight: 60, paddingTop: 60, paddingBottom: 250 },
            animationDuration: 2500,
            animationMode: 'flyTo'
          });
        } else {
          cameraRef.current?.setCamera({
            centerCoordinate: mapInit.center,
            zoomLevel: 14,
            animationDuration: 2500,
            animationMode: 'flyTo'
          });
        }
      }, 300);
    }
  };

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) setSelectedDevice(null);
  }, []);

  const toggleViewMode = () => {
    if (viewMode === 'map') bottomSheetRef.current?.close();
    setViewMode(viewMode === 'map' ? 'list' : 'map');
  };

  const handleMarkerPress = (device: DeviceData) => {
    setSelectedDevice(device);
    setChartData(Array(30).fill(0));
    
    cameraRef.current?.setCamera({ 
      centerCoordinate: [device.longitude, device.latitude - 0.0045], 
      zoomLevel: 15.5, 
      animationDuration: 1000,
      animationMode: 'flyTo'
    });
    
    // KUNCI FIX: Beri waktu React me-render state 50ms, baru tarik sheet-nya!
    setTimeout(() => {
      bottomSheetRef.current?.snapToIndex(0);
    }, 50);
  };

  const centerToUser = () => {
    if (location) {
      cameraRef.current?.setCamera({ centerCoordinate: location, zoomLevel: 15, animationDuration: 1000 });
      bottomSheetRef.current?.close();
    }
  };

  const getStatusColor = (level: number) => {
    if (level === 2) return Colors.light.danger;
    if (level === 1) return Colors.light.warning;
    return Colors.light.success;
  };

  const bootAnimatedStyle = useAnimatedStyle(() => ({ opacity: bootOpacity.value }));

  if (!mapInit) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.light.primary} /></View>;
  
  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar translucent backgroundColor={isBooting ? Colors.light.background : "transparent"} barStyle="dark-content" />
      
      {/* 1. MAP LAYER */}
      <MapView 
        style={styles.absoluteFill} 
        mapStyle={MAPTILER_STYLE}
        logoPosition={{ bottom: 120, left: 15 }} 
        attributionPosition={{ bottom: 120, right: 15 }}
        onPress={() => bottomSheetRef.current?.close()}
        onDidFinishRenderingMapFully={onMapFullyLoaded} // Trigger angkat tabir
      >
        <Camera 
          ref={cameraRef} 
          // Start dari luar angkasa (zoom kecil) biar pas tabir diangkat dia nge-zoom masuk secara epik!
          defaultSettings={{ centerCoordinate: mapInit.center, zoomLevel: 4 }} 
        />
        {location && (
          <MarkerView id="me" coordinate={location}>
            <View style={styles.userMarkerAura}><View style={styles.userMarkerCore} /></View>
          </MarkerView>
        )}
        {liveDevices.map(d => <PulseMarker key={d.device_mac} device={d} onPress={() => handleMarkerPress(d)} />)}
      </MapView>

      <View style={[styles.wssIndicator, { top: insets.top + 10, opacity: viewMode === 'map' ? 1 : 0 }]}>
        <View style={[styles.wssDot, { backgroundColor: wssStatus === 'connected' ? '#10B981' : '#F59E0B' }]} />
        <Text style={styles.wssText}>{wssStatus.toUpperCase()}</Text>
      </View>

      {location && viewMode === 'map' && (
        <TouchableOpacity style={styles.locateMeBtn} onPress={centerToUser}>
          <MaterialCommunityIcons name="crosshairs-gps" size={26} color={Colors.light.primary} />
        </TouchableOpacity>
      )}

      {/* 2. LAYER LIST VIEW DENGAN STAGGER ANIMATION */}
      {viewMode === 'list' && (
        <Animated.View 
          entering={FadeIn.duration(300)} 
          exiting={FadeOut.delay(200).duration(400)} // Background hilang terlambat (delay)
          style={[styles.absoluteFill, { backgroundColor: Colors.light.background, paddingTop: insets.top, zIndex: 10 }]}
        >
          <FlatList
            data={liveDevices}
            keyExtractor={item => item.device_mac}
            contentContainerStyle={{ paddingBottom: 150, paddingTop: 20 }}
            ListHeaderComponent={<Text style={styles.listHeaderTitle}>Radiation Monitors</Text>}
            renderItem={({ item, index }) => (
              <Animated.View 
                entering={FadeInDown.delay(index * 80).duration(400)} // Efek masuk jatuh bertahap
                exiting={FadeOutDown.duration(200)} // Efek hilang duluan & cepat
              >
                <View style={styles.listCardWrapper}>
                  <TouchableOpacity style={styles.listLocateBtn} onPress={() => { toggleViewMode(); handleMarkerPress(item); }}>
                    <MaterialCommunityIcons name="map-marker-outline" size={26} color={Colors.light.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.listCardMain} onPress={() => router.push({ pathname: '/device/[id]', params: { id: item.device_mac } })}>
                    <View>
                      <Text style={styles.cardTitle}>{item.device_mac}</Text>
                      <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Baterai: {item.battery_percent}%</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: getStatusColor(item.ews_level) }]}>
                      <Text style={styles.badgeText}>{(item.msv || 0).toFixed(2)} µSv</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          />
        </Animated.View>
      )}

      {/* 3. GORHOM BOTTOM SHEET */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1} 
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        animatedIndex={animatedIndex}
        onChange={handleSheetChanges}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetView style={styles.sheetContent}>
          {selectedDevice && (
            <View style={{ flex: 1 }}>
              <View style={styles.sheetHeader}>
                <Text style={styles.deviceName}>{selectedDevice.device_mac}</Text>
                <Text style={styles.deviceSubText}>Last updated: {selectedDevice.time?.split('T')[1].split('.')[0] || 'Syncing...'}</Text>
              </View>

              <View style={[styles.badge, { backgroundColor: getStatusColor(selectedDevice.ews_level), marginBottom: 15 }]}>
                <Text style={styles.badgeText}>{selectedDevice.ews_level === 0 ? 'AMAN' : selectedDevice.ews_level === 1 ? 'WASPADA' : 'BAHAYA'}</Text>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}><Text style={styles.metricValue}>{(selectedDevice.msv || 0).toFixed(3)}</Text><Text style={styles.metricLabel}>µSv/h</Text></View>
                <View style={styles.metricBox}><Text style={styles.metricValue}>{selectedDevice.cpm || 0}</Text><Text style={styles.metricLabel}>CPM</Text></View>
                <View style={styles.metricBox}><Text style={styles.metricValue}>{selectedDevice.battery_percent || 0}%</Text><Text style={styles.metricLabel}>Baterai</Text></View>
              </View>

              <View style={styles.chartWrapper}>
                <Animated.View style={[styles.chartContainer, chartAnimatedStyle]}>
                  <Text style={styles.chartTitle}>MSv Real-time Stream (30s)</Text>
                  <View style={styles.miniChart}>
                    {chartData.map((v, i) => {
                      const maxVal = Math.max(...chartData, 0.1);
                      const heightPercent = (v / maxVal) * 100;
                      return (
                        <View key={i} style={styles.chartBarTrack}>
                          <View style={[styles.chartBar, { height: `${Math.max(heightPercent, 2)}%`, backgroundColor: getStatusColor(selectedDevice.ews_level) }]} />
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>

                <TouchableOpacity 
                  style={[styles.primaryButton, { backgroundColor: getStatusColor(selectedDevice.ews_level), marginBottom: insets.bottom > 0 ? insets.bottom : 20 }]}
                  onPress={() => router.push({ pathname: '/device/[id]', params: { id: selectedDevice.device_mac } })}
                >
                  <Text style={styles.primaryButtonText}>LIHAT ANALITIK DETAIL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* 4. NAV BAR BAWAH (Z-INDEX 100 BIAR AMAN DARI LIST) */}
      <Animated.View style={[styles.navBar, navBarAnimatedStyle, { paddingBottom: insets.bottom + 15 }]}>
        <TouchableOpacity style={styles.navItem} onPress={toggleViewMode}>
          <MaterialCommunityIcons name={viewMode === 'map' ? "view-list" : "map-marker-radius"} size={26} color={Colors.light.primary} />
          <Text style={styles.navTextActive}>{viewMode === 'map' ? 'List View' : 'Map View'}</Text>
        </TouchableOpacity>
        <View style={styles.navDivider} />
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/scanner')}>
          <MaterialCommunityIcons name="qrcode-scan" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Scan Alat</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* TABIR LOADING PETA */}
      {isBooting && (
        <Animated.View style={[styles.absoluteFill, styles.bootOverlay, bootAnimatedStyle]}>
          <View style={styles.bootContent}>
            {/*<MaterialCommunityIcons name="radar" size={60} color={Colors.light.primary} style={{ marginBottom: 20 }} />*/}
            <ActivityIndicator size="large" color={Colors.light.primary} />
            <Text style={styles.bootText}>Menyiapkan Data...</Text>
          </View>
        </Animated.View>
      )}

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  absoluteFill: { ...StyleSheet.absoluteFillObject },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.light.background },
  
  // Tabir Loading Peta
  bootOverlay: { backgroundColor: Colors.light.background, zIndex: 999, justifyContent: 'center', alignItems: 'center' },
  bootContent: { alignItems: 'center' },
  bootText: { marginTop: 15, fontSize: 16, fontWeight: 'bold', color: Colors.light.text, letterSpacing: 1 },

  wssIndicator: { position: 'absolute', left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, elevation: 5, zIndex: 5 },
  wssDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  wssText: { fontSize: 10, fontWeight: 'bold', color: '#374151' },

  locateMeBtn: { position: 'absolute', bottom: 120, right: 20, backgroundColor: 'white', padding: 12, borderRadius: 30, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, zIndex: 5 },

  markerContainer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pulseAura: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },
  markerCore: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center', elevation: 5 },
  markerText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  
  userMarkerCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: 'white' },
  userMarkerAura: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(59, 130, 246, 0.25)', alignItems: 'center', justifyContent: 'center' },

  listHeaderTitle: { fontSize: 26, fontWeight: '900', marginHorizontal: 20, marginBottom: 20, color: '#111827' },
  listCardWrapper: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12 },
  // KITA BUANG ELEVATION-NYA, GANTI PAKAI BORDER FLAT BIAR ANIMASI FADE-NYA SEMPURNA
  listLocateBtn: { 
    backgroundColor: 'white', 
    justifyContent: 'center', alignItems: 'center', 
    paddingHorizontal: 15, 
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18, 
    borderWidth: 1, borderColor: '#F3F4F6', borderRightWidth: 0, // <--- Ini gantinya
    marginRight: 0 
  },
  listCardMain: { 
    flex: 1, backgroundColor: 'white', padding: 20, 
    borderTopRightRadius: 18, borderBottomRightRadius: 18, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    borderWidth: 1, borderColor: '#F3F4F6', borderLeftWidth: 0 // <--- Ini gantinya
  },
  cardTitle: { fontWeight: 'bold', fontSize: 16, color: '#374151' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

  sheetBackground: { borderRadius: 35, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 20 },
  sheetContent: { flex: 1, paddingHorizontal: 25 }, 
  
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  deviceName: { fontSize: 22, fontWeight: '900', color: '#111827' },
  deviceSubText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F3F4F6', padding: 20, borderRadius: 20, marginBottom: 10 },
  metricBox: { alignItems: 'center', flex: 1 },
  metricValue: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  metricLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 4, fontWeight: 'bold' },

  chartWrapper: { flex: 1, overflow: 'hidden', justifyContent: 'flex-start' },
  chartContainer: { height: 0, overflow: 'hidden' },
  chartInner: { height: 130, width: '100%', justifyContent: 'flex-end', paddingBottom: 10 },
  chartTitle: { fontSize: 12, fontWeight: 'bold', color: '#6B7280', marginBottom: 10 },
  miniChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flex: 1 }, 
  chartBarTrack: { flex: 1, marginHorizontal: 2, height: '100%', backgroundColor: '#E5E7EB', borderRadius: 4, justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 4 },

  primaryButton: { 
    marginTop: 25, // <--- Ini yang ngasih "napas" antara chart dan tombol
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    elevation: 2 
  },
  primaryButtonText: { color: 'white', fontWeight: 'bold', letterSpacing: 0.5, fontSize: 14 },

  // Z-INDEX DIBESARKAN AGAR LIST VIEW TIDAK NGE-BLOCK NAVBAR
  navBar: { position: 'absolute', bottom: -10, left: 0, right: 0, backgroundColor: 'white', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, borderTopLeftRadius: 18, borderTopRightRadius: 18, elevation: 30, zIndex: 100 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 11, color: '#9CA3AF', marginTop: 6, fontWeight: '600' },
  navTextActive: { fontSize: 11, color: Colors.light.primary, marginTop: 6, fontWeight: 'bold' },
  navDivider: { width: 1, height: 35, backgroundColor: '#F3F4F6', alignSelf: 'center' },
});