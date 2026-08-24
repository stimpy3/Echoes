require('dotenv').config(); // loads .env variables — must run before anything below reads process.env
//But for local development or manual setups, it’s essential.

/*
Confirmed root cause (2026-08-18), local dev machine only: on Windows here, Node's own
DNS resolver (c-ares) was getting ECONNREFUSED on the `_mongodb._tcp.*` SRV lookup that
Atlas's mongodb+srv:// URI needs — instantly, not a timeout — while Windows' own resolver
(nslookup) answered the same query fine. Node doesn't share Windows' resolver; c-ares
does its own DNS server discovery, and on this machine it was picking something that
refuses SRV queries (common with VPN clients, Docker Desktop/WSL, or a virtual adapter).
Pointing it at 8.8.8.8/1.1.1.1 explicitly bypasses whatever it was auto-selecting.

Gated to non-production: Render's containers have never shown this symptom, and forcing
an external resolver on a host that expects you to use its own internal one (a real
policy on some providers) would trade a fixed local bug for a hypothetical prod one.
ipv4first is left ungated — it's a preference, not a hard override, so it's low-risk
everywhere: on a network where IPv6 is advertised but not actually routed, Node would
try that address first, get no response at all (not a rejection — a black hole), and
only fall back to IPv4 after its own internal timeout.

Must run before anything else requires DNS — hence top of file, before any other require().
*/
const dns = require('dns');
if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { applyTimestamps } = require('./models/users');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const { createClient: createRedisClient } = require('./utils/redisClient');

const pinoHttp = require('pino-http');
const logger = require('./utils/logger');

