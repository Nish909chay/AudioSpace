// Entry point for the backend server (CommonJS)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// In-memory room state (for demo)
const rooms = {};

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'audiospace';
let db;

MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then(client => {
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Save room and user info to DB
async function saveRoomUser(roomId, user) {
  if (!db) return;
  const roomsCol = db.collection('rooms');
  await roomsCol.updateOne(
    { roomId },
    { $addToSet: { users: user }, $setOnInsert: { created: new Date() } },
    { upsert: true }
  );
}

// Remove user from room in DB
async function removeRoomUser(roomId, user) {
  if (!db) return;
  const roomsCol = db.collection('rooms');
  await roomsCol.updateOne(
    { roomId },
    { $pull: { users: user } }
  );
  // Remove room if empty
  const room = await roomsCol.findOne({ roomId });
  if (room && (!room.users || room.users.length === 0)) {
    await roomsCol.deleteOne({ roomId });
  }
}

// Get users in a room from DB
async function getRoomUsers(roomId) {
  if (!db) return [];
  const room = await db.collection('rooms').findOne({ roomId });
  return room?.users || [];
}

// Socket.IO logic for room join/sync
io.on('connection', (socket) => {
  socket.on('createRoom', async ({ user }) => {
    const roomId = uuidv4();
    rooms[roomId] = { users: [user], track: null, position: 0, playing: false };
    socket.join(roomId);
    socket.user = user;
    socket.roomId = roomId;
    await saveRoomUser(roomId, user);
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
    socket.emit('roomCreated', { roomId, users: rooms[roomId].users });
  });

  socket.on('joinRoom', async ({ roomId, user }) => {
    // Always try to load the latest users from DB
    const dbUsers = await getRoomUsers(roomId);
    if (!dbUsers.length) {
      socket.emit('errorMsg', 'Room does not exist');
      return;
    }
    // Sync in-memory state with DB
    rooms[roomId] = rooms[roomId] || { users: dbUsers, track: null, position: 0, playing: false };
    rooms[roomId].users = dbUsers;
    // Prevent duplicate usernames in the same room
    if (rooms[roomId].users.includes(user)) {
      socket.emit('errorMsg', 'Username already taken in this room');
      return;
    }
    socket.join(roomId);
    rooms[roomId].users.push(user);
    socket.user = user;
    socket.roomId = roomId;
    await saveRoomUser(roomId, user);
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  socket.on('playTrack', ({ roomId, track, position }) => {
    if (rooms[roomId]) {
      rooms[roomId].track = track;
      rooms[roomId].position = position;
      rooms[roomId].playing = true;
      // Broadcast to all users in the room, including the sender
      io.to(roomId).emit('playTrack', { track, position });
    }
  });

  socket.on('pauseTrack', ({ roomId, position }) => {
    if (rooms[roomId]) {
      rooms[roomId].playing = false;
      rooms[roomId].position = position;
      io.to(roomId).emit('pauseTrack', { position });
    }
  });

  // When a user joins, sync them with the current track/position/playing state
  socket.on('syncRequest', ({ roomId }) => {
    if (rooms[roomId]) {
      socket.emit('syncState', {
        track: rooms[roomId].track,
        position: rooms[roomId].position,
        playing: rooms[roomId].playing
      });
    }
  });

  socket.on('disconnecting', async () => {
    const { roomId, user } = socket;
    if (roomId && rooms[roomId]) {
      // Remove all instances of the user (just in case)
      rooms[roomId].users = rooms[roomId].users.filter(u => u !== user);
      await removeRoomUser(roomId, user);
      // If no users left, delete room from memory and DB
      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
        // removeRoomUser already deletes from DB if empty
      } else {
        io.to(roomId).emit('roomUpdate', rooms[roomId]);
      }
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// YouTube search endpoint
app.get('/api/youtube/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q,
        type: 'video',
        maxResults: 10,
        key: 'AIzaSyCh3gJfoUgFMS9e77JTzmZNJR6U2ftvLqw'
      }
    });
    res.json(response.data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.default.url
    })));
  } catch (e) {
    res.status(500).json({ error: 'YouTube API error', details: e.message });
  }
});

// Serve React build static files
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
