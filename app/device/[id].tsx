import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router'; 
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/Colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DeviceData } from '@/constants/RadiationDevices';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIME_FRAMES = [
  { label: '1 Jam', value: '1H', interval: '1 minute', hours: 1 },
  { label: '24 Jam', value: '24H', interval: '30 minute', hours: 24 },
  { label: '7 Hari', value: '7D', interval: '2 hour', hours: 168 },
];

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams(); 
  
  const [deviceInfo, setDeviceInfo] = useState<DeviceData | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [activeTimeFrame, setActiveTimeFrame] = useState(TIME_FRAMES[0]);

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/v1/telemetry/latest/${id}`);
        const result = await response.json();
        if (result.status === 'success' && result.data) {
          setDeviceInfo(result.data);
        } else {
            setDeviceInfo({
                device_mac: id as string,
                latitude: -6.200000,
                longitude: 106.816666,
                ews_level: 0, // Coba ganti ke 2 buat tes warna merah
                msv: 0.12,
                cpm: 24,
                battery_percent: 85,
                timestamp: new Date().toISOString()
            });
        }
      } catch (error) {
        console.error("Gagal menarik info detail perangkat:", error);
      }
    };
    fetchDeviceInfo();
  }, [id]);

  useEffect(() => {
    const fetchHistoryData = async () => {
      setLoadingChart(true);
      try {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/v1/telemetry/history/${id}?interval=${activeTimeFrame.interval}&hours_behind=${activeTimeFrame.hours}`
        );
        const result = await response.json();

        if (result.data && result.data.length > 5) { 
          const dataLength = result.data.length;
          const formattedData = result.data.map((item: any, index: number) => {
            const date = new Date(item.bucket_time);
            
            let rawLabel = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            if(activeTimeFrame.value === '7D') {
                rawLabel = `${date.getDate()}/${date.getMonth() + 1}`;
            }

            // Tampilkan label sumbu X agar tidak bertumpuk
            const showLabel = index === 0 || index === dataLength - 1 || index % Math.ceil(dataLength / 4) === 0;

            return {
              value: item.avg_msv || 0,
              label: showLabel ? rawLabel : '',
              dataPointText: item.avg_msv ? item.avg_msv.toFixed(2) : '0',
            };
          });
          setChartData(formattedData);
        } else {
          // DUMMY GENERATOR
          const dummyData = [];
          const points = activeTimeFrame.value === '1H' ? 15 : activeTimeFrame.value === '24H' ? 24 : 14; 
          let baseValue = deviceInfo?.ews_level === 2 ? 0.8 : 0.15; 

          for (let i = 0; i < points; i++) {
            baseValue = baseValue + (Math.random() * 0.06 - 0.03); 
            if (i === Math.floor(points / 2)) baseValue += (deviceInfo?.ews_level === 2 ? 0.5 : 0.2); 
            
            const showLabel = i === 0 || i === points - 1 || i % Math.ceil(points / 4) === 0;
            
            dummyData.push({
              value: Math.max(0, baseValue), 
              label: showLabel ? (activeTimeFrame.value === '1H' ? `:${i*4}` : `${i}:00`) : '',
              dataPointText: Math.max(0, baseValue).toFixed(2)
            });
          }
          setChartData(dummyData);
        }
      } catch (error) {
        console.error("Gagal menarik data riwayat:", error);
      } finally {
        setLoadingChart(false);
      }
    };

    if (deviceInfo) {
      fetchHistoryData();
    }
  }, [id, activeTimeFrame, deviceInfo]); 

  // --- DYNAMIC THEME ENGINE ---
  const getThemeColor = () => {
    if (deviceInfo?.ews_level === 2) return '#EF4444'; // Merah (Bahaya)
    if (deviceInfo?.ews_level === 1) return '#F59E0B'; // Oranye (Waspada)
    return '#10B981'; // Hijau (Aman)
  };

  const getStatusText = () => {
    if (deviceInfo?.ews_level === 2) return 'BAHAYA';
    if (deviceInfo?.ews_level === 1) return 'WASPADA';
    return 'AMAN';
  };

  const themeColor = getThemeColor();

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: `Detail`, 
          headerShadowVisible: false, 
          headerStyle: { backgroundColor: Colors.light.background },
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- DEVICE INFO CARD --- */}
        {deviceInfo ? (
            <View style={styles.deviceInfoCard}>
                <Text style={styles.macTitle}>{deviceInfo.device_mac}</Text>  
                <View style={styles.deviceInfoHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="radioactive" size={20} color={themeColor} />
                        <Text style={styles.deviceStatusText}>
                            Status: <Text style={{ color: themeColor, fontWeight: 'bold' }}>{getStatusText()}</Text>
                        </Text>
                    </View>
                    <View style={styles.batteryPill}>
                        <Ionicons name="battery-half" size={14} color="#6B7280" />
                        <Text style={styles.batteryText}>{deviceInfo.battery_percent}%</Text>
                    </View>
                </View>

                <View style={styles.gridContainer}>
                    <View style={styles.gridItem}>
                        <Text style={styles.gridLabel}>RADIASI (MSV/H)</Text>
                        <Text style={[styles.gridValue, { color: themeColor }]}>
                            {deviceInfo.msv.toFixed(3)}
                        </Text>
                    </View>
                    <View style={styles.gridDivider} />
                    <View style={styles.gridItem}>
                        <Text style={styles.gridLabel}>HITUNGAN (CPM)</Text>
                        <Text style={styles.gridValue}>{deviceInfo.cpm}</Text>
                    </View>
                </View>

                <View style={styles.locationFooter}>
                     <Ionicons name="location-sharp" size={14} color={themeColor} />
                     <Text style={styles.locationText}>
                         {deviceInfo.latitude.toFixed(5)}, {deviceInfo.longitude.toFixed(5)}
                     </Text>
                     <Text style={styles.timeText}>
                         • Last sync: {new Date(deviceInfo.timestamp || Date.now()).toLocaleTimeString()}
                     </Text>
                </View>
            </View>
        ) : (
            <ActivityIndicator size="small" color={Colors.light.primary} style={{ margin: 20 }} />
        )}

        <Text style={styles.sectionTitle}>Riwayat Paparan</Text>
        
        {/* --- TIME FRAME SELECTOR --- */}
        <View style={styles.timeFrameContainer}>
          {TIME_FRAMES.map((tf) => {
            const isActive = activeTimeFrame.value === tf.value;
            return (
              <TouchableOpacity 
                key={tf.value}
                style={[
                  styles.pillBtn, 
                  isActive ? { backgroundColor: themeColor } : { backgroundColor: '#F3F4F6' }
                ]}
                onPress={() => setActiveTimeFrame(tf)}
              >
                <Text style={[
                  styles.pillText, 
                  isActive ? styles.pillTextActive : styles.pillTextInactive
                ]}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* --- CHART AREA --- */}
        <View style={styles.chartCard}>
          {/* Label Indikator Value Vertikal (Y-Axis) */}
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Grafik Paparan</Text>
            <Text style={styles.chartUnitLabel}>(µSv/h)</Text>
          </View>

          {loadingChart ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="large" color={themeColor} />
              <Text style={{ marginTop: 10, color: Colors.light.icon }}>
                Menyusun data log...
              </Text>
            </View>
          ) : chartData.length > 0 ? (
            
            // KUNCI: Jangan bungkus pakai ScrollView! Biarkan library yang handle
            <View style={styles.chartWrapper}>
              <LineChart
                areaChart
                data={chartData}
                width={SCREEN_WIDTH - 110} // Kurangi lebar untuk area angka vertikal (Y-Axis)
                height={220}
                spacing={SCREEN_WIDTH / chartData.length * 1.5} 
                initialSpacing={15}
                endSpacing={0}
                curved
                isAnimated
                animationDuration={1200}
                color={themeColor}
                thickness={3}
                startFillColor={themeColor}
                endFillColor={themeColor}
                startOpacity={0.4}
                endOpacity={0.01}
                hideRules
                adjustToWidth={true}
                
                // Konfigurasi Sumbu Y (Vertikal) agar DIAM dan Rapi
                yAxisColor="#F3F4F6" // Garis batas halus antara Y-axis dan chart
                yAxisThickness={1}
                yAxisLabelWidth={35} // Lebar ruangan untuk angka vertikal
                yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10, fontWeight: '700' }}
                
                // Konfigurasi Sumbu X (Horizontal)
                xAxisColor="#E5E7EB"
                xAxisThickness={1}
                xAxisLabelTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
                
                dataPointsColor={themeColor}
                dataPointsRadius={4}
                textColor={themeColor} 
                textFontSize={10}
                textShiftY={-12} 
                textShiftX={-10}
                
                // KONFIGURASI POINTER ANTI-NYEBELIN
                pointerConfig={{
                  pointerStripHeight: 0,       // tinggi full chart
                  pointerStripWidth: 0,          // ⬅ tipis sekali
                  pointerStripColor: 'rgba(156,163,175,0.4)', // halus, gak norak // warna soft biar gak ganggu
                  pointerColor: themeColor,
                  radius: 1,

                  activatePointersOnLongPress: true,
                  autoAdjustPointerLabelPosition: true,

                  pointerComponent: () => {
                    return (
                      <View
                        style={{
                          height: 10,
                          width: 10,
                          borderRadius: 5,
                          backgroundColor: themeColor,
                          borderWidth: 2,
                          borderColor: 'white',
                        }}
                      />
                    );
                  },
                
                  pointerLabelComponent: (items: any) => {
                    return (
                      <View style={styles.pointerTooltip}>
                        <Text style={styles.pointerTooltipText}>
                          {items[0].value.toFixed(3)} mSv
                        </Text>
                        {items[0].label ? (
                          <Text style={styles.pointerTooltipSub}>
                            {items[0].label}
                          </Text>
                        ) : null}
                      </View>
                    );
                  },
                }}
              />
            </View>
          ) : (
            <Text style={styles.noDataText}>
              Belum ada data historis yang tercatat.
            </Text>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' }, // Ganti bg jadi abu sangat muda biar card pop-out
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },

  deviceInfoCard: { 
    backgroundColor: 'white', 
    borderRadius: 24, 
    padding: 24, 
    marginBottom: 25, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 15, 
    elevation: 3 
  },
  macTitle: { fontSize: 18, fontWeight: '900', color: '#111827', marginBottom: 15 },
  deviceInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  deviceStatusText: { marginLeft: 6, fontSize: 14, color: Colors.light.text },
  batteryPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  batteryText: { fontSize: 12, fontWeight: 'bold', color: '#4B5563', marginLeft: 4 },
  
  gridContainer: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#F3F4F6' },
  gridItem: { flex: 1, alignItems: 'center' },
  gridDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 15 },
  gridLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 6 },
  gridValue: { fontSize: 28, fontWeight: '900', color: Colors.light.text },

  locationFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 15 },
  locationText: { fontSize: 11, color: '#4B5563', marginLeft: 4, fontWeight: '600' },
  timeText: { fontSize: 10, color: '#9CA3AF', marginLeft: 6 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 15 },
  
  timeFrameContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 15,
    alignItems: 'center',
  },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillTextActive: { color: 'white' },
  pillTextInactive: { color: '#9CA3AF' },

  // Chart Area
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 15, // Beri padding agar angka Y tidak terlalu nempel tepi
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 3
  },
  
  // Label Vertikal (µSv/h)
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  chartTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  chartUnitLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginLeft: 6 },

  chartLoading: { height: 220, justifyContent: 'center', alignItems: 'center' },
  noDataText: { padding: 40, color: Colors.light.icon, textAlign: 'center' },
  
  chartWrapper: {
    overflow: 'hidden',
    borderRadius: 16, // Border radius sedikit lebih kecil untuk area dalam grafik
  },
  

  pointerTooltip: {
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  pointerTooltipText: { color: '#111827', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  pointerTooltipSub: { color: '#6B7280', fontSize: 11, textAlign: 'center', marginTop: 2, fontWeight: '600' },
});