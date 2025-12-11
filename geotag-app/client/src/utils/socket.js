
import { io } from "socket.io-client";

const socketServerURL =
  process.env.NODE_ENV === "production"
    ? "https://echoes-vmc2.onrender.com"
    : "http://localhost:5000";

export const socket = io(socketServerURL, {
  autoConnect: false,
  withCredentials: true,
  //Use auth instead of query for authentication
  auth: (cb) => {
    // This will be set before connecting
    cb(socket.auth);
  }
});