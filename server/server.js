// This is the final, correct version.
const app = require('./app')
const http = require('http')
// 1. CHANGE HERE: We only need to import the pool to initialize it.
const { connectToRedis } = require('./db/redis'); // <<< IMPORT THIS
const connectToMongoDB = require('./db/mongo');
const initializeSocket = require('./socket/socketHandler');
const { Server} = require('socket.io')

const PORT = process.env.PORT || 4000;

//We "give" our entire Express app object to this server. From now on, this server's job is to act as the primary receiver for all incoming HTTP requests and pass them to our app for processing.
const server = http.createServer(app)


//We "give" our server object to socket.io. This allows socket.io to listen to the server's internal events. socket.io is now also listening for incoming requests.
const io = new Server (server,{
 cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
})


// --- Simple "Hello, WebSocket!" Test ---
// This listens for new connections.
initializeSocket(io);
// --- Database Connections ---




// --- Start Server ---
async function startServer() {
  require('./db/mysql'); 
  await connectToMongoDB();
  await connectToRedis();

  server.listen(PORT, () => {
    console.log(`🚀 Server is  runndeing on http://localhost:${PORT}`);
  });
}



startServer();