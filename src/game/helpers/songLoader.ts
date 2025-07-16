import { v4 as uuid } from "uuid";
import { SongData } from "../../types/songs";

/**
 * Allows the user to select a folder of songs
 */
export const selectSongsFolder =
  async (): Promise<FileSystemDirectoryHandle | null> => {
    try {
      // @ts-expect-error Typescript doesn't know about showDirectoryPicker
      const directoryHandle = await window.showDirectoryPicker();
      return directoryHandle;
    } catch (error) {
      console.error("Error selecting the folder:", error);
      return null;
    }
  };

/**
 * Finds all JSON files in a folder and its subfolders
 */
export const findJsonFiles = async (
  directoryHandle: FileSystemDirectoryHandle
): Promise<
  Map<
    string,
    {
      file: FileSystemFileHandle;
      parentDir: FileSystemDirectoryHandle;
      path: string;
    }
  >
> => {
  const jsonFiles = new Map<
    string,
    {
      file: FileSystemFileHandle;
      parentDir: FileSystemDirectoryHandle;
      path: string;
    }
  >();

  // Recursive function to explore folders
  async function exploreDirectory(
    handle: FileSystemDirectoryHandle,
    path: string
  ) {
    // @ts-expect-error Typescript doesn't know about entries
    for await (const [name, entry] of handle.entries()) {
      const newPath = path ? `${path}/${name}` : name;

      if (entry.kind === "directory") {
        await exploreDirectory(entry, newPath);
      } else if (entry.kind === "file" && name.endsWith(".rlrr")) {
        jsonFiles.set(newPath, {
          file: entry,
          parentDir: handle,
          path: newPath,
        });
      }
    }
  }

  await exploreDirectory(directoryHandle, "");
  return jsonFiles;
};

/**
 * Reads and parses a JSON file
 */
export const readJsonFile = async (
  fileHandle: FileSystemFileHandle
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  const file = await fileHandle.getFile();
  const contents = await file.text();
  return JSON.parse(contents);
};

/**
 * Validates if the data corresponds to the SongData type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateSongData = (data: any): data is SongData => {
  return (
    data &&
    typeof data.version === "number" &&
    data.recordingMetadata &&
    data.audioFileData &&
    Array.isArray(data.instruments) &&
    Array.isArray(data.events) &&
    Array.isArray(data.bpmEvents)
  );
};

/* Function to load all songs and get an array of SongData */
export const loadAllSongs = async (): Promise<SongData[]> => {
  // Select folder of songs
  const folderHandle = await selectSongsFolder();
  if (!folderHandle) return [];

  // Find JSON files in the folder
  const jsonFiles = await findJsonFiles(folderHandle);
  if (jsonFiles.size === 0) {
    console.error("No JSON files found in the selected folder");
    return [];
  }

  // Load and validate each JSON file
  const songs: SongData[] = [];
  for (const jsonFileEntry of jsonFiles.values()) {
    const { file: jsonFile } = jsonFileEntry;

    try {
      // Read and parse the file
      const songData = await readJsonFile(jsonFile);

      // Validate that it matches the SongData type
      if (validateSongData(songData)) {
        // Add information about the song's folder
        const pathParts = jsonFileEntry.path.split("/");
        const folderName =
          pathParts.length > 1 ? pathParts[pathParts.length - 2] : "";

        const fileParts = pathParts[1].split("_");

        let complexity: number = songData.recordingMetadata?.complexity || 1;

        const complexityStr = fileParts[fileParts.length - 1]
          .split(".")[0]
          .toLowerCase();

        switch (complexityStr) {
          case "medium":
            complexity = 2;
            break;
          case "hard":
            complexity = 3;
            break;
          case "expert":
            complexity = 4;
            break;
          case "easy":
          default:
            complexity = 1;
            break;
        }

        songs.push({
          ...songData,
          recordingMetadata: {
            ...songData.recordingMetadata,
            complexity,
          },
          id: uuid(),
          folderName,
          folderHandle: jsonFileEntry.parentDir,
        });
      } else {
        console.error("The file does not contain valid song data");
      }
    } catch (error) {
      console.error("Error reading the song file:", error);
    }
  }

  return songs;
};
