import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RRLink } from "react-router";
import SongCard from "../../components/SongCard/SongCard";
import { searchSongs } from "../../game/helpers/apiService";
import {
  APISearchResponse,
  APISong,
  APISongsResponse,
} from "../../types/songs";

const PAGE_SIZE = 40;

const SongsPage = () => {
  const [songs, setSongs] = useState<APISong[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("submissionDate");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

  // Load initial songs
  useEffect(() => {
    handleSearch("", "submissionDate");
  }, []);

  // Handlers
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleSearch = async (
    _searchTerm: string,
    sortBy: string,
    page = 1,
  ) => {
    const searchTerm = _searchTerm.trim();

    setIsLoading(true);
    setError(null);
    try {
      setCurrentPage(page);

      const response: APISearchResponse = await searchSongs(
        searchTerm,
        page,
        sortBy,
        PAGE_SIZE,
      );
      if (page !== 1) {
        setSongs((prev) => [...prev, ...response.data]);
      } else {
        setSongs(response.data);
      }
      setHasMore(response.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search songs");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreSongs = async () => {
    if (isLoading || !hasMore) return;
    handleSearch(searchQuery, sortBy, currentPage + 1);
  };

  const handleSortChange = (event: any) => {
    setSortBy(event.target.value);
    setTimeout(() => {
      handleSearch(searchQuery, event.target.value, 1);
    }, 100);
  };

  const handleDifficultyChange = (event: any) => {
    setFilterDifficulty(event.target.value);
    setTimeout(() => {
      handleSearch(searchQuery, sortBy, 1);
    }, 100);
  };

  const handleDownload = (songId: string) => {
    // TODO: Implement download logic
  };

  const handlePlay = (songId: string) => {
    console.log("Playing song:", songId);
    // Song play logic would go here
  };

  // Get all unique difficulties
  const allDifficulties = ["Hard", "Medium", "Easy", "Expert"];

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
            <Grid container spacing={2} alignItems="center">
              {/* Search field */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  placeholder="Search songs or artists..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyUp={(e) => {
                    if (e.key === "Enter") {
                      handleSearch(searchQuery, sortBy);
                    }
                  }}
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
                    <MenuItem value="submissionDate">Upload date</MenuItem>
                    <MenuItem value="title">Title</MenuItem>
                    <MenuItem value="artist">Artist</MenuItem>
                    <MenuItem value="author">Mapper</MenuItem>
                    <MenuItem value="downloadCount">Downloads</MenuItem>
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
                  : songs.length === 1
                    ? "1 song found"
                    : `${songs.length} songs found`}
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
            {error && (
              <Grid size={12}>
                <Paper sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="h6" color="error">
                    Error: {error}
                  </Typography>
                </Paper>
              </Grid>
            )}
            {isLoading && currentPage === 1 ? (
              // Skeleton loading
              Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <Grid key={index} size={cardSize}>
                  <SongCard isLoading />
                </Grid>
              ))
            ) : songs.length > 0 ? (
              songs.map((song) => (
                <Grid key={song.id} size={cardSize}>
                  <SongCard
                    title={song.title}
                    artist={song.artist}
                    coverImage={song.albumArt || ""}
                    difficulties={song.difficulties}
                    downloadState={"not-downloaded"}
                    onDownload={() => handleDownload(song.id)}
                    onPlay={() => handlePlay(song.id)}
                    downloads={song.downloadCount || 0}
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

            {hasMore && (
              <Grid size={12}>
                <Button
                  sx={{
                    p: 2,
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                  disabled={isLoading}
                  loading={isLoading}
                  fullWidth
                  onClick={loadMoreSongs}
                >
                  Load more songs
                </Button>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SongsPage;
