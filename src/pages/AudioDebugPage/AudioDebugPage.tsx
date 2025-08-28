import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  Typography,
  Alert,
  Slider,
  Chip,
} from "@mui/material";
import { useState, useEffect } from "react";

// Declaración para TypeScript
declare global {
  interface Window {
    __TAURI_INTERNALS__: {
      invoke: (cmd: string, args?: any) => Promise<any>;
    };
  }
}

interface AudioStatus {
  position: number;
  duration: number;
  playing: boolean;
}

const AudioDebugPage = () => {
  const [audioPath, setAudioPath] = useState("/Users/pablo/Desktop/song.ogg");
  const [audioId, setAudioId] = useState<number | null>(null);
  const [status, setStatus] = useState<AudioStatus | null>(null);
  const [volume, setVolume] = useState(1.0);
  const [seekPosition, setSeekPosition] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setError(null);
    setTimeout(() => setMessage(null), 3000);
  };

  const showError = (err: string) => {
    setError(err);
    setMessage(null);
    setTimeout(() => setError(null), 5000);
  };

  // Función para actualizar el estado del audio periódicamente
  useEffect(() => {
    if (audioId === null) return;

    const interval = setInterval(async () => {
      try {
        const audioStatus = await window.__TAURI_INTERNALS__.invoke("get_audio_status", { id: audioId });
        setStatus(audioStatus);
      } catch (err) {
        console.error("Error getting audio status:", err);
      }
    }, 500); // Actualizar cada 500ms

    return () => clearInterval(interval);
  }, [audioId]);

  const loadAudio = async () => {
    try {
      setError(null);
      const id = await window.__TAURI_INTERNALS__.invoke("load_audio", { path: audioPath });
      setAudioId(id);
      showMessage(`Audio loaded with ID: ${id}`);
    } catch (err) {
      showError(`Error loading audio: ${err}`);
    }
  };

  const playAudio = async () => {
    if (audioId === null) {
      showError("No audio loaded");
      return;
    }
    try {
      await window.__TAURI_INTERNALS__.invoke("play_audio", { id: audioId });
      showMessage("Audio playing");
    } catch (err) {
      showError(`Error playing audio: ${err}`);
    }
  };

  const pauseAudio = async () => {
    if (audioId === null) {
      showError("No audio loaded");
      return;
    }
    try {
      await window.__TAURI_INTERNALS__.invoke("pause_audio", { id: audioId });
      showMessage("Audio paused");
    } catch (err) {
      showError(`Error pausing audio: ${err}`);
    }
  };

  const stopAudio = async () => {
    if (audioId === null) {
      showError("No audio loaded");
      return;
    }
    try {
      await window.__TAURI_INTERNALS__.invoke("stop_audio", { id: audioId });
      showMessage("Audio stopped");
    } catch (err) {
      showError(`Error stopping audio: ${err}`);
    }
  };

  const seekAudio = async () => {
    if (audioId === null) {
      showError("No audio loaded");
      return;
    }
    try {
      await window.__TAURI_INTERNALS__.invoke("seek_audio", { id: audioId, position: seekPosition });
      showMessage(`Seeked to ${seekPosition} seconds`);
    } catch (err) {
      showError(`Error seeking audio: ${err}`);
    }
  };

  const setVolumeAudio = async (newVolume: number) => {
    if (audioId === null) {
      showError("No audio loaded");
      return;
    }
    try {
      await window.__TAURI_INTERNALS__.invoke("set_volume", { id: audioId, volume: newVolume });
      setVolume(newVolume);
      showMessage(`Volume set to ${Math.round(newVolume * 100)}%`);
    } catch (err) {
      showError(`Error setting volume: ${err}`);
    }
  };

  const unloadAudio = async () => {
    if (audioId === null) {
      showError("No audio loaded");
      return;
    }
    try {
      await window.__TAURI_INTERNALS__.invoke("unload_audio", { id: audioId });
      setAudioId(null);
      setStatus(null);
      showMessage("Audio unloaded");
    } catch (err) {
      showError(`Error unloading audio: ${err}`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        Audio Debug Page
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Test all Tauri audio backend functions
      </Typography>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Load Audio Section */}
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Load Audio
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Audio File Path"
                  value={audioPath}
                  onChange={(e) => setAudioPath(e.target.value)}
                  placeholder="/path/to/your/audio/file.ogg"
                  helperText="Enter the full path to your OGG audio file"
                />
                <Button variant="contained" onClick={loadAudio}>
                  Load Audio
                </Button>
                {audioId !== null && (
                  <Chip 
                    label={`Audio ID: ${audioId}`} 
                    color="primary" 
                    size="small" 
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Audio Status */}
        {status && (
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Audio Status
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={4}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip 
                      label={status.playing ? "Playing" : "Paused"} 
                      color={status.playing ? "success" : "default"}
                    />
                  </Grid>
                  <Grid size={4}>
                    <Typography variant="body2" color="text.secondary">
                      Position
                    </Typography>
                    <Typography variant="body1">
                      {formatTime(status.position)} / {formatTime(status.duration)}
                    </Typography>
                  </Grid>
                  <Grid size={4}>
                    <Typography variant="body2" color="text.secondary">
                      Progress
                    </Typography>
                    <Typography variant="body1">
                      {status.duration > 0 ? Math.round((status.position / status.duration) * 100) : 0}%
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Playback Controls */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Playback Controls
              </Typography>
              <Stack spacing={2}>
                <Button variant="contained" color="success" onClick={playAudio}>
                  Play
                </Button>
                <Button variant="contained" color="warning" onClick={pauseAudio}>
                  Pause
                </Button>
                <Button variant="contained" color="error" onClick={stopAudio}>
                  Stop
                </Button>
                <Button variant="outlined" color="error" onClick={unloadAudio}>
                  Unload
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Volume Control */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Volume Control
              </Typography>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Volume: {Math.round(volume * 100)}%
                </Typography>
                <Slider
                  value={volume}
                  onChange={(_, newValue) => setVolumeAudio(newValue as number)}
                  min={0}
                  max={1}
                  step={0.1}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 0.5, label: '50%' },
                    { value: 1, label: '100%' },
                  ]}
                />
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setVolumeAudio(0)}>
                    Mute
                  </Button>
                  <Button size="small" onClick={() => setVolumeAudio(0.5)}>
                    50%
                  </Button>
                  <Button size="small" onClick={() => setVolumeAudio(1)}>
                    100%
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Seek Control */}
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Seek Control
              </Typography>
              <Stack spacing={2}>
                <TextField
                  type="number"
                  label="Seek Position (seconds)"
                  value={seekPosition}
                  onChange={(e) => setSeekPosition(Number(e.target.value))}
                  inputProps={{ min: 0, step: 0.1 }}
                />
                <Button variant="contained" onClick={seekAudio}>
                  Seek to Position
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => { setSeekPosition(0); seekAudio(); }}>
                    Start
                  </Button>
                  <Button size="small" onClick={() => { setSeekPosition(10); seekAudio(); }}>
                    +10s
                  </Button>
                  <Button size="small" onClick={() => { setSeekPosition(30); seekAudio(); }}>
                    +30s
                  </Button>
                  {status && (
                    <Button 
                      size="small" 
                      onClick={() => { setSeekPosition(status.duration / 2); seekAudio(); }}
                    >
                      Middle
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Test Sequence */}
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Automated Test Sequence
              </Typography>
              <Button 
                variant="outlined" 
                fullWidth
                onClick={() => runTestSequence()}
              >
                Run Full Test Sequence
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  async function runTestSequence() {
    if (audioId === null) {
      showError("Please load an audio file first");
      return;
    }

    showMessage("Starting automated test sequence...");
    
    try {
      // Test 1: Play
      await new Promise(resolve => setTimeout(resolve, 1000));
      await playAudio();
      
      // Test 2: Wait and adjust volume
      await new Promise(resolve => setTimeout(resolve, 2000));
      await setVolumeAudio(0.5);
      
      // Test 3: Seek to middle
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (status) {
        await window.__TAURI_INTERNALS__.invoke("seek_audio", { id: audioId, position: status.duration / 2 });
      }
      
      // Test 4: Pause
      await new Promise(resolve => setTimeout(resolve, 2000));
      await pauseAudio();
      
      // Test 5: Resume
      await new Promise(resolve => setTimeout(resolve, 1000));
      await playAudio();
      
      // Test 6: Stop
      await new Promise(resolve => setTimeout(resolve, 2000));
      await stopAudio();
      
      showMessage("Test sequence completed successfully!");
      
    } catch (err) {
      showError(`Test sequence failed: ${err}`);
    }
  }
};

export default AudioDebugPage;
