import Editor from "@monaco-editor/react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Link,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { RepoConfig } from "../../types/api";
import { SongRepository } from "../../utils/api";
import { getRepoConfigFromSampleAPI } from "../../utils/sampleapi";

const SettingsPage = () => {
  const [savedConfig, setSavedConfig] = useLocalStorage<RepoConfig | null>(
    "yaml-config",
    null,
  );
  const [mode, setMode] = useLocalStorage<"sample" | "custom">(
    "settings-mode",
    "sample",
  );
  const [apiName, setApiName] = useLocalStorage<string>(
    "api-name",
    "SampleAPI",
  );
  const [apiDomain, setApiDomain] = useLocalStorage<string>(
    "api-domain",
    "sampleapi.com",
  );
  const [yamlText, setYamlText] = useState(
    stringifyYaml(savedConfig || {}, { indent: 2 }),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Simple domain validator: no protocol, no slashes/spaces, valid labels and at least one dot
  const isValidDomain = (value: string) => {
    const d = value.trim();
    if (!d) return false;
    if (/^https?:\/\//i.test(d)) return false;
    if (/[\\/]/.test(d)) return false;
    if (/\s/.test(d)) return false;
    const domainRegex =
      /^(?=.{1,253}$)(?!-)([A-Za-z0-9-]{1,63}(?<!-))(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;
    return domainRegex.test(d);
  };

  const handleYamlChange = (value?: string) => {
    setYamlText(value || "");
    setParseError(null);
    setSuccessMessage(null);
  };

  const handleParseAndSave = () => {
    setSuccessMessage(null);
    setParseError(null);

    try {
      let effectiveYaml = yamlText;

      if (mode === "sample") {
        const name = apiName.trim();
        const domain = apiDomain.trim();
        if (!name || !domain) {
          setParseError("Please enter a name and domain for the API");
          return;
        }
        if (!isValidDomain(domain)) {
          setParseError(
            "Please enter a valid domain (e.g., sampleapi.com) without http(s) or path",
          );
          return;
        }
        // Build YAML from Sample API-compatible inputs
        effectiveYaml = getRepoConfigFromSampleAPI(name, domain);
        // keep background YAML in sync
        setYamlText(effectiveYaml);
      } else {
        if (!yamlText.trim()) {
          setParseError("Please enter your song library configuration");
          return;
        }
      }

      const parsedConfig = parseYaml(effectiveYaml) as RepoConfig;
      const repo = new SongRepository(parsedConfig);
      setSavedConfig(repo.config);
      setSuccessMessage("Song library settings saved successfully");
    } catch (error) {
      setParseError(
        `Invalid configuration format. Please check your settings and try again.`,
      );
      setSuccessMessage(null);
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

        {/* Source selection and configuration */}
        <Grid size={12}>
          <Paper sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Song Library Settings
            </Typography>

            <Stack spacing={2}>
              <FormControl>
                <FormLabel id="settings-mode-label">
                  Configuration source
                </FormLabel>
                <RadioGroup
                  row
                  aria-labelledby="settings-mode-label"
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value as "sample" | "custom")
                  }
                >
                  <FormControlLabel
                    value="sample"
                    control={<Radio />}
                    label="Sample API compatible"
                  />
                  <FormControlLabel
                    value="custom"
                    control={<Radio />}
                    label="Custom YAML"
                  />
                </RadioGroup>
              </FormControl>

              {mode === "sample" ? (
                <Stack spacing={2}>
                  <Typography variant="body2">
                    This mode supports APIs compatible with the Sample API spec.
                    See the mapping guide:{" "}
                    <Link
                      href="https://gist.github.com/androettop/14209d11f2c3f0d16d19774c0c16f90e"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Sample API compatibility gist
                    </Link>
                  </Typography>

                  <TextField
                    label="Display name"
                    value={apiName}
                    onChange={(e) => setApiName(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Domain"
                    value={apiDomain}
                    onChange={(e) => setApiDomain(e.target.value)}
                    error={
                      Boolean(apiDomain.trim()) && !isValidDomain(apiDomain)
                    }
                    helperText={
                      apiDomain.trim() && !isValidDomain(apiDomain)
                        ? "Invalid domain. Use a domain like example.com (no http/https or path)."
                        : "Do not include protocol. Example: sampleapi.com — usually the website/library domain."
                    }
                    fullWidth
                  />
                </Stack>
              ) : (
                <>
                  {/* Optional helper */}
                  <Typography variant="body2">
                    Paste or edit your repository configuration in YAML.
                  </Typography>

                  {/* Text Area */}
                  <Editor
                    defaultLanguage="yaml"
                    height="400px"
                    value={yamlText}
                    onChange={handleYamlChange}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false } }}
                  />
                </>
              )}

              {/* Action Button */}
              <Button
                variant="contained"
                onClick={handleParseAndSave}
                disabled={
                  mode === "sample"
                    ? !apiName.trim() ||
                      !apiDomain.trim() ||
                      !isValidDomain(apiDomain)
                    : !yamlText.trim()
                }
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
