import { useMemo } from 'react';
import { cn } from '../../lib/utils';

/*
Warp background (magicui): the container's four edges are folded away from the viewer in 3D,
and beams of light travel outward along each of those planes, so the content appears to sit
in a tunnel receding into the page.

Two deliberate departures from the upstream component:

1. **No framer-motion.** Upstream animates each beam with a motion.span. That would mean adding
   an animation library to this project for one decorative background, so the beams run on a
   CSS keyframe (`echoes-warp-beam` in landing.css) with per-beam delay and duration instead.
2. **Brand colours, not random hues.** Upstream picks a random hue per beam. These cycle the
   three stops of the app's own gradient, so the section matches the rest of the page.
*/

const BEAM_COLORS = ['#fc9b41', '#d557e3', '#3ed8e3'];

const Beam = ({ width, x, delay, duration, colorIndex }) => (
  <span
    className="echoes-warp-beam absolute left-[var(--x)] top-0 w-[var(--width)]"
    style={{
      '--x': `${x}`,
      '--width': `${width}`,
      aspectRatio: `1 / ${Math.floor(Math.random() * 6) + 4}`,
      background: `linear-gradient(${BEAM_COLORS[colorIndex % BEAM_COLORS.length]}, transparent)`,
      opacity: 0.7,
      filter: 'blur(1px)',
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  />
);

const WarpBackground = ({
  children,
  perspective = 100,
  beamsPerSide = 3,
  beamSize = 5,
  beamDelayMax = 3,
  beamDelayMin = 0,
  beamDuration = 3,
  gridColor = 'rgba(255,255,255,.07)',
  className,
  ...props
}) => {
  // Generated once: re-rolling the delays on every render would make the beams stutter.
  const sides = useMemo(() => {
    const generate = () =>
      Array.from({ length: beamsPerSide }, (_, i) => ({
        x: Math.floor((i * 100) / beamsPerSide),
        delay: Math.random() * (beamDelayMax - beamDelayMin) + beamDelayMin,
        colorIndex: i,
      }));
    return { top: generate(), bottom: generate(), left: generate(), right: generate() };
  }, [beamsPerSide, beamDelayMax, beamDelayMin]);

  const beamProps = { width: `${beamSize}%`, duration: beamDuration };

  // Each side is the same plane, hinged away from the viewer along a different edge.
  const planeStyle = (extra) => ({
    backgroundSize: `${beamSize}% ${beamSize}%`,
    backgroundImage: `linear-gradient(${gridColor} 0 1px, transparent 1px ${beamSize}%),
                      linear-gradient(90deg, ${gridColor} 0 1px, transparent 1px ${beamSize}%)`,
    ...extra,
  });

  return (
    <div className={cn('relative rounded-2xl', className)} {...props}>
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        style={{ perspective: `${perspective}px`, containerType: 'size', transformStyle: 'preserve-3d' }}
      >
        <div
          className="absolute z-20 [container-type:inline-size]"
          style={planeStyle({ height: '100cqmax', width: '100cqi', transformOrigin: '50% 0%', transform: 'rotateX(-90deg)' })}
        >
          {sides.top.map((b, i) => <Beam key={`t${i}`} {...beamProps} x={`${b.x}%`} delay={b.delay} colorIndex={b.colorIndex} />)}
        </div>
        <div
          className="absolute top-full z-20 [container-type:inline-size]"
          style={planeStyle({ height: '100cqmax', width: '100cqi', transformOrigin: '50% 0%', transform: 'rotateX(-90deg)' })}
        >
          {sides.bottom.map((b, i) => <Beam key={`b${i}`} {...beamProps} x={`${b.x}%`} delay={b.delay} colorIndex={b.colorIndex} />)}
        </div>
        <div
          className="absolute left-0 top-0 z-20 [container-type:inline-size]"
          style={planeStyle({ height: '100cqmax', width: '100cqh', transformOrigin: '0% 0%', transform: 'rotate(90deg) rotateX(-90deg)' })}
        >
          {sides.left.map((b, i) => <Beam key={`l${i}`} {...beamProps} x={`${b.x}%`} delay={b.delay} colorIndex={b.colorIndex} />)}
        </div>
        <div
          className="absolute right-0 top-0 z-20 [container-type:inline-size]"
          style={planeStyle({ height: '100cqmax', width: '100cqh', transformOrigin: '100% 0%', transform: 'rotate(-90deg) rotateX(-90deg)' })}
        >
          {sides.right.map((b, i) => <Beam key={`r${i}`} {...beamProps} x={`${b.x}%`} delay={b.delay} colorIndex={b.colorIndex} />)}
        </div>
      </div>
      {/* Above the z-20 beam planes: the beams belong behind the content, not across it. */}
      <div className="relative z-30">{children}</div>
    </div>
  );
};

export default WarpBackground;
