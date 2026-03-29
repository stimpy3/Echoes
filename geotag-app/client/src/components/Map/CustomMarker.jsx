import { Marker, Popup } from "react-leaflet";
import {MapPin} from 'lucide-react';
import L from "leaflet";
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const CustomMarker = ({ memory, onClick, isExiting = false, shouldAnimateIn = true }) => {
  const markerRef = useRef(null);

  const customIcon = L.divIcon({
    className: "", // removes default leaflet marker styles
    html: `
    <div class="w-[70px] h-[70px] relative hover:scale-[1.1] transition-all duration-200">
       <div class="relative z-20 w-16 h-16 rounded-lg border-[2px] border-dmain bg-gray-500 dark:border-main  bg-cover bg-center"
         style="background-image: url('${memory.photoUrl}')">
      </div>
      <div class="z-10 absolute right-[50%] translate-x-[20%] shadow-md bottom-0 w-3 rotate-45 aspect-square bg-dmain dark:bg-main"></div>
    </div>
    `,
    iconSize: [64, 64],
    iconAnchor: [32, 64], // bottom of marker aligns with location
    popupAnchor: [0, -70], // popup offset above marker
  });

  useEffect(() => {
    if (!shouldAnimateIn) return;

    let rafId;

    const playEnter = () => {
      const el = markerRef.current?.getElement?.();
      if (!el) {
        rafId = requestAnimationFrame(playEnter);
        return;
      }

      gsap.killTweensOf(el);
      gsap.fromTo(
        el,
        { scale: 0.2, opacity: 0, transformOrigin: "50% 100%" },
        { scale: 1, opacity: 1, duration: 0.42, ease: "back.out(1.8)" }
      );
    };

    playEnter();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      const el = markerRef.current?.getElement?.();
      if (el) gsap.killTweensOf(el);
    };
  }, [shouldAnimateIn]);

  useEffect(() => {
    if (isExiting || shouldAnimateIn) return;

    let rafId;

    const ensureVisible = () => {
      const el = markerRef.current?.getElement?.();
      if (!el) {
        rafId = requestAnimationFrame(ensureVisible);
        return;
      }

      gsap.killTweensOf(el);
      gsap.set(el, {
        scale: 1,
        opacity: 1,
        transformOrigin: "50% 100%",
      });
    };

    ensureVisible();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isExiting, shouldAnimateIn]);

  useEffect(() => {
    if (!isExiting) return;

    const el = markerRef.current?.getElement?.();
    if (!el) return;

    gsap.killTweensOf(el);
    gsap.to(el, {
      scale: 0.15,
      opacity: 0,
      duration: 0.24,
      ease: "power2.in",
      transformOrigin: "50% 100%",
    });
  }, [isExiting]);

  return (
    <Marker
      ref={markerRef}
      position={[
        memory.location.coordinates[1],
        memory.location.coordinates[0],
      ]}
      icon={customIcon}
      eventHandlers={{ click: onClick }}
    >
      {!onClick && (
        <Popup maxWidth={250} keepInView={true} autoPanPadding={[20, 70]}>
          <div>
            <img
              src={memory.photoUrl}
              alt={memory.title}
              className="w-full h-40 object-cover rounded-lg mb-2"
            />

            <div className="px-[5px]">
              <h3 className="font-bold text-lg">{memory.title}</h3>
              <p className="text-sm my-[10px]">{memory.description}</p> 
              <p className="text-xs text-gray-500 flex items-center justify-center"><div className="scale-[0.8]"><MapPin/></div> {memory.location.address}</p>
            </div>

          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default CustomMarker;
