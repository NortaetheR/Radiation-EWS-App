import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/Colors';

const BACKEND_URL = 'https://api.nortaether.my.id';

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams(); // Mengambil MAC Address
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<'1H' | '24H'>('1H');

  useEffect(() => {
    const fetchHistoryData = async () => {
      setLoading(true);
      try {
        // Logika penentuan parameter berdasarkan pilihan UX
        let interval = '1 minute';
        let hoursBehind = 1;

        if (timeFrame === '24H') {
          interval = '30 minute';
          hoursBehind = 24;
        }

        const response = await fetch(
          `${BACKEND_URL}/api/v1/telemetry/history/${id}?interval=${interval}&hours_behind=${hoursBehind}`
        );
        const result = await response.json();

        if (result.data) {
          // Transformasi format data TimescaleDB ke format GiftedCharts {value, label}
          const formattedData = result.data.map((item: any) => {
            const date = new Date(item.bucket_time);
            // Format jam simpel (HH:MM)
            const label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            
            return {
              value: item.avg_msv || 0, // Tampilkan rata-rata mSv
              label: label,
              dataPointText: item.avg_msv ? item.avg_msv.toFixed(2) : '0',
            };
          });

          setChartData(formattedData);
        }
      } catch (error) {
        console.error("Gagal menarik data riwayat:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, [id, timeFrame]); // Request ulang setiap kali rentang waktu diubah

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analisis Radiasi</Text>
        <Text style={styles.subtitle}>{id}</Text>
      </View>

      {/* Toggle Rentang Waktu */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleBtn, timeFrame === '1H' && styles.toggleBtnActive]}
          onPress={() => setTimeFrame('1H')}
        >
          <Text style={[styles.toggleText, timeFrame === '1H' && styles.toggleTextActive]}>1 Jam</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toggleBtn, timeFrame === '24H' && styles.toggleBtnActive]}
          onPress={() => setTimeFrame('24H')}
        >
          <Text style={[styles.toggleText, timeFrame === '24H' && styles.toggleTextActive]}>24 Jam</Text>
        </TouchableOpacity>
      </View>

      {/* Area Grafik */}
      <View style={styles.chartCard}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginVertical: 50 }} />
        ) : chartData.length > 0 ? (
          <LineChart
            data={chartData}
            width={300}
            height={220}
            spacing={timeFrame === '1H' ? 40 : 30}
            initialSpacing={10}
            color={Colors.light.primary}
            thickness={3}
            startFillColor="rgba(227, 27, 35, 0.3)" // Merah transparan
            endFillColor="rgba(227, 27, 35, 0.01)"
            startOpacity={0.9}
            endOpacity={0.2}
            areaChart
            yAxisTextStyle={{ color: Colors.light.icon, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: Colors.light.icon, fontSize: 10 }}
            hideRules
            yAxisColor="lightgray"
            xAxisColor="lightgray"
            pointerConfig={{
              pointerStripHeight: 160,
              pointerStripColor: 'lightgray',
              pointerStripWidth: 2,
              pointerColor: Colors.light.primary,
              radius: 6,
              pointerLabelWidth: 100,
              pointerLabelHeight: 90,
              activatePointersOnLongPress: true,
              autoAdjustPointerLabelPosition: true,
            }}
          />
        ) : (
          <Text style={styles.noDataText}>Belum ada data historis yang cukup.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { padding: 20, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.light.text },
  subtitle: { fontSize: 14, color: Colors.light.icon, marginTop: 4 },
  
  toggleContainer: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleText: { color: Colors.light.icon, fontWeight: '600' },
  toggleTextActive: { color: Colors.light.text, fontWeight: 'bold' },

  chartCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center', // Pusatkan grafik
  },
  noDataText: { padding: 40, color: Colors.light.icon, textAlign: 'center' }
});