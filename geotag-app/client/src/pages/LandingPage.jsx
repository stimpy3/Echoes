import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import SplitText from '../components/Layout/SplitText';
import Aurora from '../components/Layout/Aurora';
import RetroGrid from '../components/Layout/RetroGrid';
import WarpBackground from '../components/Layout/WarpBackground';
import InteractiveGridPattern from '../components/Layout/InteractiveGridPattern';
import '../styles/landing.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/*
Public marketing landing page — the first screen a logged-out visitor sees, mounted at "/".

Three things about this file that are deliberate:

1. It holds NO state and makes NO requests. Every "map", "timeline" and "chat" here is a
   static demonstration built from public/ assets, not a live component. The real map is a
   WebGL context and a tile bill; the pins below are placed at fixed artboard pixels, so a
   pannable basemap underneath them would put photos on arbitrary coordinates — worse than
   the grid stand-in, not better.

2. It is dark-only and does not participate in ThemeContext, so colours are literal hex
   rather than the light/dark token pairs used everywhere else in the app.

3. Section 04 is Search, not Explore. The handoff drew an Explore feed, but that page was
   removed when the product became a private diary — advertising it would link to a 404.
   The slot keeps the same four-up grid device with copy that describes what actually ships.
*/

/*
Nineteen scenes and four portraits, so no photo has to stand in for more than a couple of
things. The five originals are the ones already in public/ from the auth screens; the rest
were added for this page. Avatars are portraits — reusing a landscape as a 26px round avatar
is what made the earlier version look like placeholder art.
*/
const IMG = {
  // originals
  street: '/Street%20Food.png', // the file on disk has a space in its name
  bandra: '/BandraBandStandWalk.jpg',
  sanjay: '/sanjay-gandhi-national-park.webp',
  // added
  gatewaySunset: '/gateway-sunset.jpg',
  monsoon: '/mumbai-monsoon.jpg',
  gatewayHarbour: '/gateway-harbour.jpg',
  marineDrive: '/marine-drive.jpg',
  tajMahal: '/taj-mahal.jpg',
  tajArchway: '/taj-archway.jpg',
  indiaGate: '/india-gate.jpg',
  goaResort: '/goa-resort.jpg',
  goaBeach: '/goa-beach.jpg',
  samosas: '/samosas.jpg',
  hawaMahal: '/hawa-mahal.jpg',
  victoria: '/victoria-memorial.jpg',
  ghats: '/western-ghats.jpg',
  mysore: '/mysore-palace.jpg',
  // portraits, for avatars only
  priya: '/avatar-priya.jpg',
  rohan: '/avatar-rohan.jpg',
};

/* Horizontal page padding: 56px, tightening at the two breakpoints in the handoff. */
const PAGE_X = 'px-14 max-[1199px]:px-10 max-[599px]:px-5';

/* ------------------------------------------------------------- motion primitives */

/*
Read at call time rather than cached in a module constant: the setting can change while
the tab is open, and every animation here is entered through one of the two helpers below,
so a single check keeps the whole page honest about it.
*/
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Stable object identities — SplitText lists `from`/`to` in its effect deps, so inline
   literals would re-split the heading on every render of the section that owns it. */
const SPLIT_FROM = { opacity: 0, y: 44 };
const SPLIT_TO = { opacity: 1, y: 0 };

/* Per-character reveal on every display heading. Falls back to a plain tag under
   reduced motion, since SplitText has no opinion about that itself. */
const AnimatedHeading = ({ tag = 'h2', text, className = '', align = 'left', delay = 0.022 }) => {
  if (reducedMotion()) {
    const Tag = tag;
    return (
      <Tag className={className} style={{ textAlign: align }}>
        {text}
      </Tag>
    );
  }
  return (
    <SplitText
      tag={tag}
      text={text}
      className={className}
      textAlign={align}
      splitType="chars"
      delay={delay}
      duration={0.7}
      ease="power3.out"
      from={SPLIT_FROM}
      to={SPLIT_TO}
      threshold={0.15}
    />
  );
};

/* Staggered entrance for a container's direct children, fired once on scroll-in.
   Targets children rather than wrapping them so no extra DOM lands inside grids. */
const useRevealChildren = (ref, { y = 24, stagger = 0.09, start = 'top 88%' } = {}) => {
  useGSAP(
    () => {
      if (!ref.current || reducedMotion()) return;
      gsap.from(ref.current.children, {
        opacity: 0,
        y,
        duration: 0.7,
        ease: 'power3.out',
        stagger,
        clearProps: 'transform',
        scrollTrigger: { trigger: ref.current, start, once: true },
      });
    },
    { scope: ref }
  );
};

/* ---------------------------------------------------------------- shared controls */