const authRoutes = require('./routes/authRoutes');
const navbarRoutes = require('./routes/navbarRoutes'); 
const locationRoutes = require('./routes/locationRoutes'); 
const memoryRoutes = require('./routes/memoryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userRoutes = require("./routes/userRoutes");
const followRequestRoutes = require("./routes/followRequestRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");



const app = express();
/*it creates an Express application object
 Now app becomes the main variable you’ll use to:

>add routes → app.get('/login', ...)
>add middleware → app.use(cors())
>start the server → app.listen(5000)

Basically, app is your entire backend bundled in one variable.
If Express was a car, express() is like turning the key — app is now the car you can drive.*/

//MIDDLEWARE SETUP-----------------------
/*
First middleware, before even CORS — request logging should see everything from arrival.
pino-http auto-generates a request id and attaches a CHILD logger as req.log with that id
already bound into every field it logs, so `req.log.info('...')` anywhere downstream (route
handlers, the Explore diagnostics below) automatically carries the same id as every other
log line from that request. It also logs one summary line per request on its own (method,
url, status, response time) with zero code in any route — that alone answers "was /explore
slow, and for whom" without hand-instrumenting anything.
*/
app.use(pinoHttp({ logger }));

//app.use(...)  // Tells Express to run this middleware function for every request
//no explicit next() required becaause its inbuilt in cors()
const allowedOrigins = [
  "http://localhost:5173",                 // local frontend (development)
  "https://echoes-nine-kappa.vercel.app",  // deployed frontend (Vercel)
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
//CORS (Cross-Origin Resource Sharing) lets your frontend (e.g., React on localhost:5173) 
//talk to your backend (localhost:5000) without the browser blocking the request for security reasons.
//no explicit next() required becaause its inbuilt in cor

/*CORS (Cross-Origin Resource Sharing) is a browser security mechanism that controls how web pages from one origin
(domain + protocol + port) can request resources from another origin.
By default, browsers block cross-origin requests for security.
CORS works by adding specific HTTP headers (like Access-Control-Allow-Origin) to tell the browser which external
origins are allowed to access the server’s resources.
In Express, using: app.use(cors());
automatically sets these headers so your frontend (e.g., http://localhost:5173) can safely make API calls to your backend 
(e.g., http://localhost:5000).*/


app.use(cookieParser());
//This middleware parses cookies from incoming requests and makes them available in req.cookies.
//Without this, req.cookies would be undefined, and you’d have to manually parse the Cookie header.
app.use(express.json());
/*
app.use(express.json())
This one tells Express:
“If someone sends me data (like from a form or Axios POST),automatically read the JSON body and
make it available in req.body.”

This way, you don’t have to manually parse JSON every time someone sends data to your backend.
Without this middleware, if you tried to access req.body, it would be undefined.
You’d have to do something like:
let data = '';
req.on('data', chunk => { data += chunk; });
req.on('end', () => { const parsed = JSON.parse(data); });
Basically, Express now does this automatically for you.
 -------------------------------------------*/

//  So why cookieParser() comes last (or middle)?
// Because:
// cors() should always come first — it needs to wrap the whole API.
// express.json() should come before any middleware or route that reads req.body.
// cookieParser() can safely come after — cookies are independent of the body, so it doesn’t depend on .json().
//---------------------------------------

//connect to DB--------------------------
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/echoes";
mongoose.connect(MONGO_URI)
  .then(() => logger.info('MongoDB connected'))
  .catch(err => logger.error({ err }, 'MongoDB connection error'));
/*in async await format
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
};
 */
//---------------------------------------

/*test route
app.get() → for reading/fetching data
app.post() → for creating/sending data
app.put() → for updating data
app.delete() → for deleting data

app.get('/', (req, res) => {
  res.send('Backend is running');
});
so when you write the above code it means:
When someone tries to GET the ( / ), here’s what to send back.

/ (the slash) → the path / route
The '/' here represents the root URL path.
So if your server is running at
http://localhost:5000
*/

//routes---------------------
app.use('/api/auth', authRoutes);
app.use('/api/user', navbarRoutes);
app.use('/api/user',locationRoutes);
app.use('/api/memory',memoryRoutes);
app.use('/api/analytics',analyticsRoutes);
app.use('/api/users',userRoutes);
app.use("/api/follow", followRequestRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);


//app = normal server
// io = real-time server
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

/*
Fixes the actual scaling bug: socket/index.js used to keep `onlineUsers` as a plain
in-process object. That works with exactly one server instance. Run two behind a load
balancer and a message from a user connected to instance A can never reach a recipient
whose socket is on instance B — io.to(socketId).emit() only ever looks in its own
process's memory. Silent message loss, not a crash, which is the worse kind of bug.

The Redis adapter fixes this by making every instance publish socket events to Redis
and subscribe to what every OTHER instance publishes, so io.to()/emit() work the same
whether the target socket is local or on a different machine entirely. Two connections
are required (not one) because pub/sub connections can't also run pull request/response
commands — .duplicate() clones the first client's connection options for the second one.
*/
const pubClient = createRedisClient();
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

/*
Authenticate the handshake BEFORE any socket event handler runs.

io.use() is the Socket.IO equivalent of app.use() — it runs once per connection attempt,
and calling next(err) rejects the connection instead of letting it through.

Why this is needed: the client used to just *tell* us who it was (socket.handshake.auth.userId),
and the server believed it. Anyone could open a socket claiming another user's id and receive
their live messages. Here we instead read the same httpOnly `token` cookie the REST API uses
(verifyToken.js) and derive the id from the signed JWT, which the client cannot forge.

The cookie rides along automatically because the client sets withCredentials: true.
*/
io.use((socket, next) => {
  //handshake.headers.cookie is the raw header string: "token=abc; theme=dark"
  const cookieHeader = socket.handshake.headers.cookie || '';

  const token = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('token='))
    ?.slice('token='.length);

  if (!token) {
    return next(new Error('unauthorized'));
  }

  jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('unauthorized'));

    //socket.userId is now trusted, the same way req.userId is in verifyToken.js
    socket.userId = decoded.id;
    next();
  });
});

/*require("./socket/index") returns a function
(because in your socket/index.js you did module.exports = (io) => { ... })
By adding (io), you immediately call that function and pass io to it*/
require("./socket/index")(io);

/*
Starts processing embedding jobs in THIS process — requiring the file is enough, a BullMQ
Worker begins consuming as soon as it's constructed, no separate .start() call. This is a
deliberate choice for a single Render instance: a dedicated worker dyno is real infra
(another deployed service, another thing that can be down) that this app's job volume
doesn't currently justify. If it ever does, this line moves to its own entry point and
nothing about the queue or worker's own code has to change.
*/
require("./workers/embeddingWorker");

server.listen(process.env.PORT || 5000, () => {
  logger.info({ port: process.env.PORT || 5000 }, 'Server running');
});
/*app.listen(5000, ...)→ Starts the server on port 5000
() => { ... } → This is a callback function that runs once the server starts successfully.

A callback is simply a function that is passed as an argument to another function,
 and then called (executed) later by that function.
 callback example:

 function greet(name, callback) {
  console.log(`Hello, ${name}!`);
  callback(); // calling the callback function
}

function sayBye() {
  console.log('Goodbye!');
}

greet('Sohan', sayBye);


output:-
Hello, Sohan!
Goodbye!

Here,
sayBye is the callback function.
It’s passed to greet and then executed inside greet.
 */
