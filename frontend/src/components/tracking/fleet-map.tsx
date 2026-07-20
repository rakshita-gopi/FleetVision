"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { VehicleLocation } from "@/types";
import { useTheme } from "@/contexts/theme-context";

const truckIcon = new L.DivIcon({
  html: `<div style="background:#2563eb;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 10px rgba(37,99,235,0.45)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
  </div>`,
  className: "fleet-marker",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function MapLifecycle({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    // Fix blank/black tiles when the container size settles after layout
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [map]);

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  useEffect(() => {
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [map]);

  return null;
}

interface FleetMapProps {
  locations: VehicleLocation[];
  selected: VehicleLocation | null;
  onSelect: (loc: VehicleLocation) => void;
}

export default function FleetMap({ locations, selected, onSelect }: FleetMapProps) {
  const { theme } = useTheme();
  const center: [number, number] = selected
    ? [Number(selected.latitude), Number(selected.longitude)]
    : locations.length
    ? [Number(locations[0].latitude), Number(locations[0].longitude)]
    : [12.9716, 77.5946];

  // Street map tiles (not pure black basemap)
  const tileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <MapContainer
      center={center}
      zoom={locations.length ? 11 : 7}
      style={{ height: "100%", width: "100%", background: "#e5e7eb" }}
      scrollWheelZoom
    >
      <TileLayer
        key={theme}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={tileUrl}
        maxZoom={19}
      />
      <MapLifecycle center={center} />
      {locations.map((loc) => (
        <Marker
          key={loc.id}
          position={[Number(loc.latitude), Number(loc.longitude)]}
          icon={truckIcon}
          eventHandlers={{ click: () => onSelect(loc) }}
        >
          <Popup>
            <strong>{loc.vehicle_number}</strong>
            <br />
            {loc.driver_name || "Unassigned"}
            <br />
            {loc.speed} km/h · {loc.vehicle_status}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
