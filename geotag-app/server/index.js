const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { applyTimestamps } = require('./models/users');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config(); // loads .env variables
//But for local development or manual setups, it’s essential.

const authRoutes = require('./routes/authRoutes'); 
const navbarRoutes = require('./routes/navbarRoutes'); 
const locationRoutes = require('./routes/locationRoutes'); 
const memoryRoutes = require('./routes/memoryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userRoutes = require("./routes/userRoutes");
const followRequestRoutes = require("./routes/followRequestRoutes")



const app = express();
/*it creates an Express application object
 Now app becomes the main variable you’ll use to:

>add routes → app.get('/login', ...)
>add middleware → app.use(cors())
>start the server → app.listen(5000)

Basically, app is your entire backend bundled in one variable.
If Express was a car, express() is like turning the key — app is now the car you can drive.*/

//MIDDLEWARE SETUP-----------------------
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
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));
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

//When a request comes in, Express checks the path.
//If the path starts with /api/auth, it forwards the request to the authRoutes router.
//router.post('/signup', ...) Defines a POST endpoint at /signup (full URL becomes /api/auth/signup after app.use).

//------------------------
// start server
app.listen(process.env.PORT || 5000, () => console.log('Server running'));
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
