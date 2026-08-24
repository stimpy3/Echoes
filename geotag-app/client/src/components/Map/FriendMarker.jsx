
import { Marker, Popup } from "react-leaflet";
import {MapPin} from 'lucide-react';
import { getHexFromUserId } from "../../utils/hexColorFromId";
import L from "leaflet";
import 'leaflet/dist/leaflet.css';

const FriendMarker = ({ pfp,id,memory }) => {
  /*
  getHexFromUserId was already imported here but never called — the border was hardcoded
  white. It derives a stable hue from the user id (same person always gets the same colour,
  no storage needed), which is exactly what's wanted when several friends' pins share the
  map: you can tell whose is whose without opening any of them. Wiring it up now.

  Geometry, same class of fix as CustomMarker: iconSize said [64,64] while the HTML root was
  52x52, so Leaflet anchored using a box 12px larger than what actually rendered and every
  friend pin sat low and slightly off-centre. Root is now 52 wide / 58 tall (48 photo + the
  avatar overhang) with the anchor at its true bottom-centre.
  */
  const accent = getHexFromUserId(id);

  const customIcon = L.divIcon({
    className: "", // removes default leaflet marker styles
    html: `
     <div class="w-[52px] h-[58px] relative hover:scale-[1.15] transition-transform duration-200 origin-bottom">
       <div class="relative z-20 w-12 h-12 rounded-[10px] border-[2px] bg-gray-500 bg-cover bg-center shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
      style="background-image: url('${memory.photoUrl}');
             border-color: ${accent};">
      </div>
      <div class="z-30 absolute w-7 right-0 bottom-[6px] aspect-square rounded-full bg-cover bg-center shadow-md"
      style="background-image: url('${pfp}'); border: 2px solid ${accent};"></div>
    </div>
    `,
    iconSize: [52, 58],
    iconAnchor: [26, 58], // horizontally centred; bottom edge on the coordinate
    popupAnchor: [0, -60], // clear of the top of the photo
  });

  return (
    <Marker
      position={[
        memory.location.coordinates[1],
        memory.location.coordinates[0],
      ]}
      icon={customIcon}
    >
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
            {/* Same invalid <div>-inside-<p> fix as CustomMarker — the browser was
                auto-closing the <p>, so the flex row never applied. */}
            <p className="text-xs text-gray-500 flex items-start gap-1">
              <span className="shrink-0 mt-[1px]"><MapPin size={13} /></span>
              <span>{memory.location.address}</span>
            </p>
         </div>

        </div>
      </Popup>
    </Marker>
  );
};

export default FriendMarker;
