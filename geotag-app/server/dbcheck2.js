// Read-only Atlas connectivity test using the SAME driver Mongoose sits on top of
// (server/node_modules/mongodb, already installed as a mongoose dependency — no install
// needed). Substitutes for `mongosh`, which isn't on this machine. No writes, exits after.
//
// Run from geotag-app/server:  node <this file>
require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // same fix just added to index.js

/*
Theory: Node's resolver (c-ares) is asking a different, non-cooperating DNS server than
Windows' own stub resolver (what nslookup uses) — common on Windows with a VPN client,
Docker Desktop/WSL, or a virtual adapter (VirtualBox/Hyper-V/VMware) present. Forcing
known-good public resolvers here bypasses whatever c-ares auto-selected, without touching
any OS-level network settings.
*/
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) { console.log('RESULT: MONGO_URI is empty in .env'); process.exit(1); }

console.log('Connecting with a 10s server-selection timeout...\n');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

const started = Date.now();
client.connect()
  .then(async () => {
    console.log(`RESULT: CONNECTED in ${Date.now() - started}ms`);
    const admin = client.db().admin();
    const { databases } = await admin.listDatabases();
    console.log('databases visible to this user:', databases.map(d => d.name).join(', '));
    await client.close();
  })
  .catch(err => {
    console.log(`RESULT: FAILED after ${Date.now() - started}ms`);
    console.log('name   :', err.name);
    console.log('code   :', err.code);
    console.log('message:', err.message);
  });
