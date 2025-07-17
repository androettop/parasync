import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Chip,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Link,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import SongCard from "../../components/SongCard/SongCard";
import { APISong, DownloadState } from "../../types/songs";
import { Link as RRLink } from "react-router";

// Mock data for songs
const mockSongs: APISong[] = [
  {
    id: "1",
    title: "Through the Fire and Flames",
    artist: "DragonForce",
    author: "DragonForce",
    uploader: "GuitarHero_Fan",
    submissionDate: "2024-01-15",
    difficulties: ["Expert", "Hard", "Medium", "Easy"],
    downloadCount: 15420,
    url: "https://example.com/song1",
    albumArt:
      "https://placehold.co/300x300/FF6B6B/FFFFFF?text=Through+the+Fire+and+Flames",
    description: "Epic power metal song with blazing fast guitar solos",
  },
  {
    id: "2",
    title: "One",
    artist: "Metallica",
    author: "Metallica",
    uploader: "MetalMaster",
    submissionDate: "2024-01-10",
    difficulties: ["Expert", "Hard", "Medium"],
    downloadCount: 8750,
    url: "https://example.com/song2",
    albumArt: "https://placehold.co/300x300/2C2C2C/FFFFFF?text=One",
    description: "Classic heavy metal ballad",
  },
  {
    id: "3",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    author: "Queen",
    uploader: "RockLegend",
    submissionDate: "2024-01-05",
    difficulties: ["Expert", "Hard", "Medium", "Easy"],
    downloadCount: 22100,
    url: "https://example.com/song3",
    albumArt:
      "https://placehold.co/300x300/FFD700/000000?text=Bohemian+Rhapsody",
    description: "Legendary rock opera masterpiece",
  },
  {
    id: "4",
    title: "Master of Puppets",
    artist: "Metallica",
    author: "Metallica",
    uploader: "ThrashKing",
    submissionDate: "2024-01-08",
    difficulties: ["Expert", "Hard"],
    downloadCount: 12300,
    url: "https://example.com/song4",
    albumArt:
      "https://placehold.co/300x300/8B0000/FFFFFF?text=Master+of+Puppets",
    description: "Intense thrash metal anthem",
  },
  {
    id: "5",
    title: "Sweet Child O' Mine",
    artist: "Guns N' Roses",
    author: "Guns N' Roses",
    uploader: "AxlRose_Fan",
    submissionDate: "2024-01-12",
    difficulties: ["Expert", "Hard", "Medium", "Easy"],
    downloadCount: 18900,
    url: "https://example.com/song5",
    albumArt:
      "https://placehold.co/300x300/FFA500/000000?text=Sweet+Child+O'+Mine",
    description: "Classic rock hit with iconic guitar riffs",
  },
  {
    id: "6",
    title: "Thunderstruck",
    artist: "AC/DC",
    author: "AC/DC",
    uploader: "ThunderFan",
    submissionDate: "2024-01-03",
    difficulties: ["Expert", "Hard", "Medium"],
    downloadCount: 14600,
    url: "https://example.com/song6",
    albumArt: "https://placehold.co/300x300/4169E1/FFFFFF?text=Thunderstruck",
    description: "High-voltage rock anthem",
  },
];

