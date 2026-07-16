"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { VehicleLocation } from "@/types";

const truckIcon = new L.DivIcon({
  html: `<div style="background:#000;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
  </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

interface FleetMapProps {
  locations: VehicleLocation[];
  selected: VehicleLocation | null;
  onSelect: (loc: VehicleLocation) => void;
}

export default function FleetMap({ locations, selected, onSelect }: FleetMapProps) {
  const center: [number, number] = selected
    ? [Number(selected.latitude), Number(selected.longitude)]
    : locations.length
    ? [Number(locations[0].latitude), Number(locations[0].longitude)]
    : [12.9716, 77.5946];

  return (
    <MapContainer center={center} zoom={7} style={{ height: "100%", width: "100%" }} zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MapController center={center} />
      {locations.map((loc) => (
        <Marker
          key={loc.id}
          position={[Number(loc.latitude), Number(loc.longitude)]}
          icon={truckIcon}
          eventHandlers={{ click: () => onSelect(loc) }}
        >
          <Popup>
            <strong>{loc.vehicle_number}</strong><br />
            {loc.driver_name}<br />
            {loc.speed} km/h
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
