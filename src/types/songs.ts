export type RecordingMetadata = {
  title: string;
  description: string;
  coverImagePath: string;
  artist: string;
  creator: string;
  length: number;
  complexity: number;
};

export type AudioFileData = {
  songTracks: string[];
  drumTracks: string[];
  calibrationOffset: number;
};

export type InstrumentData = {
  class: string;
  location: [number, number, number];
};

export type EventData = {
  name: string;
  vel: number;
  loc: number;
  time: string;
};

export type BPMEventData = {
  bpm: number;
  time: number;
};

export type SongData = {
  version: number;
  recordingMetadata: RecordingMetadata;
  audioFileData: AudioFileData;
  instruments: InstrumentData[];
  events: EventData[];
  bpmEvents: BPMEventData[];
  // Additional fields to handle files (not present in the original JSON)
  id: string;
  folderName?: string;
  folderHandle?: FileSystemDirectoryHandle;
};

// Types for API-based song integration
export type APISong = {
  id: string;
  title: string;
  artist: string;
  author?: string;
  uploader?: string;
  submissionDate?: string;
  difficulties: string[];
  downloadCount?: number;
  url: string;
  albumArt?: string;
  description?: string;
};

export type APIPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type APISearchInfo = {
  query: string;
  resultsCount: number;
  searchTime: string;
};

export type APISongsResponse = {
  data: APISong[];
  pagination: APIPagination;
  timestamp: string;
};

export type APISearchResponse = {
  data: APISong[];
  search: APISearchInfo;
  pagination: APIPagination;
  timestamp: string;
};

export type APIConfig = {
  baseUrl: string;
};

// Extended SongData for zip-based songs
export type SongDataWithZip = SongData & {
  zipBlob?: Blob;
  zipEntries?: Map<string, ZipEntry>;
};

export type ZipEntry = {
  name: string;
  data: Uint8Array;
  isDirectory: boolean;
};

export type DownloadState = "not-downloaded" | "downloading" | "downloaded";