const PrimaryCta = ({ children = 'Create your account', className = '' }) => (
  <Link
    to="/auth?mode=signup"
    className={`inline-flex h-12 items-center rounded-[10px] bg-gradient-mainBright px-[26px] text-[15px]
                font-semibold text-white transition-[filter] duration-150 hover:brightness-110 ${className}`}
  >
    {children}
  </Link>
);

const SecondaryCta = ({ children = 'Log in', className = '' }) => (
  <Link
    to="/auth"
    className={`inline-flex h-12 items-center rounded-[10px] border border-white/[.28] px-[26px] text-[15px]
                font-medium text-white transition-colors duration-150 hover:border-white/50 ${className}`}
  >
    {children}
  </Link>
);

const SectionHeader = ({ eyebrow, title, blurb, className = '' }) => (
  <div
    className={`flex items-end justify-between gap-12 ${PAGE_X} max-[899px]:flex-col
                max-[899px]:items-start max-[899px]:gap-4 ${className}`}
  >
    <div className="max-w-[620px]">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.16em] text-[#6a6a6a]">{eyebrow}</div>
      <AnimatedHeading
        text={title}
        className="archivo text-[38px] leading-[1.1] tracking-[-.025em] text-white max-[1199px]:text-[32px] max-[599px]:text-[26px]"
      />
    </div>
    <p className="max-w-[400px] text-[15px] leading-[1.62] text-[#a0a0a0]">{blurb}</p>
  </div>
);

/* ------------------------------------------------------- 0. fixed auth controls */

