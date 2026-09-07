import GlobePolaroids from '../Layout/GlobePolaroids';

/*
The left half of the auth screens.

A cobe globe with polaroid cards pinned to the cities they were taken in, over the product
copy. It is the one visual on the logged-out screens that states the whole premise without a
caption: photographs, standing on the places they belong to.
*/
const AuthVisual = () => (
  <div className="visualDiv relative h-full w-[52%] overflow-hidden bg-[#101010] max-[900px]:w-full max-[900px]:h-[38vh] max-[900px]:min-h-[280px]">
    {/*
    Full height, so the globe is centred on the panel rather than on a shorter box. It used to
    be top-0 h-[88%]: cobe centres the sphere in its canvas, so the globe sat centred in that
    88% slice and therefore ~50px above the panel's own centre, which is what read as "not
    vertically centred". Nothing needs clearing any more — the logo and the note sit at the
    panel edges and simply overlay it.
    */}
    <div className="absolute inset-0">
      <GlobePolaroids className="h-full w-full" />
    </div>

    {/*
    No copy at all: the globe with photographs standing on their own cities says what the
    product is, and every caption tried here only restated the picture. The mark is the one
    thing on top, so the form side carries no logo of its own.

    The scrim that used to sit here went with the text. Its whole job was keeping body copy
    legible over the bright lower half; with nothing to read, a near-opaque black gradient was
    just eating the bottom of the globe.
    */}
    <div className="pointer-events-none absolute inset-0 p-12 max-[900px]:p-8 max-[550px]:p-6">
      <img
        src="/logo.png"
        alt="Echoes"
        className="h-11 w-auto max-[900px]:h-8"
        // The globe runs bright behind it in places, so the mark gets its own shadow rather
        // than a full-panel scrim.
        style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,.65))' }}
      />
    </div>
  </div>
);

export default AuthVisual;
