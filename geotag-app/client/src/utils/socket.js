
import { io } from "socket.io-client";

const socketServerURL =
  process.env.NODE_ENV === "production"
    ? "https://echoes-vmc2.onrender.com"
    : "http://localhost:5000";

//withCredentials sends the httpOnly `token` cookie along with the handshake.
//The server verifies that JWT in io.use() and derives the user id from it, so the
//client never sends (and cannot forge) its own identity.
export const socket = io(socketServerURL, {
  autoConnect: false,
  withCredentials: true,
});