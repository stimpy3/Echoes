import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../../context/ThemeContext";
import CustomMarker from "./CustomMarker";
import FriendMarker from "./FriendMarker";
import HomeMarker from "./HomeMarker";
import { useHome } from "../../context/HomeContext";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const MapView = ({friendMemories, memories, addingMode = false, onMapClick }) => {
  const defaultCenter = [19.0866, 72.9095];
  const defaultZoom = 5;
  const { dark } = useTheme();
  const { homePosition } = useHome(); //get home position from context

  const tileUrls = {
    streets: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  };

  const mapStyle = dark ? "dark" : "light";

  //A small helper component to recenter map when home changes
  function SetMapView({ position }) {
    const map = useMap();
    if (position) map.setView([position.lat, position.lng], 12);
    return null;
  }

  //Minimal addition listens for clicks only when addingMode is true
  function ClickHandler() {
    useMapEvents({
      click(e) {
        if (addingMode && onMapClick) onMapClick(e.latlng);
      },
    });
    return null;
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={homePosition ? [homePosition.lat, homePosition.lng] : defaultCenter}
        zoom={defaultZoom}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
        className="overflow-hidden relative rounded-lg bg-main dark:bg-dmain"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url={tileUrls[mapStyle]}
          subdomains={["a", "b", "c", "d"]}
        />

        {/*Recenter map when home loads */}
        <SetMapView position={homePosition} />

        {/*Render the user’s home pin */}
        {homePosition && <HomeMarker position={homePosition} />}

        {/*Render all memories */}
        {memories.map((memory) => (
          <CustomMarker key={memory.id} memory={memory} />
        ))}

        {/*Render all friend memories 
          receiving:
           
           [
             {
               userId: "65a1...",
               user: {
                 name: "Alex",
                 profilePic: "https://..."
               },
               memories: [
                 { title: "...", photoUrl: "..." },
                 { title: "...", photoUrl: "..." }
               ]
             }
           ]
           
           */}
            {friendMemories.map((people) =>
              people.memories.map((memory) => (
                <FriendMarker
                  key={memory.userId}
                  pfp={people.user.profilePic}
                  id={people.userId}
                  memory={memory}
                />
              ))
            )}

        {/* 🔹 Add this — only active in add mode */}
        <ClickHandler />

        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
};

export default MapView;
