import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
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
import { useEffect, useRef, useState } from "react";
import { Link as RRLink, useNavigate } from "react-router";
import SongCard from "../../components/SongCard/SongCard";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { RepoConfig, SearchParams } from "../../types/api";
import {
  Difficulty,
  DownloadState,
  LocalSong,
  Song,
  SortDirection,
} from "../../types/songs";
import { SongRepository } from "../../utils/api";
import { CARD_SIZE, PAGE_SIZE } from "../../utils/songs";
import { getSongFolderPrefix, unzipSong } from "../../utils/fs";
import useSongsPath from "../../hooks/useSongsPath";
import useLocalSongs from "../../hooks/useLocalSongs";

const SongsPage = () => {
  const [songsPath] = useSongsPath();
  const [songs, setSongs] = useState<{ song: Song; localSong?: LocalSong }[]>(
    [],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repoConfig] = useLocalStorage<RepoConfig | null>("yaml-config", null);
  const repoRef = useRef<SongRepository | null>(null);
  const [songsDownloadStates, setSongsDownloadStates] = useState<
    Record<string, DownloadState>
  >({});
  const localSongs = useLocalSongs();
  const navigate = useNavigate();
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<keyof Song>("uploadedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(false);

  // Initialize repository
  useEffect(() => {
    if (localSongs.length === 0 || repoRef.current) return;
    if (repoConfig) {
      repoRef.current = new SongRepository(repoConfig);
      handleSearch({
        query: searchQuery,
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy,
        sortDirection,
      });
    } else {
      setError(
        "No repository configuration found. Please set up your repositories in the settings.",
      );
    }
  }, [repoConfig, localSongs]);

  // Handlers
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleSearch = async ({
    query,
    page,
    pageSize,
    sortBy,
    sortDirection,
  }: SearchParams) => {
    // Prevent multiple concurrent searches
    if (!repoRef.current || repoRef.current.isLoading) return;
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      setCurrentPage(page);

      const onlineSongs = await repoRef.current.search({
        query: query.trim(),
        page,
        pageSize,
        sortBy,
        sortDirection,
      });

      // format and add localsongs if available

      const songs = onlineSongs.map((song) => {
        const data: { song: Song; localSong?: LocalSong } = {
          song,
          localSong: localSongs.find((localSong) => {
            if (!repoRef.current) return false;
            const prefix = getSongFolderPrefix(
              song.id,
              repoRef.current.config.name,
            );
            const isLocal = localSong.baseFileName.startsWith(prefix);
            console.log(localSong.baseFileName, prefix, isLocal);
            return isLocal;
          }),
        };
        return data;
      });

      if (page !== 1) {
        setSongs((prev) => [...prev, ...songs]);
      } else {
        setSongs(songs);
      }
      // Not perfect, but i'm lazy
      setHasMore(songs.length === PAGE_SIZE);
    } catch (err) {
      console.log(err);
      setError(err instanceof Error ? err.message : "Failed to search songs");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreSongs = async () => {
    handleSearch({
      query: searchQuery,
      page: currentPage + 1,
      pageSize: PAGE_SIZE,
      sortBy,
      sortDirection,
    });
  };

  const handleSortChange = (event: any) => {
    const newSortBy = event.target.value;
    setSortBy(newSortBy);
    handleSearch({
      query: searchQuery,
      page: 1,
      pageSize: PAGE_SIZE,
      sortBy: newSortBy,
      sortDirection,
    });
  };

  const handleDownload = async (song: Song) => {
    if (!songsPath || !repoRef.current) return;
    setSongsDownloadStates((prev) => ({ ...prev, [song.id]: "downloading" }));
    try {
      const zip = await repoRef.current.downloadZip(song);
      if (zip) {
        await unzipSong(songsPath, song.id, repoRef.current.config.name, zip);
      }
    } finally {
      setSongsDownloadStates((prev) => ({ ...prev, [song.id]: "downloaded" }));
    }
  };

  const handlePlay = async (localSong: LocalSong, difficulty: Difficulty) => {
    const fileName = `${localSong.baseFileName}_${difficulty}.rlrr`;
    const playerUrl = `/play?file=${encodeURIComponent(fileName)}`;
    navigate(playerUrl);
  };

  const handleSortDirectionToggle = () => {
    const newSortDirection = sortDirection === "asc" ? "desc" : "asc";
    setSortDirection(newSortDirection);
    handleSearch({
      query: searchQuery,
      page: 1,
      pageSize: PAGE_SIZE,
      sortBy,
      sortDirection: newSortDirection,
    });
  };

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
                  placeholder="Search songs or artists and press enter..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyUp={(e) => {
                    if (e.key === "Enter") {
                      handleSearch({
                        query: searchQuery,
                        page: 1,
                        pageSize: PAGE_SIZE,
                        sortBy,
                        sortDirection,
                      });
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
                    <MenuItem value="uploadedAt">Upload date</MenuItem>
                    <MenuItem value="title">Title</MenuItem>
                    <MenuItem value="artist">Artist</MenuItem>
                    <MenuItem value="uploadedBy">Mapper</MenuItem>
                    <MenuItem value="downloads">Downloads</MenuItem>
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
                {!isLoading && error && `${error}`}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Results */}
        {!error && (
          <Grid size={12}>
            <Grid container spacing={2}>
              {isLoading && currentPage === 1 ? (
                // Skeleton loading
                Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <Grid key={index} size={CARD_SIZE}>
                    <SongCard isLoading />
                  </Grid>
                ))
              ) : songs.length > 0 ? (
                songs.map((data) => {
                  return (
                    <Grid key={data.song.id} size={CARD_SIZE}>
                      <SongCard
                        title={data.song.title}
                        artist={data.song.artist}
                        coverImage={data.song.coverUrl || ""}
                        difficulties={data.song.difficulties}
                        downloadState={
                          data.localSong
                            ? "downloaded"
                            : songsDownloadStates[data.song.id] ||
                              "not-downloaded"
                        }
                        onDownload={() => handleDownload(data.song)}
                        onPlay={
                          data.localSong
                            ? (difficulty) =>
                                handlePlay(
                                  data.localSong as LocalSong,
                                  difficulty,
                                )
                            : undefined
                        }
                        downloads={data.song.downloads || 0}
                      />
                    </Grid>
                  );
                })
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
        )}
      </Grid>
    </Box>
  );
};

export default SongsPage;
