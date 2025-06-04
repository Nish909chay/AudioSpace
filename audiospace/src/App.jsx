import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client';
import axios from 'axios';
import YouTube from 'react-youtube';
import './App.css'

// Easter egg DJ cat SVG (hidden by default)
const DjCat = () => (
  <div className="dj-cat" aria-label="Lo-fi DJ Cat" tabIndex={-1}>
    <svg width="180" height="120" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="90" cy="100" rx="70" ry="18" fill="#222" opacity="0.25"/>
      <circle cx="60" cy="60" r="32" fill="#FFD700" stroke="#1a1a1a" strokeWidth="6"/>
      <circle cx="120" cy="60" r="32" fill="#FFD700" stroke="#1a1a1a" strokeWidth="6"/>
      <ellipse cx="90" cy="80" rx="50" ry="18" fill="#1a1a1a"/>
      <ellipse cx="90" cy="80" rx="36" ry="12" fill="#FFD700" opacity="0.7"/>
      <ellipse cx="90" cy="80" rx="18" ry="6" fill="#1a1a1a"/>
      <ellipse cx="90" cy="80" rx="6" ry="2" fill="#FFD700"/>
      <rect x="70" y="60" width="40" height="20" rx="8" fill="#1a1a1a"/>
      <ellipse cx="80" cy="70" rx="4" ry="2" fill="#FFD700"/>
      <ellipse cx="100" cy="70" rx="4" ry="2" fill="#FFD700"/>
      <ellipse cx="90" cy="75" rx="6" ry="2" fill="#FFD700"/>
      <ellipse cx="60" cy="60" rx="8" ry="12" fill="#fff" opacity="0.7"/>
      <ellipse cx="120" cy="60" rx="8" ry="12" fill="#fff" opacity="0.7"/>
      <ellipse cx="60" cy="60" rx="3" ry="5" fill="#222"/>
      <ellipse cx="120" cy="60" rx="3" ry="5" fill="#222"/>
      <rect x="85" y="90" width="10" height="8" rx="4" fill="#fff"/>
      <ellipse cx="90" cy="94" rx="2" ry="1" fill="#222"/>
      <rect x="50" y="30" width="8" height="18" rx="4" fill="#FFD700"/>
      <rect x="122" y="30" width="8" height="18" rx="4" fill="#FFD700"/>
    </svg>
  </div>
);

const socket = io();

