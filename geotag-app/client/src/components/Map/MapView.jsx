import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useHome } from "../../context/HomeContext";
import { getHexFromUserId } from "../../utils/hexColorFromId";

/*
MapLibre GL prototype — replaces the flat Leaflet 2D map with a pitched, isometric-leaning
3D view. OpenFreeMap's "liberty" style is free, needs no API key, and (being the OSM Liberty
style) already ships a fill-extrusion building layer that activates once pitched — no manual
3D layer setup required.

Markers are plain DOM elements wrapped in maplibregl.Marker rather than react-leaflet's
divIcon components — GSAP could still be wired to these the same way CustomMarker.jsx
animates Leaflet's icons, but this first pass uses a CSS pop-in instead to keep the
component self-contained while the rest of the app's maps are still Leaflet.
*/
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_CENTER = [72.9095, 19.0866]; // [lng, lat]
const DEFAULT_ZOOM = 15;
const PITCH = 55;
const BEARING = -17;

/*
Ground shadow — an oval, semi-transparent smudge sitting flat on the map under a pin,
standing in for a CSS box-shadow (which reads as a flat drop-shadow, wrong for a pitched
3D scene where the pin should look like it's actually standing on the ground). Positioned
absolutely so it doesn't add to the marker's own box height — anchor="bottom" still lands
exactly on the pin's tip.
*/
const groundShadow = (width = 26, bottom = -3) => `
  <div class="absolute left-1/2 -translate-x-1/2 bg-black/40 pointer-events-none"
    style="bottom:${bottom - 6}px; width:${width}px; height:${Math.round(width * 0.34)}px; border-radius: 50%;"></div>
`;

const memoryMarkerEl = (memory) => {
  const el = document.createElement("div");
  el.className = "echoes-marker-pop";
  el.innerHTML = `
    <div class="w-14 h-[62px] relative cursor-pointer hover:scale-[1.08] transition-transform duration-200 origin-bottom">
      ${groundShadow(30, -2)}
      <div class="relative z-20 w-14 h-14 rounded-lg border-[2px] border-dmain dark:border-main bg-gray-500 bg-cover bg-center"
        style="background-image: url('${memory.photoUrl}')">
      </div>
      <div class="z-10 absolute left-1/2 -translate-x-1/2 bottom-0 w-[11px] aspect-square rotate-45 bg-dmain dark:bg-main"></div>
    </div>
  `;
  return el;
};

const friendMarkerEl = (memory, pfp, accent) => {
  const el = document.createElement("div");
  el.className = "echoes-marker-pop";
  el.innerHTML = `
    <div class="w-[52px] h-[58px] relative cursor-pointer hover:scale-[1.15] transition-transform duration-200 origin-bottom">
      ${groundShadow(26, 0)}
      <div class="relative z-20 w-12 h-12 rounded-[10px] border-[2px] bg-gray-500 bg-cover bg-center"
        style="background-image: url('${memory.photoUrl}'); border-color: ${accent};">
      </div>
      <div class="z-30 absolute w-7 right-0 bottom-[6px] aspect-square rounded-full bg-cover bg-center"
        style="background-image: url('${pfp}'); border: 2px solid ${accent};"></div>
    </div>
  `;
  return el;
};

const homeMarkerEl = () => {
  const el = document.createElement("div");
  el.className = "echoes-marker-pop";
  el.innerHTML = `
    <div class="relative w-[60px] h-[60px]">
      ${groundShadow(22, 4)}
      <img src="/homepin.png" class="relative z-20 w-[60px] h-[60px]" style="transform: translate(-33%, -8%);" />
    </div>
  `;
  return el;
};

// The pin being placed while adding a memory — a gradient-bordered square with a MapPin
// glyph, plus a gradient tail, per the add-memory design spec. Draggable so the user can
// nudge the exact spot before saving.
const PENDING_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

