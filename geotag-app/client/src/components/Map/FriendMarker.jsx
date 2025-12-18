
import { Marker, Popup } from "react-leaflet";
import {MapPin} from 'lucide-react';
import { getHexFromUserId } from "../../utils/hexColorFromId";
import L from "leaflet";
import 'leaflet/dist/leaflet.css';

const FriendMarker = ({ pfp,id,memory }) => {
  const customIcon = L.divIcon({
    className: "", // removes default leaflet marker styles
    html: `
     <div class="w-[52px] h-[52px] relative hover:scale-[1.5] transition-all duration-200">
       <div class="relative z-20 w-12 h-12 rounded-[10px] border-[2px] bg-gray-500 dark:border-lightMain bg-cover bg-center"
      style="background-image: url('${memory.photoUrl}');
             border-color: ${getHexFromUserId(id)};">
      </div>
      <div class="z-20 absolute w-7 right-0 bottom-0 aspect-square rounded-full shadow-md bg-contain"
      style="background-image: url('${pfp}')"></div>
    </div>
    `,
    iconSize: [64, 64],
    iconAnchor: [32, 64], // bottom of marker aligns with location
    popupAnchor: [0, -70], // popup offset above marker
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

          <div className="px-[5px]">
            <h3 className="font-bold text-lg">{memory.title}</h3>
            <p className="text-sm my-[10px]">{memory.description}</p> 
            <p className="text-xs text-gray-500 flex items-center justify-center"><div className="scale-[0.8]"><MapPin/></div> {memory.location.address}</p>
         </div>

        </div>
      </Popup>
    </Marker>
  );
};

export default FriendMarker;
