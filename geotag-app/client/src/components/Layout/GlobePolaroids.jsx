import { useEffect, useRef, useCallback } from 'react';
import createGlobe from 'cobe';

/*
A WebGL globe (cobe) with polaroid cards pinned to city markers.

Ported from the 21st.dev "Globe Polaroids" component by @shuding (MIT), keeping its structure:
a ResizeObserver-gated init, an external requestAnimationFrame loop driving globe.update(),
drag-to-rotate that pauses the spin, and a fade-in once the first frame exists.

One deliberate departure. The original anchors each polaroid with CSS anchor positioning
(`position-anchor` / `anchor()`), which only Chromium supports today — in Firefox and Safari
the cards fall back to static position and pile up in one corner. So they are positioned in JS
instead, using cobe's own projection maths read out of dist/index.esm.js:

    U([lat, lng]) -> [-cos(lat)cos(lng-PI), sin(lat), cos(lat)sin(lng-PI)]   (unit sphere)
    O(p)          -> screen x from cos(phi)p.x + sin(phi)p.z, y from the theta tilt, and a
                     depth term giving which side of the globe the point is on

GLOBE_RADIUS mirrors cobe's internal `ee = .8`; markers and cards drift apart if it stops
matching.
*/

const GLOBE_RADIUS = 0.8;
const DEG = Math.PI / 180;
const BASE_THETA = 0.2;

/*
Where the globe starts, solved rather than eyeballed: screen x is cos(phi)p.x + sin(phi)p.z,
so centring a point means phi = atan2(-p.x, p.z), taking the root whose depth is positive.
This value puts India facing the viewer on load; the spin carries it round from there.
*/
const START_PHI = 3.4404;

/*
Marker colours, as 0..1 RGB triples the way cobe wants them. Every marker used to take the
single global `markerColor`, so the whole globe was orange; these cycle instead.
*/
const ORANGE = [0.988, 0.608, 0.255]; // #fc9b41
const BLUE = [0.188, 0.635, 1.0]; //     #30a2ff
const PINK = [0.835, 0.341, 0.89]; //    #d557e3