const pendingPinEl = () => {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="relative w-11 h-[52px] cursor-grab active:cursor-grabbing">
      ${groundShadow(24, -2)}
      <div class="relative z-20 w-11 h-11 rounded-[10px] p-[3px]" style="background: linear-gradient(45deg,#fc9b41,#d557e3,#3ed8e3);">
        <div class="w-full h-full rounded-[7px] bg-[#0e0e0e] flex items-center justify-center">${PENDING_PIN_SVG}</div>
      </div>
      <div class="z-10 absolute left-1/2 -translate-x-1/2 bottom-0 w-3 h-3 rotate-45" style="background: linear-gradient(45deg,#fc9b41,#d557e3,#3ed8e3);"></div>
    </div>
  `;
  return el;
};

// Tailwind's dark: classes work here because this HTML is inserted into the real
// document (not an iframe) — it still sees the `.dark` class on <html>. The
// maplibregl-popup-content wrapper itself is themed separately, via the echoes-popup
// class in index.css, since that part comes from maplibre-gl's own stylesheet.
const popupHtml = (memory) => `
  <div class="text-txt dark:text-dtxt">
    <img src="${memory.photoUrl}" alt="${memory.title ?? ''}" style="width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />
    <div style="padding:0 5px 2px">
      <h3 class="text-txt dark:text-dtxt" style="font-weight:700;font-size:1.1rem;line-height:1.3;margin:0 0 6px">${memory.title ?? ''}</h3>
      <p class="text-txt2 dark:text-dtxt2" style="font-size:0.85rem;margin:0">${memory.location?.address ?? ''}</p>
    </div>
  </div>
`;

const MapView = ({
  friendMemories,
  memories,
  addingMode = false,
  onMapClick,
  pendingPosition = null,
  onPendingPositionChange,
}) => {
  const { dark } = useTheme();
  const { homePosition } = useHome();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map()); // key -> maplibregl.Marker
  const homeMarkerRef = useRef(null);
  const pendingMarkerRef = useRef(null);
  const clickHandlerRef = useRef(onMapClick);
  const addingModeRef = useRef(addingMode);
  const pendingChangeRef = useRef(onPendingPositionChange);
  // Flips true once the *current* map instance has actually loaded its style. Marker
  // effects key off this (a state, not just the ref) so they reliably re-run against
  // whichever map instance survives — under React 18 StrictMode's dev-only double-invoke
  // of effects, the map is created, destroyed, and recreated once on mount, and adding
  // markers to a not-yet-ready instance (or one about to be torn down) can leave them
  // positioned using a stale transform, i.e. invisible until the next pan/zoom.
  const [mapReady, setMapReady] = useState(false);

  clickHandlerRef.current = onMapClick;
  addingModeRef.current = addingMode;
  pendingChangeRef.current = onPendingPositionChange;

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: PITCH,
      bearing: BEARING,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("click", (e) => {
      if (addingModeRef.current && clickHandlerRef.current) {
        clickHandlerRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    map.on("load", () => {
      map.resize();
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Recenter when the home position resolves.
  useEffect(() => {
    if (!mapRef.current || !mapReady || !homePosition) return;
    mapRef.current.flyTo({ center: [homePosition.lng, homePosition.lat], zoom: 12, pitch: PITCH, bearing: BEARING, essential: true });
  }, [homePosition, mapReady]);

  // Home marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (homeMarkerRef.current) {
      homeMarkerRef.current.remove();
      homeMarkerRef.current = null;
    }
    if (homePosition) {
      homeMarkerRef.current = new maplibregl.Marker({ element: homeMarkerEl(), anchor: "bottom" })
        .setLngLat([homePosition.lng, homePosition.lat])
        .addTo(map);
    }
  }, [homePosition, mapReady]);

  // Placeholder pin for the memory currently being placed — draggable, so the user can
  // nudge the exact spot without recliking the whole map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!pendingPosition) {
      if (pendingMarkerRef.current) {
        pendingMarkerRef.current.remove();
        pendingMarkerRef.current = null;
      }
      return;
    }

    if (!pendingMarkerRef.current) {
      const marker = new maplibregl.Marker({ element: pendingPinEl(), anchor: "bottom", draggable: true })
        .setLngLat([pendingPosition.lng, pendingPosition.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        pendingChangeRef.current?.({ lat, lng });
      });
      pendingMarkerRef.current = marker;
    } else {
      pendingMarkerRef.current.setLngLat([pendingPosition.lng, pendingPosition.lat]);
    }
  }, [pendingPosition, mapReady]);

  // Existing pins fade back while a new one is being placed, so the pending pin reads as
  // the thing currently in focus.
  useEffect(() => {
    for (const marker of markersRef.current.values()) {
      marker.getElement().style.opacity = addingMode ? "0.45" : "1";
    }
  }, [addingMode, memories, friendMemories]);

  // Memory + friend markers — diffed against the previous set so existing pins don't
  // flicker (remove/re-add) on every unrelated re-render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const nextKeys = new Set();

    const upsert = (key, lngLat, buildEl, popupContent) => {
      nextKeys.add(key);
      if (markersRef.current.has(key)) return;

      const el = buildEl();
      el.style.opacity = addingModeRef.current ? "0.45" : "1";
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(lngLat).addTo(map);
      if (popupContent) {
        const popup = new maplibregl.Popup({ offset: 40, maxWidth: "250px", className: "echoes-popup" }).setHTML(popupContent);
        marker.setPopup(popup);
      }
      markersRef.current.set(key, marker);
    };

    memories.forEach((memory) => {
      if (!memory.location?.coordinates) return;
      const [lng, lat] = memory.location.coordinates;
      upsert(`memory-${memory._id}`, [lng, lat], () => memoryMarkerEl(memory), popupHtml(memory));
    });

    friendMemories.forEach((people) =>
      people.memories.forEach((memory) => {
        if (!memory.location?.coordinates) return;
        const [lng, lat] = memory.location.coordinates;
        const accent = getHexFromUserId(people.userId);
        upsert(`friend-${people.userId}-${memory._id}`, [lng, lat], () => friendMarkerEl(memory, people.user?.profilePic, accent), popupHtml(memory));
      })
    );

    // Remove markers that are no longer present.
    for (const [key, marker] of markersRef.current) {
      if (!nextKeys.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    }
  }, [memories, friendMemories, mapReady]);

  return (
    <div className={`relative h-full w-full ${dark ? "map-dark-filter" : ""}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default MapView;
