import { Marker, Popup } from "react-leaflet";
import {MapPin} from 'lucide-react';
import L from "leaflet";
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const CustomMarker = ({ memory, onClick, isExiting = false, shouldAnimateIn = true }) => {
  const markerRef = useRef(null);

  /*
  Geometry notes — the previous version had two mismatches that made pins sit slightly off
  from the coordinate they mark:

  1. iconSize was [64,64] but the HTML root was 70x70. Leaflet positions using iconSize, so
     the extra 6px was unaccounted for. Both are 64 wide / 70 tall now (64 photo + 6 tail),
     and iconAnchor is [32, 70] — horizontally centred, vertically at the tail's tip, which
     is the point that should land on the coordinate.

  2. The tail used `right-[50%] translate-x-[20%]`, which is not centred: right:50% puts its
     RIGHT edge at the midpoint, then shifts it back by 20% of its own (12px) width — about
     2.4px — leaving it ~3.6px left of centre. `left-1/2 -translate-x-1/2` is the actual
     centring idiom and is exact at any size.

  Also added a drop shadow on the photo itself (previously only the tail had one, so the
  card looked flat against the map) and a ring that picks up the theme, so pins stay legible
  over both light and dark basemap tiles.
  */
  const customIcon = L.divIcon({
    className: "", // removes default leaflet marker styles
    html: `
    <div class="w-16 h-[70px] relative hover:scale-[1.08] transition-transform duration-200 origin-bottom">
      <div class="relative z-20 w-16 h-16 rounded-lg border-[2px] border-dmain dark:border-main bg-gray-500 bg-cover bg-center shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        style="background-image: url('${memory.photoUrl}')">
      </div>
      <div class="z-10 absolute left-1/2 -translate-x-1/2 bottom-0 w-3 aspect-square rotate-45 bg-dmain dark:bg-main shadow-[0_2px_4px_rgba(0,0,0,0.25)]"></div>
    </div>
    `,
    iconSize: [64, 70],
    iconAnchor: [32, 70], // horizontally centred; vertically at the tail tip
    popupAnchor: [0, -72], // just above the photo, clear of the tail
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

            <div className="px-[5px] pb-[2px]">
              <h3 className="font-bold text-lg leading-snug">{memory.title}</h3>
              <p className="text-sm my-[10px]">{memory.description}</p>
              {/* Was <div> nested inside <p> — invalid HTML, so the browser auto-closed the
                  <p> before the div and the flex row never applied, leaving the icon and
                  address on separate lines. <span> is valid inside <p> and keeps the row.
                  items-start + shrink-0 so a long address wraps beside the pin rather than
                  squashing it. */}
              <p className="text-xs text-gray-500 flex items-start gap-1">
                <span className="shrink-0 mt-[1px]"><MapPin size={13} /></span>
                <span>{memory.location.address}</span>
              </p>
            </div>

          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default CustomMarker;
