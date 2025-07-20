import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  FormControl,
  Grid,
  IconButton,
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
import { Song, SortDirection } from "../../types/songs";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

const PAGE_SIZE = 40;

const searchSongs = (..._a: any[]): Song[] => {
  throw new Error("searchSong function not implemented");
};

const SongsPage = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("submissionDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(false);

  // Load initial songs
  useEffect(() => {
    handleSearch();
  }, []);

  // Handlers
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleSearch = async (
    _searchTerm: string = "",
    sortBy: string = "submissionDate",
    sortByDirection: SortDirection = "desc",
    page = 1,
  ) => {
    if (isLoading) return; // Prevent multiple concurrent searches
    const searchTerm = _searchTerm.trim();

    setIsLoading(true);
    setError(null);
    try {
      setCurrentPage(page);

      const songs = await searchSongs(
        searchTerm,
        page,
        sortBy,
        sortByDirection,
        PAGE_SIZE,
      );
      if (page !== 1) {
        setSongs((prev) => [...prev, ...songs]);
      } else {
        setSongs(songs);
      }
      // Not perfect, but i'm lazy
      setHasMore(songs.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search songs");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreSongs = async () => {
    if (isLoading || !hasMore) return;
    handleSearch(searchQuery, sortBy, sortDirection, currentPage + 1);
  };

  const handleSortChange = (event: any) => {
    const newSortBy = event.target.value;
    setSortBy(newSortBy);
    handleSearch(searchQuery, newSortBy, sortDirection, 1);
  };

  const handleDownload = (_songId: string) => {
    // TODO: Implement download logic
  };

  const handlePlay = (songId: string) => {
    console.log("Playing song:", songId);
    // Song play logic would go here
  };

  const handleSortDirectionToggle = () => {
    const newSortDirection = sortDirection === "asc" ? "desc" : "asc";
    setSortDirection(newSortDirection);
    handleSearch(searchQuery, sortBy, newSortDirection, 1);
  };

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
              <Grid size={{ xs: 12, md: "grow" }}>
                <TextField
                  fullWidth
                  size="small"
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
              <Grid size={{ xs: "grow", md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Sort by</InputLabel>
                  <Select
                    value={sortBy}
                    label="Sort by"
                    onChange={handleSortChange}
                    size="small"
                    disabled={isLoading}
                    MenuProps={{
                      disableScrollLock: true,
                    }}
                  >
                    <MenuItem value="submissionDate">Upload date</MenuItem>
                    <MenuItem value="title">Title</MenuItem>
                    <MenuItem value="artist">Artist</MenuItem>
                    <MenuItem value="author">Mapper</MenuItem>
                    <MenuItem value="downloadCount">Downloads</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Sort direction toggle */}
              <Grid size={{ xs: "auto" }}>
                <IconButton
                  centerRipple
                  sx={{ height: 40, width: 40 }}
                  disabled={isLoading}
                  onClick={() => handleSortDirectionToggle()}
                >
                  {sortDirection === "asc" ? (
                    <ArrowUpwardIcon />
                  ) : (
                    <ArrowDownwardIcon />
                  )}
                </IconButton>
              </Grid>
            </Grid>

            {/* Search statistics */}
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                color={!isLoading && error ? "error" : "text.secondary"}
              >
                {isLoading && "Loading..."}
                {!isLoading && !error && songs.length === 1 && "1 song found"}
                {!isLoading &&
                  !error &&
                  songs.length > 1 &&
                  `${songs.length} songs found`}
                {!isLoading && error && `Error: ${error}`}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Results */}
        <Grid size={12}>
          <Grid container spacing={2}>
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
                    coverImage={song.coverUrl || ""}
                    difficulties={song.difficulties}
                    downloadState={"not-downloaded"}
                    onDownload={() => handleDownload(song.id)}
                    onPlay={() => handlePlay(song.id)}
                    downloads={song.downloads || 0}
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
                  variant="outlined"
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