/*
No navbar. The two auth links float fixed in the top-right corner over whatever is behind
them, so the hero reads full-bleed with nothing boxing it in at the top. Section ids are
kept even though nothing links to them any more — they still make the page deep-linkable.
*/
const AuthCorner = () => (
  <div className={`fixed right-0 top-0 z-[60] flex items-center gap-5 py-5 ${PAGE_X}`}>
    <Link
      to="/auth"
      className="text-[13.5px] text-white/90 transition-colors duration-150 hover:text-white
                 [text-shadow:0_1px_10px_rgba(0,0,0,.55)]"
    >
      Log in
    </Link>
    <Link
      to="/auth?mode=signup"
      className="inline-flex h-[34px] items-center rounded-lg bg-white px-4 text-[13px] font-semibold
                 text-[#0b0b0b] shadow-[0_4px_18px_rgba(0,0,0,.4)] transition-[filter] duration-150
                 hover:brightness-[.94]"
    >
      Create account
    </Link>
  </div>
);

/* --------------------------------------------------------------------- 1. hero */

const POLAROIDS = [
  {
    src: IMG.gatewaySunset,
    alt: 'Gateway of India at sunset',
    pos: 'left-[74px] bottom-[52px] max-[899px]:left-[-22px] max-[899px]:bottom-[40px]',
    rotate: -7,
    large: true,
    pin: ['#ffd9a8', '#fc9b41', '#c56a15'],
    delay: '.55s',
  },
  {
    src: IMG.hawaMahal,
    alt: 'Hawa Mahal, Jaipur',
    pos: 'left-[296px] bottom-[30px]',
    rotate: 5,
    large: false,
    pin: ['#f4c8ff', '#d557e3', '#8f2ea0'],
    delay: '.85s',
    // Inner cards collide with the copy block once the artboard crops in.
    hideSmall: true,
  },
  {
    src: IMG.goaBeach,
    alt: 'Beach in Goa',
    pos: 'right-[296px] bottom-[34px]',
    rotate: -5,
    large: false,
    pin: ['#c3f6fa', '#3ed8e3', '#1a8b95'],
    delay: '1s',
    hideSmall: true,
  },
  {
    src: IMG.marineDrive,
    alt: 'Marine Drive, Mumbai',
    pos: 'right-[70px] bottom-[56px] max-[899px]:right-[-22px] max-[899px]:bottom-[44px]',
    rotate: 8,
    large: true,
    pin: ['#fff2c9', '#fdfcf9', '#b9b5ab'],
    delay: '.7s',
  },
];

const Polaroid = ({ src, alt, pos, rotate, large, pin, delay, hideSmall }) => {
  const photo = large ? 168 : 148;
  const head = large ? 19 : 17;
  return (
    // The rotation lives here; the pop animation lives on the child. Sharing an element
    // would let the animated transform overwrite the rotate.
    <div
      className={`absolute ${pos} ${hideSmall ? 'max-[899px]:hidden' : ''}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="echoes-pop" style={{ animationDelay: delay }}>
        <div
          className="relative bg-[#fdfcf9] shadow-[0_22px_44px_rgba(0,0,0,.55)]"
          style={{ padding: large ? '10px 10px 34px' : '9px 9px 30px' }}
        >
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-full shadow-[0_3px_7px_rgba(0,0,0,.6)]"
            style={{
              top: large ? -9 : -8,
              width: head,
              height: head,
              background: `radial-gradient(circle at 34% 30%, ${pin[0]}, ${pin[1]} 62%, ${pin[2]})`,
            }}
          />
          <img
            src={src}
            alt={alt}
            className="block object-cover max-[899px]:!h-[140px] max-[899px]:!w-[140px]"
            style={{ width: photo, height: photo }}
          />
        </div>
      </div>
    </div>
  );
};

const Hero = () => (
  <header className="relative flex h-[700px] items-center justify-center overflow-hidden max-[899px]:h-auto max-[899px]:min-h-[760px]">
    {/* Ground, back to front: page colour, the aurora glow, then the retro grid drawn over
        it so the lattice reads against the light rather than being washed out beneath it.
        Together these replace the flat grid.png bitmap the hero used to sit on. */}
    <div className="absolute inset-0 bg-[#0b0b0b]" />
    <div className="absolute inset-0">
      <Aurora colorStops={['#F97316', '#EC4899', '#3B82F6']} amplitude={1.1} blend={0.55} speed={0.7} />
    </div>
    <RetroGrid angle={70} cellSize={56} opacity={0.9} animate={false} />
    <div
      className="absolute inset-0"
      style={{ background: 'linear-gradient(180deg, rgba(11,11,11,.3), rgba(11,11,11,.05) 40%, rgba(11,11,11,.92))' }}
    />

    {/* pin board — a fixed 1280px artboard, centred so it crops evenly rather than reflowing */}
    <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[1280px] -translate-x-1/2
                    max-[899px]:left-0 max-[899px]:w-full max-[899px]:translate-x-0">
      {POLAROIDS.map((p) => (
        <Polaroid key={p.src} {...p} />
      ))}
    </div>

    {/* copy */}
    <div className={`relative z-10 w-[680px] max-w-full pb-[140px] text-center max-[899px]:pb-[210px] max-[899px]:pt-24 ${PAGE_X}`}>
      <AnimatedHeading
        tag="h1"
        align="center"
        delay={0.03}
        text="Moments made timeless."
        className="text-[64px] font-bold leading-[1.06] tracking-[-.035em] text-white max-[1199px]:text-[52px] max-[899px]:text-[40px] max-[599px]:text-[34px]"
      />
      <p
        className="echoes-rise mx-auto mt-5 max-w-[470px] text-[17px] leading-[1.6] text-[#b9b7b3]"
        style={{ animationDelay: '.32s', textWrap: 'pretty' }}
      >
        A journal with coordinates. Pin a photo to the place and the day it happened, and your camera roll
        becomes a map you can walk.
      </p>
      <div
        className="echoes-rise mt-[30px] flex flex-wrap items-center justify-center gap-[10px]"
        style={{ animationDelay: '.4s' }}
      >
        <PrimaryCta />
        <SecondaryCta />
      </div>
    </div>
  </header>
);

/* ---------------------------------------------------------- 2. statement + numbers */

const STATS = [
  ['Memories pinned', '148'],
  ['Places · cities', '37 · 4'],
  ['Trips grouped', '7'],
  ['Busiest month', 'JUN'],
];

const Statement = () => {
  const statsRef = useRef(null);
  useRevealChildren(statsRef, { y: 16, stagger: 0.1 });

  return (
  <section className={`grid grid-cols-[1fr_380px] items-start gap-20 pb-[76px] pt-[88px] ${PAGE_X} max-[899px]:grid-cols-1 max-[899px]:gap-10`}>
    <p className="text-[26px] leading-[1.45] tracking-[-.01em] text-[#e8e6e1]" style={{ textWrap: 'pretty' }}>
      Most apps treat location as a grey line under a caption. In Echoes the place and the date{' '}
      <span className="text-[#8a8a8a]">are</span> the memory — which is what makes a map, a timeline and a trip
      possible at all.
    </p>
    <div ref={statsRef}>
      {STATS.map(([label, value], i) => (
        <div
          key={label}
          className={`flex items-baseline justify-between py-3 ${i < STATS.length - 1 ? 'border-b border-[#1e1e1e]' : ''}`}
        >
          <span className="text-[13px] text-[#8a8a8a]">{label}</span>
          <span className="archivo text-[19px] text-white">{value}</span>
        </div>
      ))}
    </div>
  </section>
  );
};

/* ----------------------------------------------------------------- 3. map band */

/*
Artboard pixel positions for >=900px. Below that the board is viewport-width, so the own
pins fall back to percentages — the band's height changes at that breakpoint too, and a
percentage keeps them inside it without a third set of numbers.
*/
const OWN_PINS = [
  { src: IMG.goaResort, pos: 'left-[196px] top-[412px] max-[899px]:left-[6%] max-[899px]:top-[56%]' },
  { src: IMG.samosas, pos: 'left-[392px] top-[318px] max-[899px]:left-[38%] max-[899px]:top-[26%]' },
  { src: IMG.ghats, pos: 'left-[812px] top-[232px] max-[899px]:left-[70%] max-[899px]:top-[60%]' },
];

const FRIEND_PINS = [
  { src: IMG.mysore, left: 1002, top: 400, color: '#fc9b41' },
  { src: IMG.bandra, left: 664, top: 472, color: '#3ed8e3' },
];

const LEGEND = [
  { dot: '#ffffff', label: 'You · 148', strong: true },
  { dot: '#fc9b41', label: 'Priya · 12' },
  { dot: '#3ed8e3', label: 'Rohan · 8' },
];

const MapSection = () => (
  <section id="f-map" className="pb-24">
    <SectionHeader
      className="pb-7"
      eyebrow="01 · Map"
      title="Your memories, where they happened"
      blurb="Photo pins at real coordinates. Friends you follow appear in their own colour, so you can see whose evening happened on which street."
    />
    <div className="relative h-[640px] overflow-hidden border-y border-[#1e1e1e] bg-[#0d0d0d] max-[899px]:h-[420px] max-[599px]:h-[280px]">
      {/* Basemap stand-in. See the file header for why this is not a live map — but the
          lattice itself is live: cells light up under the cursor, so the band responds like a
          map surface without any of the cost of one. */}
      <InteractiveGridPattern width={80} height={80} squares={[20, 9]} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(90% 70% at 42% 46%, transparent, rgba(11,11,11,.72))' }}
      />

      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[1280px] -translate-x-1/2
                      max-[899px]:left-0 max-[899px]:w-full max-[899px]:translate-x-0">
        {OWN_PINS.map(({ src, pos }) => (
          <div key={pos} className={`absolute w-[70px] rounded-[10px] bg-gradient-main p-1 ${pos}`}>
            <img src={src} alt="" className="h-[62px] w-full rounded-[7px] object-cover" />
            <span className="absolute bottom-[-6px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#d557e3]" />
          </div>
        ))}
        {FRIEND_PINS.map(({ src, left, top, color }) => (
          <div
            key={src + top}
            className="absolute w-14 rounded-[9px] p-[3px] max-[899px]:hidden"
            style={{ left, top, background: color }}
          >
            <img src={src} alt="" className="h-12 w-full rounded-[7px] object-cover" />
          </div>
        ))}

        {/* popup — the tail is a child rather than a sibling at a fixed `top`, so it stays
            pinned to the popup's bottom edge instead of drifting over the title when the
            text wraps to a different number of lines than the artboard assumed */}
        <div className="absolute left-[520px] top-[120px] w-[268px] max-[899px]:hidden">
          <div
            className="overflow-hidden rounded-[14px] border border-[#2b2b2b] shadow-[0_24px_60px_rgba(0,0,0,.6)] backdrop-blur-[10px]"
            style={{ background: 'rgba(16,16,16,.95)' }}
          >
            <img src={IMG.monsoon} alt="" className="h-[130px] w-full object-cover" />
            <div className="px-4 pb-4 pt-3.5">
              <div className="text-[14.5px] font-semibold text-white">Monsoon on DN Road</div>
              <div className="mt-1 text-[12.5px] text-[#8a8a8a]">Fort, Mumbai · 14 Jun 2026</div>
            </div>
          </div>
          <span className="absolute bottom-[-7px] left-10 h-3.5 w-3.5 rotate-45 border-b border-r border-[#2b2b2b] bg-[#101010]" />
        </div>

        {/* legend */}
        <div className="absolute left-14 top-8 flex flex-wrap gap-2 max-[1199px]:left-10 max-[599px]:left-5">
          {LEGEND.map(({ dot, label, strong }) => (
            <span
              key={label}
              className={`flex items-center gap-2 rounded-full border border-[#2b2b2b] px-[13px] py-[7px] text-[12px]
                          backdrop-blur-[10px] ${strong ? 'text-white' : 'text-[#c9c7c3]'}`}
              style={{ background: 'rgba(20,20,20,.9)' }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------- 4. timeline ruler */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Per-month memory counts. The first six sum to 132 and the year to 148, so the footnote
   the handoff specifies ("132 of 148 ... up to June") is what the scrubber lands on. */
const MONTH_COUNTS = [12, 9, 24, 14, 31, 42, 6, 3, 4, 1, 1, 1];

const RULER_PHOTOS = {
  0: { src: IMG.indiaGate, w: 86, h: 64 },
  2: { src: IMG.tajMahal, w: 112, h: 84 },
  4: { src: IMG.street, w: 96, h: 72 },
  5: { src: IMG.gatewayHarbour, w: 130, h: 100 },
  6: { src: IMG.victoria, w: 86, h: 64 },
  8: { src: IMG.tajArchway, w: 78, h: 58 },
};

const CELL = 100 / 12;
const CENTRE_OF = (i) => (i + 0.5) * CELL;
const REST_POS = 50; // where the handoff parks the playhead: the Jun/Jul boundary

/* Which month a playhead position reads as: the last month whose cell centre it has passed.
   At the 50% rest position that is June, matching the static design. */
const monthAt = (pos) => Math.max(0, Math.min(11, Math.floor(pos / CELL - 0.5)));

const MONTH_LABEL_BASE = 'flex-1 text-center transition-colors duration-300';

const monthLabelClass = (i, current) => {
  if (i === current) return 'text-[12.5px] font-bold text-white';
  if (i > current) return 'text-[12px] text-[#3a3a3a]';
  return RULER_PHOTOS[i] ? 'text-[12px] text-[#8a8a8a]' : 'text-[12px] text-[#5a5a5a]';
};

/*
The one section that earns real interactivity: scrolling past it drags the playhead from
January to June, and the year fills in behind it.

Everything the scrub touches is written straight to the DOM through refs rather than held
in React state. A scrubbed ScrollTrigger fires on every frame of scroll, and re-rendering
this subtree at that rate would also re-render the SplitText heading above it, whose
characters GSAP has already replaced in the DOM.
*/
const TimelineSection = () => {
  const rulerRef = useRef(null);
  const playheadRef = useRef(null);
  const labelRef = useRef(null);
  const footnoteRef = useRef(null);
  const monthRefs = useRef([]);
  const photoRefs = useRef([]);

  useGSAP(
    () => {
      let lastMonth = -1;

      // Continuous part: runs every frame. Discrete part: only when the month actually changes.
      const apply = (pos) => {
        playheadRef.current.style.left = `calc(${pos}% - 1px)`;
        labelRef.current.style.left = `calc(${pos}% - 42px)`;

        const month = monthAt(pos);
        if (month === lastMonth) return;
        lastMonth = month;

        labelRef.current.textContent = `${MONTHS[month].toUpperCase()} 2026`;
        monthRefs.current.forEach((el, i) => {
          if (el) el.className = `${MONTH_LABEL_BASE} ${monthLabelClass(i, month)}`;
        });

        const cumulative = MONTH_COUNTS.slice(0, month + 1).reduce((a, b) => a + b, 0);
        footnoteRef.current.textContent =
          `Showing ${cumulative} of 148 memories — everything up to ${MONTHS[month]} 2026`;

        /*
        Written as plain style properties and eased by a CSS transition rather than a GSAP
        tween. These are states, not motion — if the ticker ever stalls mid-tween the photos
        would be left at the wrong opacity, whereas a direct write is always correct on the
        next paint. It matches how the month labels below are handled.
        */
        photoRefs.current.forEach((el, i) => {
          if (!el) return;
          const arrived = i <= month;
          el.style.opacity = arrived ? '1' : '0.28';
          el.style.transform = arrived ? 'scale(1)' : 'scale(0.92)';
          el.style.boxShadow = i === month ? '0 18px 40px rgba(0,0,0,.5)' : 'none';
        });
      };

      if (reducedMotion()) {
        apply(REST_POS);
        return;
      }

      apply(CENTRE_OF(0));
      ScrollTrigger.create({
        trigger: rulerRef.current,
        start: 'top 82%',
        end: 'top 28%',
        scrub: 0.5,
        onUpdate: (self) => apply(CENTRE_OF(0) + self.progress * (REST_POS - CENTRE_OF(0))),
      });
    },
    { scope: rulerRef }
  );

  return (
    <section id="f-time" className="pb-24">
      <SectionHeader
        className="mb-[30px]"
        eyebrow="02 · Timeline"
        title="Scrub a year and watch it come back"
        blurb="Drag the playhead and memories appear in the order they happened. Everything after the cutoff waits its turn."
      />
      {/* The padding lives on the outer element and the ruler is the positioning context, so
          the playhead's percentages measure the month row rather than the padded page width. */}
      <div className={PAGE_X}>
        <div ref={rulerRef} className="relative pt-11">
          {/* photo row — everything past the playhead is dimmed; that dimming is the whole idea */}
          <div className="flex h-[150px] items-end max-[899px]:hidden">
            {MONTHS.map((m, i) => {
              const p = RULER_PHOTOS[i];
              return (
                <div key={m} className="flex flex-1 justify-center">
                  {p && (
                    <img
                      ref={(el) => (photoRefs.current[i] = el)}
                      src={p.src}
                      alt=""
                      className="rounded-lg object-cover transition-[opacity,transform,box-shadow] duration-500 ease-out"
                      style={{ width: p.w, height: p.h, maxWidth: '100%' }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* playhead */}
          <div
            ref={playheadRef}
            className="absolute top-0 h-[298px] w-0.5 max-[899px]:h-[92px]"
            style={{ left: `calc(${REST_POS}% - 1px)`, background: 'linear-gradient(180deg, transparent, #FEAC5E 18%, #FEAC5E)' }}
          />
          <div
            ref={labelRef}
            className="absolute top-0 whitespace-nowrap rounded-full bg-[#FEAC5E] px-[11px] py-[5px] text-[11.5px] font-bold tracking-[.06em] text-[#1f1200]"
            style={{ left: `calc(${REST_POS}% - 42px)` }}
          >
            JUN 2026
          </div>

          {/* baseline + labels */}
          <div className="mt-3 h-px w-full bg-[#2b2b2b]" />
          <div className="flex pt-3.5">
            {MONTHS.map((m, i) => (
              <div
                key={m}
                ref={(el) => (monthRefs.current[i] = el)}
                className={`${MONTH_LABEL_BASE} ${monthLabelClass(i, 5)}`}
              >
                {m}
              </div>
            ))}
          </div>
          <div ref={footnoteRef} className="mt-[22px] text-[12.5px] text-[#6a6a6a]">
            Showing 132 of 148 memories — everything up to Jun 2026
          </div>
        </div>
      </div>
    </section>
  );
};

/* ----------------------------------------------------------------- 5. trips */

const TRIP_DAYS = [
  {
    day: 'Day 1',
    date: '8 Jun',
    src: IMG.gatewaySunset,
    title: 'Gateway, first evening',
    note: 'Got there just as the light went orange over the harbour.',
    place: 'Apollo Bandar, Colaba',
  },
  {
    day: 'Day 2',
    date: '9 Jun',
    src: IMG.samosas,
    title: 'Late plate on Mohammed Ali Road',
    note: 'Priya added this one — her pin, my night.',
    byline: { avatar: IMG.priya, text: 'Added by Priya · Bhendi Bazaar' },
  },
  {
    day: 'Day 3',
    date: '10 Jun',
    src: IMG.sanjay,
    title: 'Kanheri trail, 6am',
    note: 'Left before the city woke up. Worth it.',
    place: 'Borivali East',
  },
];

const TripsSection = () => {
  const daysRef = useRef(null);
  useRevealChildren(daysRef, { y: 28, stagger: 0.14 });

  return (
  <section
    id="f-trips"
    className={`grid grid-cols-[400px_1fr] items-start gap-[72px] pb-24 ${PAGE_X}
                max-[1199px]:grid-cols-[320px_1fr] max-[899px]:grid-cols-1 max-[899px]:gap-10`}
  >
    <div className="sticky top-24 max-[899px]:static">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.16em] text-[#6a6a6a]">03 · Trips</div>
      <AnimatedHeading
        text="Read a week someone else lived"
        className="archivo text-[38px] leading-[1.1] tracking-[-.025em] text-white max-[1199px]:text-[32px] max-[599px]:text-[26px]"
      />
      <p className="mt-4 text-[15px] leading-[1.62] text-[#a0a0a0]">
        A trip is a run of pins you already have, put in order. Share one and it becomes a diary two people write —
        their photos and yours, day by day.
      </p>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#1e1e1e] px-[15px] py-[13px]">
        <div className="flex">
          <img src={IMG.priya} alt="" className="h-[26px] w-[26px] rounded-full object-cover ring-[1.5px] ring-[#0b0b0b]" />
          <img
            src={IMG.rohan}
            alt=""
            className="-ml-2 h-[26px] w-[26px] rounded-full object-cover ring-[1.5px] ring-[#0b0b0b]"
          />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white">South Bombay week</div>
          <div className="text-[12px] text-[#757575]">8—14 Jun 2026 · shared with Priya</div>
        </div>
      </div>
    </div>

    <div ref={daysRef}>
      {TRIP_DAYS.map((d, i) => (
        <div key={d.day} className="flex gap-6 max-[599px]:flex-col max-[599px]:gap-3">
          <div className="w-[78px] shrink-0 text-right max-[599px]:w-auto max-[599px]:text-left">
            <div className="archivo text-[15px] text-white">{d.day}</div>
            <div className="text-[12px] text-[#757575]">{d.date}</div>
          </div>
          <div className="relative w-px shrink-0 bg-[#1e1e1e] max-[599px]:hidden">
            <span className="absolute -left-[3.5px] top-2 h-2 w-2 rounded-full bg-white" />
          </div>
          <div className={`flex flex-1 gap-[18px] max-[599px]:flex-col ${i < TRIP_DAYS.length - 1 ? 'pb-[34px]' : ''}`}>
            <img src={d.src} alt="" className="h-[132px] w-[196px] shrink-0 rounded-[10px] object-cover max-[599px]:w-full" />
            <div>
              <div className="text-[16px] font-semibold text-white">{d.title}</div>
              <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[#a0a0a0]">{d.note}</p>
              {d.place && <div className="mt-2 text-[12.5px] text-[#6a6a6a]">{d.place}</div>}
              {d.byline && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={d.byline.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                  <span className="text-[12.5px] text-[#6a6a6a]">{d.byline.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
  );
};

/* ----------------------------------------------------------------- 6. search */

/*
The handoff drew an Explore feed here, with a "why this was recommended" line per card.
Explore no longer exists — the product is a private diary — so the same four-up grid now
demonstrates searching your own memories, and the third line says which tier of search
matched rather than why a stranger's post was surfaced.
*/
const SEARCH_RESULTS = [
  { src: IMG.ghats, title: 'Kanheri trail, 6am', meta: 'Borivali East · 10 Jun 2026', match: 'Close match · “early walk”' },
  { src: IMG.street, title: 'Late plate, Bhendi Bazaar', meta: 'Mohammed Ali Rd · 9 Jun 2026', match: 'Close match · “street food”' },
  { src: IMG.monsoon, title: 'Monsoon on DN Road', meta: 'Fort, Mumbai · 14 Jun 2026', match: 'Close match · “the day it flooded”' },
  { src: IMG.bandra, title: 'Bandstand, after the rain', meta: 'Bandra West · 13 Jun 2026', match: 'Text match · “bandstand”' },
];

const SearchSection = () => {
  const gridRef = useRef(null);
  useRevealChildren(gridRef, { y: 30, stagger: 0.1 });

  return (
  <section id="f-search" className="pb-24">
    <SectionHeader
      className="mb-7"
      eyebrow="04 · Search"
      title="Find the entry you half-remember"
      blurb="Describe it the way you'd say it out loud — “that evening by the water”. Echoes matches on meaning, not just the words you typed, and only ever searches your own diary."
    />
    <div ref={gridRef} className={`grid grid-cols-4 gap-4 ${PAGE_X} max-[1199px]:grid-cols-2 max-[599px]:grid-cols-1`}>
      {SEARCH_RESULTS.map((r) => (
        /*
        Two nested elements on purpose. The outer one is what the scroll reveal animates, so
        GSAP owns its transform; the hover scale lives on the inner one. Sharing a single
        element would let the tween's inline transform outrank the hover class while the
        reveal is still in flight. z-10 lifts the growing card above its grid neighbours.
        */
        <div key={r.title} className="group relative hover:z-10">
          <div className="transition-transform duration-300 ease-out group-hover:scale-[1.045]">
            <div className="mb-3 overflow-hidden rounded-xl">
              <img
                src={r.src}
                alt=""
                className="h-[220px] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
              />
            </div>
            <div className="text-[14.5px] font-semibold text-white">{r.title}</div>
            <div className="mt-0.5 text-[12.5px] text-[#757575]">{r.meta}</div>
            <div className="mt-1 text-[12px] text-accentMain">{r.match}</div>
          </div>
        </div>
      ))}
    </div>
  </section>
  );
};

/* ----------------------------------------------------------------- 7. people */

/*
The chat is a loop rather than a still: Priya types, her message lands, the reply goes out,
and she starts typing again. It only runs while the card is on screen — an infinite timeline
ticking away further down a marketing page is pure wasted CPU.
*/
const PeopleSection = () => {
  const chatRef = useRef(null);
  const incomingRef = useRef(null);
  const outgoingRef = useRef(null);
  const typingRef = useRef(null);
  const dotRefs = useRef([]);

  useGSAP(
    () => {
      const parts = [incomingRef.current, outgoingRef.current, typingRef.current];
      if (parts.some((el) => !el)) return;

      if (reducedMotion()) {
        gsap.set(parts, { opacity: 1, y: 0 });
        return;
      }

      gsap.to(dotRefs.current, {
        y: -3,
        duration: 0.4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.13,
      });

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
      tl.set(parts, { opacity: 0, y: 10 })
        .to(typingRef.current, { opacity: 1, y: 0, duration: 0.3 })
        .to(typingRef.current, { opacity: 0, duration: 0.2 }, '+=1.5')
        .to(incomingRef.current, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.5)' })
        .to(outgoingRef.current, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.5)' }, '+=1.2')
        .to(typingRef.current, { opacity: 1, y: 0, duration: 0.3 }, '+=0.9')
        .to(parts, { opacity: 0, duration: 0.45 }, '+=2.4');

      ScrollTrigger.create({
        trigger: chatRef.current,
        start: 'top 92%',
        end: 'bottom 8%',
        onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
      });
    },
    { scope: chatRef }
  );

  return (
  <section className={`pb-24 ${PAGE_X}`}>
    <WarpBackground
      className="border border-[#1e1e1e] p-16 max-[899px]:p-8 max-[599px]:p-5"
      // Inverse: a bigger number is a shallower tunnel. The component's default of 100 made
      // the walls fall away steeply enough to fight the content sitting on top of them.
      perspective={170}
      beamsPerSide={3}
      beamSize={4}
      beamDuration={5}
      gridColor="rgba(255,255,255,.06)"
    >
    <div className="grid grid-cols-2 items-center gap-[72px] max-[899px]:grid-cols-1 max-[899px]:gap-10">
    <div>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.16em] text-[#6a6a6a]">05 · People</div>
      <AnimatedHeading
        text="Talk about a place — or find out you were both there"
        className="archivo text-[38px] leading-[1.1] tracking-[-.025em] text-white max-[1199px]:text-[32px] max-[599px]:text-[26px]"
      />
      <p className="mt-4 max-w-[430px] text-[15px] leading-[1.62] text-[#a0a0a0]">
        Real-time messages with the people you follow. And when two of you pinned the same place on the same day,
        Echoes asks you both first. Nothing is shown until you&apos;ve each confirmed it.
      </p>
      <div className="mt-6 flex max-w-[430px] items-center gap-3 rounded-xl border border-[#1e1e1e] px-4 py-3.5">
        <div className="flex shrink-0">
          <img src={IMG.bandra} alt="" className="h-[38px] w-[38px] rounded-[9px] object-cover ring-[1.5px] ring-[#0b0b0b]" />
          <img
            src={IMG.marineDrive}
            alt=""
            className="-ml-[9px] h-[38px] w-[38px] rounded-[9px] object-cover ring-[1.5px] ring-[#0b0b0b]"
          />
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-white">You and Priya were both at Bandstand</div>
          <div className="text-[12px] text-[#757575]">13 Jun 2026 · 320m apart · both confirmed</div>
        </div>
      </div>
    </div>

    <div ref={chatRef} className="rounded-2xl border border-[#1e1e1e] bg-[#101010]">
      <div className="flex items-center gap-3 border-b border-[#1e1e1e] px-5 py-4">
        <img src={IMG.priya} alt="" className="h-[34px] w-[34px] rounded-full object-cover" />
        <div>
          <div className="text-[14px] font-semibold text-white">Priya Menon</div>
          <div className="text-[11.5px] text-accentMain">Online</div>
        </div>
      </div>
      {/* min-height holds the card steady while the bubbles fade in and out */}
      <div className="flex min-h-[186px] flex-col gap-3 p-5">
        <div ref={incomingRef} className="flex items-end gap-2.5">
          <img src={IMG.priya} alt="" className="h-[26px] w-[26px] shrink-0 rounded-full object-cover" />
          <div className="max-w-[70%] rounded-[16px_16px_16px_4px] bg-[#1c1c1c] px-3.5 py-[11px] text-[13.5px] text-[#e8e6e1]">
            Was that you at Bandstand on Saturday?
          </div>
        </div>
        <div ref={outgoingRef} className="flex justify-end">
          <div className="max-w-[70%] rounded-[16px_16px_4px_16px] bg-gradient-mainBright px-3.5 py-[11px] text-[13.5px] text-white">
            Yes! Pinned it at 7 — yours is two streets down
          </div>
        </div>
        <div ref={typingRef} className="mt-auto flex items-center gap-2 pl-9 text-[11.5px] text-[#757575]">
          Priya is typing
          <span className="flex items-center gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                ref={(el) => (dotRefs.current[i] = el)}
                className="h-[5px] w-[5px] rounded-full bg-accentMain"
              />
            ))}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-[#1e1e1e] px-5 py-3.5">
        <div className="flex h-10 flex-1 items-center rounded-full border border-[#232323] bg-[#161616] px-4 text-[13.5px] text-[#6a6a6a]">
          Message Priya
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#232323]">
          <Send size={16} className="text-white" />
        </div>
      </div>
    </div>
    </div>
    </WarpBackground>
  </section>
  );
};

/* ------------------------------------------------------------- 8. closing + footer */

const Closing = () => (
  <section className={`pb-[120px] ${PAGE_X}`}>
    <div className="border-t border-[#1e1e1e] pt-[76px] text-center">
      <AnimatedHeading
        align="center"
        delay={0.035}
        text="Start with one pin."
        className="archivo text-[42px] leading-[1.12] tracking-[-.025em] text-white max-[599px]:text-[30px]"
      />
      <p className="mx-auto mt-4 max-w-[440px] text-[15.5px] leading-[1.6] text-[#a0a0a0]">
        A photo, a place, a date. The map, the timeline and the trips build themselves.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-[10px]">
        <PrimaryCta />
        <SecondaryCta />
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------------ page */

const LandingPage = () => (
  <div className="echoes-landing min-h-screen w-full bg-[#0b0b0b]">
    <AuthCorner />
    <Hero />
    <Statement />
    <MapSection />
    <TimelineSection />
    <TripsSection />
    <SearchSection />
    <PeopleSection />
    <Closing />
  </div>
);

export default LandingPage;
