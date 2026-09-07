import { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

/*
Interactive grid pattern (magicui): an SVG lattice where the cell under the cursor lights up
and the cells behind it fade out slowly, leaving a trail of where the pointer has been.

Ported to JSX, with two changes from upstream:

1. **Hover state is one index on the parent**, not per-square state, so crossing the grid
   re-renders once per cell entered instead of mounting 180 stateful components.
2. **The trail is a Web Animations call on the element being left**, not a CSS transition on
   a class React removes. A class swap and the transition meant to animate it happen in the
   same frame, so the fade-out is unreliable and only ever one cell deep. Handing each
   departing cell its own animation lets many of them fade at once, which is the trail.
*/

const LIT_FILL = 'rgba(213, 87, 227, .30)';
const LIT_STROKE = 'rgba(213, 87, 227, .70)';
const IDLE_FILL = 'rgba(213, 87, 227, 0)';
const IDLE_STROKE = '#1b1b1b';

const InteractiveGridPattern = ({
  width = 64,
  height = 64,
  squares = [24, 12],
  trailMs = 1100,
  className,
  squaresClassName,
  ...props
}) => {
  const [horizontal, vertical] = squares;
  const [hovered, setHovered] = useState(null);

  /*
  A running fade wins over the lit class — Web Animations outrank normal declarations in the
  cascade — so re-entering a cell inside the trail window would show it fading instead of lit.
  Cancelling on the way in hands the cell back to CSS.
  */
  const handleEnter = useCallback((event, index) => {
    event.currentTarget.getAnimations().forEach((animation) => animation.cancel());
    setHovered(index);
  }, []);

  const handleLeave = useCallback(
    (event) => {
      setHovered(null);
      const el = event.currentTarget;
      if (typeof el.animate !== 'function') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      el.animate(
        [
          { fill: LIT_FILL, stroke: LIT_STROKE },
          { fill: IDLE_FILL, stroke: IDLE_STROKE },
        ],
        { duration: trailMs, easing: 'ease-out' }
      );
    },
    [trailMs]
  );

  return (
    <svg
      width={width * horizontal}
      height={height * vertical}
      className={cn('absolute inset-0 h-full w-full', className)}
      {...props}
    >
      {Array.from({ length: horizontal * vertical }).map((_, index) => (
        <rect
          key={index}
          x={(index % horizontal) * width}
          y={Math.floor(index / horizontal) * height}
          width={width}
          height={height}
          // `all` rather than the default visiblePainted, so a cell with a fully transparent
          // fill is still a hit target across its whole area.
          className={cn(
            '[pointer-events:all] transition-colors duration-75',
            hovered === index
              ? 'fill-[#d557e3]/[.30] stroke-[#d557e3]/70'
              : 'fill-transparent stroke-[#1b1b1b]',
            squaresClassName
          )}
          onMouseEnter={(event) => handleEnter(event, index)}
          onMouseLeave={handleLeave}
        />
      ))}
    </svg>
  );
};

export default InteractiveGridPattern;
