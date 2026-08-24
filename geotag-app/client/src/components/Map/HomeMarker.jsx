import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useEffect,useRef } from "react";
import gsap from "gsap";

/*
iconAnchor is the pixel inside the image that sits exactly on the coordinate — for a pin,
that must be the visual tip, or the pin points at the wrong place.

homepin.png is 500x500 and its tip is the bottom-left corner of the house shape, at roughly
(85, 455) in source pixels. Scaled to the 60x60 render size that's (85/500)*60 ≈ 10 and
(455/500)*60 ≈ 55.

It was previously [15, 40] — the y being 15px short meant the pin floated above the location
it was marking, most visible when zoomed in.
*/
const homeMarkerIcon = new L.Icon({
  iconUrl: "/homepin.png", // path relative to public folder
  iconRetinaUrl: "/homepin.png", // optional, can be same
  iconSize: [60, 60], // adjust size to fit your image
  iconAnchor: [10, 55], // the tip of the pin graphic, in 60x60 render space
  popupAnchor: [20, -50], // opens above and right of the tip, over the body of the pin
});

  



const HomeMarker = ({ position }) => {
  //home pin load-in animation 
   useEffect(() => {
    if (!markerRef.current) return;

    const el = markerRef.current._icon; // actual DOM element of the marker

    // set initial scale to 0 (hidden)
    gsap.set(el, { scale: 0, transformOrigin: "center" });

    // animate pop-in: scale up then shrink to normal
    gsap.to(el, {
      scale: 1.5,
      duration: 0.4,
      ease: "power2.out",
      onComplete: () => {
        gsap.to(el, { scale: 1, duration: 0.3, ease: "back.out(3)" });
      },
    });
  }, [position]);

   const markerRef = useRef(null);
  return (
    <Marker ref={markerRef} position={[position.lat, position.lng]} icon={homeMarkerIcon} zIndexOffset={1000}>
      
    </Marker>
  );
};

export default HomeMarker;
