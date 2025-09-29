const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const DocumentContent = require('../models/documentContentModel');
const documentModel = require('../models/documentModel'); // For authorization
const db = require('../db/mysql');
const { getRedisClient } = require('../db/redis'); // <<< 1. IMPORT our Redis getter
const AppError = require('../utils/appError');



// 1. AUTHENTICATION MIDDLEWARE FOR SOCKET.IO
//    This runs BEFORE any 'connection' event is established.
// ===================================================================
const socketProtect = async (socket, next) => {
  try {
    let token
 // First, try the standard 'auth' object (modern, preferred way)
    // We use optional chaining (?.) for safety.
    if (socket.handshake.auth?.token?.startsWith('Bearer ')) {
      token = socket.handshake.auth.token.split(' ')[1];
    } 
    // As a fallback, check the 'Authorization' header (for flexibility with other clients)
    else if (socket.handshake.headers?.authorization?.startsWith('Bearer ')) {
      token = socket.handshake.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Authentication error: Token not provided.', 401));
    }

    // Step 1: Verify the JWT.
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // Step 2: Check if the user still exists in our MySQL database.
      const [rows]=await db.execute( `select * from users where id=?`,[decoded.id])

            const currentUser = rows[0];

    if (!currentUser) {
      return next(new AppError('Authentication error: The user for this token no longer exists.', 401));
    }

    // Step 3: Attach the authenticated user to the socket object.
    socket.user = currentUser;
    next(); // Authentication successful, proceed to the 'connection' event.
  } catch (err) {
    // This will catch errors from jwt.verify (e.g., expired token, invalid signature)
    return next(new AppError('Authentication error: Invalid token.', 401));
  }
};

// This function will set up all our socket.io event listeners.
module.exports=function initializeSocket(io) {
  io.use(socketProtect);
  // This is the main connection event. Everything happens inside here.
  io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.user.username} (Socket ID: ${socket.id})`);
        // Listen for the 'joinDocument' event
    socket.on('joinDocument', async (documentId) => {
      try {
        // 1. If the user was already in a document, make them leave that old room.
        if (socket.currentDocumentId) {
            socket.leave(socket.currentDocumentId); 
            console.log(`User left room: ${socket.currentDocumentId}`);
          }


        socket.removeAllListeners('sendChanges');
        socket.removeAllListeners('saveDocument');
        socket.removeAllListeners('sendChatMessage');

        // هنشوف دلوقتي الدوكيمنت و اليوزر عندهم علاقة ببعض يعني أكسيس؟ ولا لا
          const hasAccess = await documentModel.findById(documentId, socket.user.id);
          if (!hasAccess) {
          socket.emit('documentError', { message: 'Authorization Failed: You do not have access to this document.' });
          socket.disconnect(true);
          return;
        }

        socket.currentDocumentId= documentId

      socket.join(documentId);
      console.log(`User ${socket.user.username} joined document room: ${documentId}`);

      // --- NEW LOGIC ---

        // 1. Find the document's content in MongoDB.
        //    The documentId from the client is used as the _id in MongoDB.
        const document = await DocumentContent.findById(documentId);

        if (!document) {
        const errorMessage = `Document content not found for ID: ${documentId}`;
          console.error(errorMessage);
          
          // Emit a 'documentError' event back to THIS client
          socket.emit('documentError', { message: errorMessage });
          return; // Stop further execution
        }

        // 2. Send the existing content to the user who just joined.
        //    'socket.emit()' sends a message only to this specific socket.
        socket.emit('loadDocument', document.content);

        try{
        // هنعمل list هنا للشات هيستوري
          const redisClient = getRedisClient();
          const chatKey = `chat:${socket.currentDocumentId}`
          const history = await redisClient.lRange(chatKey,-50,-1)
          const parsedHistory = history.map(item => JSON.parse(item));

          socket.emit('loadChatHistory', parsedHistory);

        }catch(error){
          console.error('Error loading chat history from Redis:', error);
          socket.emit('chatError', { message: 'Could not load chat history.' });
        }

        // هنعمل set هنا للاونلاين 
        try{
          
          const redisClient=getRedisClient();
          const presenceKey = `presence:${socket.currentDocumentId}`;
          const userId= socket.user.username;

          await redisClient.sAdd(presenceKey,userId)

          const onlineUsers=await redisClient.sMembers(presenceKey)

          io.to(socket.currentDocumentId).emit('updatePresence', onlineUsers);

        }catch(error){
         console.error('Error updating presence on join:', error);
        }
        
        socket.on('sendChatMessage', async(messageContent)=>{
          if (!messageContent || !socket.currentDocumentId) return;
              const message = {
                  username: socket.user.username,
                  content: messageContent,
                  timestamp: new Date().toISOString(),
              };

              try{
                const redisClient = getRedisClient();
                const chatKey = `chat:${socket.currentDocumentId}`

                await redisClient.rPush(chatKey, JSON.stringify(message));
                
                await redisClient.lTrim(chatKey, -100, -1);

                io.to(socket.currentDocumentId).emit('receiveChatMessage', message);

              }catch(error){
                console.error('Error saving/broadcasting chat message:', error);
                socket.emit('chatError', { message: 'Could not send message.' });
              }
        })

        socket.on('sendChanges',(delta)=>{

          socket.broadcast.to(socket.currentDocumentId).emit('receiveChanges',delta)
        })


        socket.on('saveDocument',async(content)=>{
          try{
            await DocumentContent.findByIdAndUpdate(socket.currentDocumentId, { content });
            // Optional: You could emit a confirmation back to the saving client
            socket.emit('documentSaved', { message: 'Document saved successfully!' });

          }catch (error) {
            console.error('Error saving document:', error);
            socket.emit('saveError', { message: 'Failed to save document.' });
        }
      })



        
      } catch (error) {
        // --- ERROR HANDLING 2: General database error ---
        const errorMessage = `Error fetching document content for ID ${documentId}: ${error.message}`;
        console.error(errorMessage);
        
        // Emit a 'documentError' event back to THIS client
        socket.emit('documentError', { message: 'A server error occurred while fetching the document.' });
      }
    });


    socket.on('disconnect',async () => {
      console.log(`👋 User disconnected: ${socket.user.username}`);


      // We need to check if the user was in a document room when they disconnected
      if (socket.currentDocumentId) {
        try {
          const redisClient = getRedisClient();
          const presenceKey = `presence:${socket.currentDocumentId}`;
          const userIdentifier = socket.user.username;

          // Remove the user from the presence Set
          await redisClient.sRem(presenceKey, userIdentifier);

          // Get the new, smaller list of online users
          const onlineUsers = await redisClient.sMembers(presenceKey);

          // Broadcast the updated list to the REMAINING users in the room
          // We use socket.broadcast here because the disconnected user can't receive it anyway
          socket.broadcast.to(socket.currentDocumentId).emit('updatePresence', onlineUsers);

        } catch (error) {
          console.error('Error updating presence on disconnect:', error);
        }
      }
    });
  });
};