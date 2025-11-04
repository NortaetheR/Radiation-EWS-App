import React from 'react';
import { Circle, Marker } from 'react-native-maps';

interface RadiationMarkerProps {
  latitude: number;
  longitude: number;
  value: number; // radiasi CPM
}

export const RadiationMarker: React.FC<RadiationMarkerProps> = ({ latitude, longitude, value }) => {
  const radiusInMeter = value * 1;

    return (
    <>
      <Marker 
        coordinate={{ latitude, longitude }} 
        title={`Radiasi: ${value} CPM`} 
        description='Alat GM Detektor'
      />
      <Circle
        center={{ latitude, longitude }}
        radius={radiusInMeter} // bisa disesuaikan konversinya
        strokeColor="rgba(255, 0, 0, 0.6)"
        fillColor="rgba(255, 0, 0, 0.2)"
      />
    </>
  );
};
