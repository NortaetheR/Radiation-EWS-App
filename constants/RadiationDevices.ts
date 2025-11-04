export interface RadiationDevice {
  id: string;
  latitude: number;
  longitude: number;
  radiation: number; // CPM
}

export const dummyDevices: RadiationDevice[] = [
  {
    id: 'gm01',
    latitude: -6.2005,
    longitude: 106.8169,
    radiation: 120,
  },
  {
    id: 'gm02',
    latitude: -6.201,
    longitude: 106.818,
    radiation: 320,
  },
];
