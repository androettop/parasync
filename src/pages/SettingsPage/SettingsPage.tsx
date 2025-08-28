import Editor from "@monaco-editor/react";
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { RepoConfig } from "../../types/api";
import { SongRepository } from "../../utils/api";

const SettingsPage = () => {
  const [savedConfig, setSavedConfig] = useLocalStorage<RepoConfig | null>(
    "yaml-config",
    null
  );
  const [yamlText, setYamlText] = useState(
    stringifyYaml(savedConfig || {}, { indent: 2 })
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleYamlChange = (value?: string) => {
    setYamlText(value || "");
    setParseError(null);
    setSuccessMessage(null);
  };

  const handleParseAndSave = () => {
    if (!yamlText.trim()) {
      setParseError("Please enter your song library configuration");
      return;
    }

    try {
      const parsedConfig = parseYaml(yamlText) as RepoConfig;
      const repo = new SongRepository(parsedConfig);
      setSavedConfig(repo.config);
      setSuccessMessage("Song library settings saved successfully");
      setParseError(null);
    } catch (error) {
      setParseError(
        `Invalid configuration format. Please check your settings and try again.`
      );
      setSuccessMessage(null);
    }
  };

  const handleLoadSampleData = () => {
    const sampleData = `display_name: SampleAPI
name: sampleapi

search_url: |
  ~'https://sampleapi.com/api/maps?' ||
  'query=' || encodeURIComponent(query) ||
  '&limit=' || pageSize ||
  '&offset=' || ((page - 1) * pageSize) ||
  '&sort=' || 
  case(
    sortBy,
    ['uploadedAt', 'title', 'artist', 'uploadedBy', 'downloads'],
    ['submissionDate', 'title', 'artist', 'author', 'downloadCount']
  ) ||
  '&sortDirection=' || sortDirection
response:
  songs_array: ~response.maps
  serializer: msgpackr
  fields:
    id: ~song.id
    uploadedAt: ~song.submissionDate
    uploadedBy: ~song.author
    title: ~song.title
    artist: ~song.artist
    downloads: ~song.downloadCount
    coverUrl: ~'https://sampleapi.com/covers/' || song.id || '/' || song.albumArt
    downloadUrl: ~'https://maps.sampleapi.com/maps/' || song.id || '.zip'
    difficulties: |
      ~
      map(
        getFn('difficultyName'),
        song.difficulties
      )
`.trim();
    setYamlText(sampleData);
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
            Settings
          </Typography>
        </Grid>

        {/* YAML Configuration Section */}
        <Grid size={12}>
          <Paper sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Song Library Settings
            </Typography>

            <Stack spacing={2}>
              <Button variant="contained" onClick={handleLoadSampleData}>
                Load sample data (sampleapi.com)
              </Button>

              {/* Text Area */}
              <Editor
                defaultLanguage="yaml"
                height="400px"
                value={yamlText}
                onChange={handleYamlChange}
                theme="vs-dark"
                options={{ minimap: { enabled: false } }}
              />

              {/* Action Button */}
              <Button
                variant="contained"
                onClick={handleParseAndSave}
                disabled={!yamlText.trim()}
              >
                Save Settings
              </Button>

              {/* Error Alert */}
              {parseError && <Alert severity="error">{parseError}</Alert>}

              {/* Success Alert */}
              {successMessage && (
                <Alert severity="success">{successMessage}</Alert>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SettingsPage;
