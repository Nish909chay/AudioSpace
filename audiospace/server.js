// Entry point for the backend server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const { MongoClient } = require('mongodb');

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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'audiospace';
let db;

// Use correct options for MongoDB Atlas and remove deprecated useUnifiedTopology
MongoClient.connect(MONGO_URI, {
  tls: true,
  retryWrites: true,
  w: 'majority',
})
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
  const rooms = db.collection('rooms');
  await rooms.updateOne(
    { roomId },
    { $addToSet: { users: user }, $setOnInsert: { created: new Date() } },
    { upsert: true }
  );
}

// Socket.IO logic for room join/sync
io.on('connection', (socket) => {
  socket.on('joinRoom', async ({ roomId, user }) => {
    // Create room in memory if it doesn't exist
    if (!rooms[roomId]) rooms[roomId] = { users: [], track: null, position: 0, playing: false };
    // Add user if not already present
    if (!rooms[roomId].users.includes(user)) {
      rooms[roomId].users.push(user);
      await saveRoomUser(roomId, user);
    }
    socket.join(roomId);
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
    // Sync new user with current state
    socket.emit('syncState', {
      track: rooms[roomId].track,
      position: rooms[roomId].position,
      playing: rooms[roomId].playing
    });
  });

  socket.on('playTrack', ({ roomId, track, position }) => {
    if (rooms[roomId]) {
      rooms[roomId].track = track;
      rooms[roomId].position = position;
      rooms[roomId].playing = true;
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

  socket.on('disconnecting', () => {
    // Optionally handle user leaving
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// SoundCloud search endpoint
app.get('/api/soundcloud/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  try {
    // Public SoundCloud API (no auth, limited results)
    const response = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
      params: {
        q,
        client_id: '2t9loNQH90kzJcsFCODdigxfp325aq4z', // public client_id, for demo only
        limit: 10
      }
    });
    res.json(response.data.collection.map(track => ({
      id: track.id,
      title: track.title,
      user: track.user.username,
      artwork: track.artwork_url,
      stream_url: track.media.transcodings.find(t => t.format.protocol === 'progressive')?.url,
      permalink_url: track.permalink_url
    })));
  } catch (e) {
    res.status(500).json({ error: 'SoundCloud API error', details: e.message });
  }
});

// YouTube search endpoint
app.get('/api/youtube/search', async (req, res) => {
  const { q } = req.query;
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  if (!YOUTUBE_API_KEY) return res.status(500).json({ error: 'Missing YouTube API key' });
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q,
        type: 'video',
        maxResults: 10,
        key: YOUTUBE_API_KEY
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

// API to get saved rooms for a user
app.get('/api/rooms/:user', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB not ready' });
  const rooms = db.collection('rooms');
  const userRooms = await rooms.find({ users: req.params.user }).toArray();
  res.json(userRooms.map(r => r.roomId));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
