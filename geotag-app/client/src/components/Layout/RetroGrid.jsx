import { cn } from '../../lib/utils';

/*
Retro perspective grid (magicui). A flat grid rotated back in X so it reads as a floor
receding to the horizon.

Ported to JSX and to this project's conventions: the scroll uses the `grid` keyframe
registered in tailwind.config.js, and the horizon treatment is a mask rather than magicui's
painted light/dark gradient overlay — see below.
*/
const RetroGrid = ({
  className,
  angle = 65,
  cellSize = 60,
  opacity = 0.55,
  lineColor = 'rgba(255,255,255,.34)',
  /*
  Where the horizon mask ends and the visible floor begins.

  This is load-bearing, not a soft edge. As the plane recedes its horizontal lines converge
  until they are narrower than a pixel, and a CSS background image has no mipmaps, so that
  region aliases into a speckled band instead of resolving to a horizon. Shortening the plane
  does not help — the band sits at a fixed screen position set by the perspective and angle.
  So everything above `fadeStart` is hidden outright and only the clean, wide-spaced near
  field fades in.

  It is applied as a *mask on this component*, not as an opaque overlay painted on top.
  RetroGrid is stacked above the hero's Aurora, so an overlay in the page colour would hide
  whatever sits behind it as well as the grid — which is exactly what it did, blanking the
  aurora across the top half of the hero. A mask only ever removes this element's own pixels.
  */
  fadeStart = '56%',
  fadeEnd = '82%',
  // Seconds for one full scroll cycle. Overrides the duration baked into the `animate-grid`
  // utility so the speed is tunable per placement rather than global.
  duration = 52,
  // When false the grid renders as a still perspective floor with no motion at all.
  animate = true,
}) => {
  // Transparent hides, opaque reveals. The mask lives on this un-rotated root, so it is a
  // straight top-to-bottom gradient in screen space rather than one skewed by the rotation.
  const mask = `linear-gradient(to bottom, transparent 0%, transparent ${fadeStart}, #000 ${fadeEnd})`;

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden [perspective:200px]', className)}
      style={{ opacity, maskImage: mask, WebkitMaskImage: mask }}
    >
      <div className="absolute inset-0" style={{ transform: `rotateX(${angle}deg)` }}>
        <div
          className={animate ? 'animate-grid' : undefined}
          style={{
            backgroundImage: `linear-gradient(to right, ${lineColor} 1px, transparent 0), linear-gradient(to bottom, ${lineColor} 1px, transparent 0)`,
            backgroundRepeat: 'repeat',
            backgroundSize: `${cellSize}px ${cellSize}px`,
            height: '300vh',
            width: '600vw',
            inset: '0%',
            marginLeft: '-200%',
            transformOrigin: '100% 0 0',
            // A still grid must sit where the animation's midpoint would put it, otherwise the
            // plane starts half a cycle off and the visible floor is cropped.
            ...(animate ? { animationDuration: `${duration}s` } : { transform: 'translateY(-25%)' }),
          }}
        />
      </div>
    </div>
  );
};

export default RetroGrid;