function App() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [user, setUser] = useState('');
  const [users, setUsers] = useState([]);
  const [track, setTrack] = useState('');
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoId, setVideoId] = useState('');
  const [showLoading, setShowLoading] = useState(true);
  const [showDjCat, setShowDjCat] = useState(false);
  const audioRef = useRef();
  // Store the YouTube player instance reliably
  const youTubePlayerRef = useRef();

  useEffect(() => {
    socket.on('roomCreated', ({ roomId, users }) => {
      setRoomId(roomId);
      setUsers(users);
      setJoined(true);
      // When joining a room, request sync
      socket.emit('syncRequest', { roomId });
    });
    socket.on('roomUpdate', (room) => {
      setUsers(room.users);
    });
    socket.on('errorMsg', (msg) => {
      setError(msg);
    });
    socket.on('playTrack', ({ track, position }) => {
      setTrack(track);
      setPlaying(true);
      setPosition(position);
      if (typeof track === 'string' && track.length === 11) {
        setVideoId(track);
        setTimeout(() => {
          if (youTubePlayerRef.current) {
            youTubePlayerRef.current.isPlayedByRemote = true;
            youTubePlayerRef.current.seekTo(position, true);
            youTubePlayerRef.current.playVideo();
            setTimeout(() => { youTubePlayerRef.current.isPlayedByRemote = false; }, 500);
          }
        }, 200);
      } else {
        setVideoId('');
        if (audioRef.current) {
          audioRef.current.src = track;
          audioRef.current.currentTime = position;
          audioRef.current.play();
        }
      }
    });
    socket.on('pauseTrack', ({ position }) => {
      setPlaying(false);
      setPosition(position);
      if (videoId && youTubePlayerRef.current) {
        youTubePlayerRef.current.isPausedByRemote = true;
        youTubePlayerRef.current.seekTo(position, true);
        youTubePlayerRef.current.pauseVideo();
        setTimeout(() => { youTubePlayerRef.current.isPausedByRemote = false; }, 500);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = position;
      }
    });
    socket.on('syncState', ({ track, position, playing }) => {
      setTrack(track || '');
      setPosition(position || 0);
      setPlaying(!!playing);
      if (typeof track === 'string' && track.length === 11) {
        setVideoId(track);
      } else if (track && audioRef.current) {
        setVideoId('');
        audioRef.current.src = track;
        audioRef.current.currentTime = position || 0;
        if (playing) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      }
    });
    return () => {
      socket.off('roomCreated');
      socket.off('roomUpdate');
      socket.off('errorMsg');
      socket.off('playTrack');
      socket.off('pauseTrack');
      socket.off('syncState');
    };
  }, []);

  // Parallax state
  const parallaxRef = useRef();
  useEffect(() => {
    // Loading screen timeout
    const t = setTimeout(() => setShowLoading(false), 1800);
    // Parallax effect
    const handleMouse = e => {
      if (parallaxRef.current) {
        const x = (e.clientX / window.innerWidth - 0.5) * 30;
        const y = (e.clientY / window.innerHeight - 0.5) * 30;
        parallaxRef.current.style.transform = `translate(-50%,-50%) rotateY(${-x}deg) rotateX(${y}deg)`;
      }
    };
    window.addEventListener('mousemove', handleMouse);
    return () => { clearTimeout(t); window.removeEventListener('mousemove', handleMouse); };
  }, []);

  // Logo double-click easter egg
  const handleLogoDoubleClick = () => {
    setShowDjCat(true);
    setTimeout(() => setShowDjCat(false), 3500);
  };

  const createRoom = () => {
    if (user) {
      socket.emit('createRoom', { user });
    }
  };

  const joinRoom = () => {
    if (roomId && user) {
      socket.emit('joinRoom', { roomId, user });
      setJoined(true);
      // When joining, request sync
      socket.emit('syncRequest', { roomId });
    }
  };

  const handlePlay = () => {
    if (roomId && track) {
      socket.emit('playTrack', { roomId, track, position: audioRef.current?.currentTime || 0 });
    }
  };

  const handlePause = () => {
    if (roomId) {
      if (videoId && youTubePlayerRef.current) {
        // Always emit pauseTrack for all users, not just local pause
        socket.emit('pauseTrack', { roomId, position: youTubePlayerRef.current.getCurrentTime() });
        // Then pause locally (which will trigger onStateChange, but isPausedByRemote will prevent loop)
        youTubePlayerRef.current.isPausedByRemote = true;
        youTubePlayerRef.current.pauseVideo();
        setTimeout(() => { youTubePlayerRef.current.isPausedByRemote = false; }, 500);
      } else if (audioRef.current) {
        socket.emit('pauseTrack', { roomId, position: audioRef.current.currentTime });
      }
    }
  };

  const searchTracks = async () => {
    setLoading(true);
    setError('');
    try {
      // Only YouTube search supported
      const res = await axios.get('/api/youtube/search', { params: { q: search } });
      setResults(res.data);
    } catch (e) {
      setError('Search failed');
    }
    setLoading(false);
  };

  // When a YouTube video is selected, broadcast to the room
  const handleSelectYouTube = (id) => {
    setVideoId(id);
    // Send the YouTube videoId as the track to all users
    if (roomId) {
      socket.emit('playTrack', { roomId, track: id, position: 0 });
    }
  };

  return (
    <div className="app-root">
      <nav className="app-navbar">
        <span className="app-logo gold" tabIndex={0} style={{ margin: '0 auto' }}>
          AudioSpace
        </span>
      </nav>
      <div className="main-centered-container">
        <div className="main-centered-card">
          {/* Main content: create/join room or room UI, centered and full width, scrollable if needed */}
          {!joined ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h2 style={{ textAlign: 'center', marginBottom: 32 }}>Create Room</h2>
              <input placeholder="Your Name" value={user} onChange={e => setUser(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createRoom(); }}
                style={{ width: '100%', marginBottom: 16 }}
              />
              <button className="gold-btn" onClick={createRoom} disabled={!user} style={{ width: '100%' }}>Create Room</button>
              <div style={{ margin: '32px 0', width: '100%', borderTop: '1px solid #232323', borderBottom: '1px solid #232323', padding: 24, textAlign: 'center' }}>
                <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Join Room</h2>
                <input placeholder="Room Code" value={roomId} onChange={e => setRoomId(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') joinRoom(); }}
                  style={{ width: '100%', marginBottom: 12 }}
                />
                <input placeholder="Your Name" value={user} onChange={e => setUser(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') joinRoom(); }}
                  style={{ width: '100%', marginBottom: 12 }}
                />
                <button className="gold-btn" onClick={joinRoom} disabled={!roomId || !user} style={{ width: '100%' }}>Join Room</button>
              </div>
              {error && <div style={{ color: '#d9534f', textAlign: 'center' }}>{error}</div>}
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <div>Room Code: <b>{roomId}</b></div>
              <div>User: {user}</div>
              <div>Users in Room: {users.join(', ')}</div>
              <div style={{ margin: '16px 0' }}>
                {/* Only YouTube search supported */}
                <input placeholder="Search YouTube Music" value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') searchTracks(); }}
                  style={{ width: '100%', marginBottom: 12 }}
                />
                <button onClick={searchTracks} disabled={!search || loading} style={{ width: '100%' }}>Search</button>
              </div>
              {error && <div style={{ color: '#d9534f', textAlign: 'center' }}>{error}</div>}
              {loading && <div>Loading...</div>}
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {results.map(track => (
                  <li key={track.id} style={{ margin: '8px 0', display: 'flex', alignItems: 'center' }}>
                    <img src={track.thumbnail} alt="thumb" style={{ width: 60, height: 45, marginRight: 8 }} />
                    <span style={{ flex: 1 }}>{track.title} <span style={{ color: '#888' }}>by {track.channel}</span></span>
                    <button onClick={() => handleSelectYouTube(track.id)}>Select</button>
                  </li>
                ))}
              </ul>
              {videoId && (
                <div style={{ margin: '16px 0' }}>
                  <YouTube
                    videoId={videoId}
                    opts={{ width: 400, height: 225, playerVars: { autoplay: 1 } }}
                    onReady={e => {
                      youTubePlayerRef.current = e.target;
                      // Sync to correct position if needed
                      if (playing && position) {
                        e.target.seekTo(position, true);
                        if (playing) e.target.playVideo();
                        else e.target.pauseVideo();
                      }
                    }}
                    onStateChange={e => {
                      // Only emit play/pause if this tab initiated the action
                      if (e.data === 2 && youTubePlayerRef.current && !youTubePlayerRef.current.isPausedByRemote) {
                        socket.emit('pauseTrack', { roomId, position: e.target.getCurrentTime() });
                      } else if (e.data === 1 && youTubePlayerRef.current && !youTubePlayerRef.current.isPlayedByRemote) {
                        socket.emit('playTrack', { roomId, track: videoId, position: e.target.getCurrentTime() });
                      }
                    }}
                  />
                </div>
              )}
              {/* Manual mp3 URL input for fallback */}
              <input placeholder="Track URL (mp3)" value={track} onChange={e => setTrack(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') handlePlay(); }}
                readOnly
              />
              <button onClick={handlePlay} disabled={!track} style={{ width: '100%' }}>Play</button>
              <button onClick={handlePause} style={{ width: '100%' }}>Pause</button>
              <audio ref={audioRef} controls style={{ display: 'block', marginTop: 16 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App