const SongsPage = () => {
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("title");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

  // Download states (simulated)
  const [downloadStates, setDownloadStates] = useState<
    Record<string, DownloadState>
  >({
    "1": "downloaded",
    "2": "not-downloaded",
    "3": "downloaded",
    "4": "not-downloaded",
    "5": "not-downloaded",
    "6": "not-downloaded",
  });

  // Simulate initial loading
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Filter and sort songs
  const filteredAndSortedSongs = useMemo(() => {
    let filtered = mockSongs.filter((song) => {
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDifficulty =
        filterDifficulty === "all" ||
        song.difficulties.includes(filterDifficulty);

      return matchesSearch && matchesDifficulty;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "artist":
          return a.artist.localeCompare(b.artist);
        case "downloads":
          return (b.downloadCount || 0) - (a.downloadCount || 0);
        case "date":
          return (
            new Date(b.submissionDate || "").getTime() -
            new Date(a.submissionDate || "").getTime()
          );
        default:
          return 0;
      }
    });

    return filtered;
  }, [searchQuery, sortBy, filterDifficulty]);

  // Handlers
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleSortChange = (event: any) => {
    setSortBy(event.target.value);
  };

  const handleDifficultyChange = (event: any) => {
    setFilterDifficulty(event.target.value);
  };

  const handleDownload = (songId: string) => {
    setDownloadStates((prev) => ({
      ...prev,
      [songId]: "downloading",
    }));

    // Simulate download
    setTimeout(() => {
      setDownloadStates((prev) => ({
        ...prev,
        [songId]: "downloaded",
      }));
    }, 2000);
  };

  const handlePlay = (songId: string) => {
    console.log("Playing song:", songId);
    // Song play logic would go here
  };

  // Get all unique difficulties
  const allDifficulties = Array.from(
    new Set(mockSongs.flatMap((song) => song.difficulties)),
  );

  const cardSize = { xs: 6, sm: 4, md: 4, lg: 3, xl: 2 };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid size={12}>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            color="textPrimary"
          >
            Song Library
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Search and download songs to play from your repositories.{" "}
            <Link to="/settings" variant="body1" component={RRLink}>
              Manage your repositories
            </Link>
          </Typography>
        </Grid>

        {/* Search bar and filters */}
        <Grid size={12}>
          <Paper sx={{ p: 2 }}>
            <Grid container alignItems="center">
              {/* Search field */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  placeholder="Search songs or artists..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  variant="outlined"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Grid>

              {/* Sort by */}
              <Grid size={{ xs: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Sort by</InputLabel>
                  <Select
                    value={sortBy}
                    label="Sort by"
                    onChange={handleSortChange}
                  >
                    <MenuItem value="title">Title</MenuItem>
                    <MenuItem value="artist">Artist</MenuItem>
                    <MenuItem value="downloads">Downloads</MenuItem>
                    <MenuItem value="date">Date</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Filter by difficulty */}
              <Grid size={{ xs: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={filterDifficulty}
                    label="Difficulty"
                    onChange={handleDifficultyChange}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {allDifficulties.map((difficulty) => (
                      <MenuItem key={difficulty} value={difficulty}>
                        {difficulty}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Search statistics */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {isLoading
                  ? "Loading..."
                  : filteredAndSortedSongs.length === 1
                    ? "1 song found"
                    : `${filteredAndSortedSongs.length} songs found`}
                {searchQuery && (
                  <Chip
                    label={`Search: "${searchQuery}"`}
                    onDelete={() => setSearchQuery("")}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                )}
                {filterDifficulty !== "all" && (
                  <Chip
                    label={`Difficulty: ${filterDifficulty}`}
                    onDelete={() => setFilterDifficulty("all")}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                )}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Results */}
        <Grid size={12}>
          <Grid container spacing={2}>
            {isLoading ? (
              // Skeleton loading
              Array.from({ length: 6 }).map((_, index) => (
                <Grid key={index} size={cardSize}>
                  <SongCard isLoading />
                </Grid>
              ))
            ) : filteredAndSortedSongs.length > 0 ? (
              filteredAndSortedSongs.map((song) => (
                <Grid key={song.id} size={cardSize}>
                  <SongCard
                    title={song.title}
                    artist={song.artist}
                    coverImage={song.albumArt || ""}
                    difficulties={song.difficulties}
                    downloadState={downloadStates[song.id] || "not-downloaded"}
                    onDownload={() => handleDownload(song.id)}
                    onPlay={() => handlePlay(song.id)}
                  />
                </Grid>
              ))
            ) : (
              // No results
              <Grid size={12}>
                <Paper sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="h6" gutterBottom>
                    No songs found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try changing your search terms or adjusting the filters
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SongsPage;