const rgba = ([r, g, b], a) => `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;

/*
One pin per continent rather than a cluster. Spreading them is also what makes a continuously
rotating globe work: cities packed into one region all cross the limb together and leave the
panel empty for half of every turn, whereas these are far enough apart that something is
always on the near side.
*/
const PLACES = [
  { id: 'mumbai', location: [19.076, 72.8777], photo: '/marine-drive.jpg', caption: 'Marine Drive', rotate: -5, stem: 14, color: ORANGE },
  { id: 'paris', location: [48.8566, 2.3522], photo: '/paris.jpg', caption: 'Paris', rotate: 4, stem: 14, color: BLUE },
  { id: 'sanfrancisco', location: [37.77, -122.42], photo: '/golden-gate.jpg', caption: 'Golden Gate', rotate: -3, stem: 14, color: PINK },
  { id: 'rio', location: [-22.9068, -43.1729], photo: '/rio.jpg', caption: 'Rio de Janeiro', rotate: -4, stem: 14, color: ORANGE },
  { id: 'sydney', location: [-33.87, 151.21], photo: '/sydney-opera.jpg', caption: 'Sydney Harbour', rotate: 5, stem: 14, color: BLUE },
];

const MARKERS = PLACES.map((p) => ({ location: p.location, size: p.photo ? 0.075 : 0.045, id: p.id, color: p.color }));
const CARDS = PLACES.filter((p) => p.photo);

/*
Mirrors cobe's U() then O(): normalised 0..1 canvas coords plus a depth term.

`scale` is cobe's own `scale` option (the B term in its shader), which multiplies the
projected coordinates: x = ((sx / aspect) * B + 1) / 2, y = (-sy * B + 1) / 2. It has to be
applied here too or the cards keep the unscaled positions and drift off their markers the
moment the globe is zoomed.
*/
const project = (lat, lng, phi, theta, aspect, scale) => {
  const latR = lat * DEG;
  const lngR = lng * DEG - Math.PI;
  const c = Math.cos(latR);

  const px = -c * Math.cos(lngR) * GLOBE_RADIUS;
  const py = Math.sin(latR) * GLOBE_RADIUS;
  const pz = c * Math.sin(lngR) * GLOBE_RADIUS;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  const sx = cosP * px + sinP * pz;
  const sy = sinP * sinT * px + cosT * py - cosP * sinT * pz;
  const depth = -sinP * cosT * px + sinT * py + cosP * cosT * pz;

  return { x: ((sx / aspect) * scale + 1) / 2, y: (-sy * scale + 1) / 2, depth };
};

const GlobePolaroids = ({ className = '', speed = 0.0016, scale = 1.02 }) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const cardRefs = useRef([]);

  const pointerInteracting = useRef(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);

  const handlePointerDown = useCallback((e) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    isPausedRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    isPausedRef.current = false;
  }, []);

  // Drag tracking lives on the window so a drag that leaves the canvas still ends cleanly.
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        };
      }
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerUp]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let globe = null;
    let animationId = 0;
    let phi = START_PHI;
    let width = 0;
    let height = 0;

    const placeCards = (currentPhi, currentTheta) => {
      const aspect = width / height;
      for (let i = 0; i < CARDS.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const { x, y, depth } = project(CARDS[i].location[0], CARDS[i].location[1], currentPhi, currentTheta, aspect, scale);

        // Fade and blur across the limb rather than popping at exactly depth 0, so a card
        // rotating away dissolves instead of blinking off.
        const t = Math.max(0, Math.min(1, depth / (GLOBE_RADIUS * 0.42)));
        el.style.left = `${x * 100}%`;
        el.style.top = `${y * 100}%`;
        el.style.opacity = String(t);
        el.style.filter = `blur(${((1 - t) * 8).toFixed(2)}px)`;
        el.style.transform =
          `translate(-50%, calc(-100% - ${CARDS[i].stem}px)) rotate(${CARDS[i].rotate}deg) scale(${0.86 + 0.14 * t})`;
        // A card on the far side must not intercept the pointer while invisible.
        el.style.visibility = t < 0.02 ? 'hidden' : 'visible';
      }
    };

    /*
    Init is gated on a real measurement. Reading offsetWidth straight out of an effect can land
    before the flex parent has sized this box, in which case the globe is built for a zero- or
    wrong-sized viewport and only reappears once something forces a resize — which is exactly
    the "only visible after I resize the window" symptom.
    */
    const init = () => {
      width = wrap.offsetWidth;
      height = wrap.offsetHeight;
      if (!width || !height || globe) return;

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height,
        phi,
        theta: BASE_THETA,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.28, 0.28, 0.33],
        markerColor: [0.98, 0.45, 0.09],
        glowColor: [0.14, 0.14, 0.17],
        markerElevation: 0,
        opacity: 0.95,
        scale,
        markers: MARKERS,
      });

      const animate = () => {
        if (!isPausedRef.current && !reduced) phi += speed;
        const nextPhi = phi + phiOffsetRef.current + dragOffset.current.phi;
        const nextTheta = BASE_THETA + thetaOffsetRef.current + dragOffset.current.theta;
        globe.update({ phi: nextPhi, theta: nextTheta });
        placeCards(nextPhi, nextTheta);
        animationId = requestAnimationFrame(animate);
      };
      animate();

      // Place once immediately as well: cobe draws its first frame synchronously, so a card
      // positioned only from the loop is unplaced until the first tick — and stays unplaced
      // for as long as that loop is throttled, as in a background tab.
      placeCards(phi, BASE_THETA);
      canvas.style.opacity = '1';
    };

    const observer = new ResizeObserver(() => {
      if (!globe) {
        init();
        return;
      }
      width = wrap.offsetWidth;
      height = wrap.offsetHeight;
      if (width && height) globe.update({ width, height });
    });
    observer.observe(wrap);
    init();

    return () => {
      observer.disconnect();
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
    };
  }, [speed, scale]);

  return (
    <div ref={wrapRef} className={`relative select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="h-full w-full"
        style={{ cursor: 'grab', opacity: 0, transition: 'opacity 1.2s ease', touchAction: 'none' }}
      />

      {CARDS.map((place, i) => (
        <div
          key={place.id}
          ref={(el) => (cardRefs.current[i] = el)}
          // Hidden below 900px: the visual band is ~320px tall there and a pinned card, stem
          // included, does not fit above its city without being cut off by the panel.
          className="pointer-events-none absolute left-1/2 top-1/2 will-change-transform max-[900px]:hidden"
          style={{ opacity: 0, transformOrigin: 'bottom center' }}
        >
          <div className="bg-[#fdfcf9] p-[6px] pb-[17px] shadow-[0_12px_30px_rgba(0,0,0,.65)]">
            <img src={place.photo} alt="" className="block h-[68px] w-[68px] object-cover" />
            <div className="mt-[6px] text-center text-[8px] font-semibold leading-none text-[#3a3a3a]">
              {place.caption}
            </div>
          </div>
          {/* Stem running down to the marker, tinted to match that marker's colour. */}
          <div
            className="mx-auto w-px"
            style={{
              height: place.stem,
              background: `linear-gradient(to bottom, ${rgba(place.color, 0.75)}, ${rgba(place.color, 0.15)})`,
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default GlobePolaroids;
