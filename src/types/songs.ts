// Player engine types

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

// Webapp types
export type SortDirection = "asc" | "desc";

export type Difficulty = "Easy" | "Medium" | "Hard" | "Expert";

export type DownloadState = "not-downloaded" | "downloading" | "downloaded";

export type ParadiddleSong = {
  version: number;
  recordingMetadata: RecordingMetadata;
  audioFileData: AudioFileData;
  instruments: InstrumentData[];
  events: EventData[];
  bpmEvents: BPMEventData[];
};

export type Song = {
  id: string;
  uploadedAt: string; // ISO date string
  uploadedBy: string;
  title: string;
  artist: string;
  downloads?: number;
  coverUrl?: string;
  difficulties: Difficulty[];
  downloadUrl?: string;
};

export type LocalSong = {
  song?: Song;
  baseFileName: string;
};
