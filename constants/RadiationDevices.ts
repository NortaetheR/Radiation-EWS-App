export interface DeviceData {
  device_mac: string;
  latitude: number;
  longitude: number;
  ews_level: number;
  msv: number;
  cpm: number;
  battery_percent: number;
  timestamp?: string;
  time?: string;
}