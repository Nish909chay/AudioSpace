# AudioSpace

AudioSpace is a collaborative audio room web app where users can join rooms, search for tracks (YouTube/SoundCloud), and listen together in sync.
This project was my first deployment on Render and served as a learning experience in cloud deployment, backend/frontend integration, and real-time synchronization.

# Features
Room-based audio sharing: Users can join or create rooms and listen to tracks together.

Real-time sync: Play, pause, and track position are synchronized for all users in a room using Socket.IO.

Search: Integrated SoundCloud and YouTube search APIs.

Persistent rooms: Room and user data are stored in MongoDB Atlas.

REST API: Used for health checks, room management, and search.

Deployed on Render: Free tier, with all its quirks and learning opportunities.

# Technologies Used
## 🛠️ Technologies Used

- **Node.js**: JavaScript runtime for the backend server.
- **Express**: Web framework for building REST APIs.
- **Socket.IO**: Enables real-time, bidirectional communication for room synchronization (play/pause, track position).
- **MongoDB Atlas**: Cloud-hosted NoSQL database for storing room and user data.
- **Axios**: HTTP client for making API requests to SoundCloud and YouTube.
- **Render**: Cloud platform used for deploying and hosting the backend service.
- **YouTube APIs**: For searching and streaming audio tracks.

# How to Run Locally

Clone the repository

sh
Copy
Edit
git clone https://github.com/Nish909chay/AudioSpace.git
cd AudioSpace/audiospace

Install dependencies
sh
Copy
Edit
npm install
Set up MongoDB

Use a MongoDB Atlas cluster.

Obtain the connection string and set it as an environment variable:

sh
Copy
Edit
export MONGO_URI='your_connection_string_here'
Start the server

sh
Copy
Edit
npm start
The backend will run at:
http://localhost:4000

# How to Deploy on Render

Push your code to GitHub.

Create a new Web Service on Render:

Choose Node as the environment.

Set the root directory to audiospace if needed.

Add your MONGO_URI as an Environment Variable in the Render dashboard.

Render will auto-detect your start script and deploy.

# Free Tier Notes
Service may sleep after 15 minutes of inactivity (cold start delay).

Limited resources and monthly hours.

For always-on deployment, consider upgrading to a paid plan.

# Problems Faced & Solutions

MongoDB Atlas SSL/TLS Error

Problem: MongoServerSelectionError: SSL routines:tlsv1 alert internal error

Solution: Used correct connection options:

js
Copy
Edit
tls: true, retryWrites: true, w: 'majority'
Removed deprecated useUnifiedTopology option.

Express Route Error on Render

Problem: TypeError: Missing parameter name at 1: https://git.new/pathToRegexpError

Solution: Ensured all Express routes had valid parameter names and unified backend dependencies to Express 4.x.

Git Push Rejected

Problem: Updates rejected due to remote having unrelated history.

Solution: Pulled with --allow-unrelated-histories, resolved merge conflicts, and pushed again.

Room Synchronization Issues

Problem: Play/Pause not syncing; "room does not exist" until a track is played.

Solution: Improved backend logic to:

Create rooms upon join,

Always broadcast play/pause,

Sync state to newly joined users.

General Render Learning

Learned how to:

Set up environment variables,

Handle Render’s sleep/cold start behavior,

Use the deployment dashboard effectively.

Synchronization Logic
Uses Socket.IO for real-time communication.

On joining a room:

The server checks/creates the room in memory.

Syncs the current track state to the new user.

Play/Pause events are broadcast to all users in the room.

Room and user information is stored in MongoDB for persistence.

# Git 
# Clone
git clone https://github.com/Nish909chay/AudioSpace.git

# Stage + Commit
git add .
git commit -m "message"

# Push
git push origin main

# Pull (if needed)
git pull origin main --allow-unrelated-histories

# Resolve conflicts manually, then:
git add .
git commit -m "resolved conflicts"
Summary
This project was my first deployment on Render and a comprehensive learning journey into:

Cloud hosting

Node.js backend development

Real-time synchronization using Socket.IO

MongoDB Atlas integration

If you are new to Render or real-time apps, this project is a solid starting point.

Live Demo:
https://audiospacee.onrender.com
