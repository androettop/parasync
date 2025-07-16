import { v4 as uuid } from "uuid";
import { SongData, SongDataWithZip, ZipEntry } from "../../types/songs";
import { 
  unzipBlob, 
  findMainSongFolder, 
  getRlrrFiles, 
  uint8ArrayToString 
} from "./zipHandler";

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

/**
 * Parses a song from zip entries
 */
export const parseSongFromZip = async (
  zipEntries: Map<string, ZipEntry>,
  rlrrFileName: string,
  songName: string,
  zipBlob: Blob
): Promise<SongDataWithZip | null> => {
  try {
    const mainFolder = findMainSongFolder(zipEntries);
    if (!mainFolder) {
      console.error("Could not find main song folder in ZIP");
      return null;
    }

    const rlrrPath = `${mainFolder}/${rlrrFileName}`;
    const rlrrEntry = zipEntries.get(rlrrPath);
    
    if (!rlrrEntry) {
      console.error(`Could not find ${rlrrFileName} in ZIP`);
      return null;
    }

    // Parse the JSON content
    const jsonContent = uint8ArrayToString(rlrrEntry.data);
    const songData = JSON.parse(jsonContent);

    if (!validateSongData(songData)) {
      console.error("Invalid song data format");
      return null;
    }

    // Extract complexity from filename
    const fileParts = rlrrFileName.split("_");
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

    return {
      ...songData,
      recordingMetadata: {
        ...songData.recordingMetadata,
        complexity,
      },
      id: uuid(),
      folderName: songName,
      zipBlob: zipBlob,
      zipEntries: zipEntries
    };
  } catch (error) {
    console.error("Error parsing song from ZIP:", error);
    return null;
  }
};

/**
 * Gets available difficulties from a ZIP file
 */
export const getAvailableDifficulties = async (
  zipBlob: Blob
): Promise<Array<{ fileName: string; difficulty: string; complexity: number }>> => {
  try {
    const zipEntries = await unzipBlob(zipBlob);
    const mainFolder = findMainSongFolder(zipEntries);
    
    if (!mainFolder) {
      console.error("Could not find main song folder in ZIP");
      return [];
    }

    const rlrrFiles = getRlrrFiles(zipEntries, mainFolder);
    const difficulties: Array<{ fileName: string; difficulty: string; complexity: number }> = [];

    for (const [fileName] of rlrrFiles.entries()) {
      const fileParts = fileName.split("_");
      const complexityStr = fileParts[fileParts.length - 1]
        .split(".")[0]
        .toLowerCase();

      let difficulty = "Easy";
      let complexity = 1;

      switch (complexityStr) {
        case "medium":
          difficulty = "Medium";
          complexity = 2;
          break;
        case "hard":
          difficulty = "Hard";
          complexity = 3;
          break;
        case "expert":
          difficulty = "Expert";
          complexity = 4;
          break;
        case "easy":
        default:
          difficulty = "Easy";
          complexity = 1;
          break;
      }

      difficulties.push({
        fileName,
        difficulty,
        complexity
      });
    }

    // Sort by complexity
    difficulties.sort((a, b) => a.complexity - b.complexity);
    return difficulties;
  } catch (error) {
    console.error("Error getting difficulties from ZIP:", error);
    return [];
  }
};

/**
 * Loads a song from ZIP blob
 */
export const loadSongFromZip = async (
  zipBlob: Blob,
  rlrrFileName: string,
  songName: string
): Promise<SongDataWithZip | null> => {
  try {
    const zipEntries = await unzipBlob(zipBlob);
    return await parseSongFromZip(zipEntries, rlrrFileName, songName, zipBlob);
  } catch (error) {
    console.error("Error loading song from ZIP:", error);
    return null;
  }
};
