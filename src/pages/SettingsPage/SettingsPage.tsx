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
    null,
  );
  const [yamlText, setYamlText] = useState(
    stringifyYaml(savedConfig || {}, { indent: 2 }),
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
        `Invalid configuration format. Please check your settings and try again.`,
      );
      setSuccessMessage(null);
    }
  };

  const handleClear = () => {
    setYamlText("");
    setSavedConfig(null);
    setParseError(null);
    setSuccessMessage(null);
  };

  const handleLoadSample = async () => {
    try {
      const response = await fetch("/sample-config.yaml");
      const sampleYaml = await response.text();
      setYamlText(sampleYaml);
      setParseError(null);
      setSuccessMessage(null);
    } catch (error) {
      setParseError("Could not load example configuration");
    }
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
              {/* Buttons */}
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" onClick={handleLoadSample}>
                  Load Example
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleClear}
                >
                  Clear
                </Button>
              </Stack>

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
