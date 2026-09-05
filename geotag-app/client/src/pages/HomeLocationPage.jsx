import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { Locate } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import { useNavigate } from "react-router-dom";

 const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";

//Custom home pin icon (from /public folder)
const homePinIcon = new L.Icon({
  iconUrl: "/homepin.png",
  iconRetinaUrl: "/homepin.png",
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -45],
  shadowUrl: null,
});

// Map marker component lets user click to set location
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position ? <Marker position={position} icon={homePinIcon} /> : null;
}

const HomeLocationPage = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState(null);
  const [autoPosition, setAutoPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

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
  };

  // Handle denial of location permission
  const handleDenyLocationPermission = () => {
    setShowPrompt(false);
    navigate("/home");
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        Loading map...
      </div>
    );

  return (
    <div className="w-[100vw] h-[100vh] relative">
      {/* Permission prompt overlay */}
      {showPrompt && (
        <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 max-w-sm text-center">
            <h2 className="text-lg text-txt font-semibold mb-4">
              Allow Location Access?
            </h2>
            <p className="text-sm text-txt mb-6">
              We need your location once to set your home marker on the map. You
              can set it later from the Navigation Bar if you skip.
            </p>
            <div className="flex justify-around">
              <button
                onClick={handleDenyLocationPermission}
                className="bg-gray-200 text-txt px-4 py-2 rounded-lg hover:bg-gray-300 transition-all"
              >
                No thanks
              </button>
              <button
                onClick={() => {
                  setShowPrompt(false);
                  if (!position) alert("Please allow location in browser!");
                }}
                className="bg-dmain text-white px-4 py-2 rounded-lg hover:bg-dlightMain2 transition-all"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/*Map container */}
      <MapContainer
        center={position || { lat: 0, lng: 0 }}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <LocationMarker position={position} setPosition={setPosition} />
      </MapContainer>

      {/*Reset to detected location */}
      <button
        onClick={resetToAutoLocation}
        className="absolute w-[50px] aspect-square bottom-6 right-6 bg-dmain text-dtxt text-[2rem] grid place-content-center rounded-full shadow-md hover:bg-dlightMain2 transition-all"
        title="Reset to your current location"
      >
        <Locate />
      </button>

      {/*Confirm home location */}
      <button
        onClick={handleConfirm}
        disabled={saving || !position}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-dmain text-white px-6 py-2 rounded-lg shadow-md hover:bg-dlightMain2 transition-all"
      >
        {saving ? "Saving..." : "Confirm Home Location"}
      </button>
    </div>
  );
};

export default HomeLocationPage;
