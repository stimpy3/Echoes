import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Locate } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:5000";
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const PITCH = 55;
const BEARING = -17;

const homePinEl = () => {
  const el = document.createElement("div");
  el.innerHTML = `<img src="/homepin.png" style="width:50px;height:50px;transform: translate(-33%, -8%);" />`;
  return el;
};

const HomeLocationPage = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState(null);
  const [autoPosition, setAutoPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const positionRef = useRef(null);

  // Get user's current geolocation once
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(loc);
        setAutoPosition(loc);
        setLoading(false);
      },
      (err) => {
        console.error("Location error:", err);
        alert(
          "Location access denied. You can set your home location later from your profile."
        );
        setShowPrompt(false);
        setLoading(false);
      }
    );
  }, []);

  // Init the map once loading (the geolocation request) has settled, with or without a
  // position — geolocation being denied is a normal path, not a reason to never show a map.
  useEffect(() => {
    if (loading || !containerRef.current || mapRef.current) return;

    const startCenter = position ? [position.lng, position.lat] : [72.9095, 19.0866];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: startCenter,
      zoom: 13,
      pitch: PITCH,
      bearing: BEARING,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("click", (e) => {
      positionRef.current = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setPosition(positionRef.current);
    });

    map.on("load", () => map.resize());

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [loading]);

  // Keep the pin (and, on the very first placement, the camera) in sync with position.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ element: homePinEl(), anchor: "bottom" })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([position.lng, position.lat]);
    }
  }, [position]);

  // Save selected location to backend
  const handleConfirm = async () => {
    if (!position) return alert("Select your home location first!");
    setSaving(true);
    try {
      await axios.post(
        `${BASE_URL}/api/user/sethome`,
        { lat: position.lat, lng: position.lng },
        { withCredentials: true }
      );
      alert("Home location saved successfully!");
      navigate("/home");
    } catch (err) {
      console.error("Error saving location:", err.response?.data || err.message);
      alert("Failed to save location. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Reset to automatically detected location
  const resetToAutoLocation = () => {
    if (!autoPosition) return alert("Automatic location not available.");
    setPosition(autoPosition);
    mapRef.current?.flyTo({ center: [autoPosition.lng, autoPosition.lat], zoom: 13, pitch: PITCH, bearing: BEARING, essential: true });
  };

  // Handle denial of location permission
  const handleDenyLocationPermission = () => {
    setShowPrompt(false);
    navigate("/home");
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-main dark:bg-dmain text-txt dark:text-dtxt">
        Loading map...
      </div>
    );

  return (
    <div className="w-[100vw] h-[100vh] relative">
      {/* Permission prompt overlay */}
      {showPrompt && (
        <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-main dark:bg-dlightMain rounded-lg p-6 max-w-sm text-center">
            <h2 className="text-lg text-txt dark:text-dtxt font-semibold mb-4">
              Allow Location Access?
            </h2>
            <p className="text-sm text-txt dark:text-dtxt mb-6">
              We need your location once to set your home marker on the map. You
              can set it later from the rail settings if you skip.
            </p>
            <div className="flex justify-around">
              <button
                onClick={handleDenyLocationPermission}
                className="bg-lightMain2 dark:bg-dlightMain2 text-txt dark:text-dtxt px-4 py-2 rounded-lg hover:opacity-90 transition-all"
              >
                No thanks
              </button>
              <button
                onClick={() => {
                  setShowPrompt(false);
                  if (!position) alert("Please allow location in browser!");
                }}
                className="bg-gradient-mainBright text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />

      {/* Reset to detected location */}
      <button
        onClick={resetToAutoLocation}
        className="absolute z-[900] w-[50px] aspect-square bottom-6 right-6 bg-gradient-mainBright text-white grid place-content-center rounded-full shadow-lg hover:brightness-110 transition-all"
        title="Reset to your current location"
      >
        <Locate />
      </button>

      {/* Confirm home location */}
      <button
        onClick={handleConfirm}
        disabled={saving || !position}
        className="absolute z-[900] bottom-6 left-1/2 -translate-x-1/2 bg-gradient-mainBright text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:brightness-110 transition-all disabled:opacity-50"
      >
        {saving ? "Saving..." : "Confirm Home Location"}
      </button>
    </div>
  );
};

export default HomeLocationPage;
