
import { Marker, Popup } from "react-leaflet";
import {MapPin} from 'lucide-react';
import L from "leaflet";
import 'leaflet/dist/leaflet.css';

const FriendMarker = ({ memory }) => {
  const customIcon = L.divIcon({
    className: "", // removes default leaflet marker styles
    html: `
    <div class="w-[70px] h-[70px] relative">
       <div class="relative z-20 w-16 h-16 rounded-lg border-[2px] border-dmain dark:border-main shadow-lg bg-cover bg-center"
      style="background-image: url('${memory.photoUrl}')">
      </div>
      <div class="z-10 absolute left-1/2 -translate-x-1/2 bottom-0 w-3 rotate-45 aspect-square bg-dmain dark:bg-main"></div>
      <div class="z-20 absolute w-8 right-0 bottom-0 aspect-square rounded-full bg-red-500"></div>
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
