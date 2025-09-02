use crate::file_service::FileService;
use serde::{Deserialize, Serialize};
use std::io;
use std::path::Path;
use uuid::Uuid;

// ----- Types mirrored from src/types/songs.ts -----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingMetadata {
    pub title: String,
    pub description: String,
    #[serde(rename = "coverImagePath")] pub cover_image_path: String,
    pub artist: String,
    pub creator: String,
    pub length: f64,
    pub complexity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFileData {
    #[serde(rename = "songTracks")] pub song_tracks: Vec<String>,
    #[serde(rename = "drumTracks")] pub drum_tracks: Vec<String>,
    #[serde(rename = "calibrationOffset")] pub calibration_offset: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstrumentData {
    #[serde(rename = "class")]
    pub class_name: String,
    pub location: (f64, f64, f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventData {
    pub name: String,
    pub vel: f64,
    pub loc: f64,
    pub time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BPMEventData {
    pub bpm: f64,
    pub time: f64,
    #[serde(default, rename = "timeSignature")]
    pub time_signature: Option<(u32, u32)>,
    #[serde(default)]
    pub swing: Option<f64>,
    #[serde(default)]
    pub delay: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParadiddleSong {
    pub version: u32,
    #[serde(rename = "recordingMetadata")] pub recording_metadata: RecordingMetadata,
    #[serde(rename = "audioFileData")] pub audio_file_data: AudioFileData,
    pub instruments: Vec<InstrumentData>,
    pub events: Vec<EventData>,
    #[serde(rename = "bpmEvents")] pub bpm_events: Vec<BPMEventData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: String,
    pub uploaded_at: String,
    pub uploaded_by: String,
    pub title: String,
    pub artist: String,
    #[serde(skip_serializing_if = "Option::is_none")] pub downloads: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")] pub cover_url: Option<String>,
    pub difficulties: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSong {
    #[serde(skip_serializing_if = "Option::is_none")] pub song: Option<Song>,
    pub base_file_name: String,
}

pub struct SongsService;

impl SongsService {
    pub fn ensure_dir(path: &str) -> Result<(), String> {
        FileService::create_dir_all(path).map_err(|e| e.to_string())
    }

    pub fn delete_song(path: &str) -> Result<(), String> {
        // recursive delete
        FileService::remove_dir_all(path).map_err(|e| e.to_string())
    }

    pub fn get_song_folder_prefix(song_id: &str, repo_name: &str) -> String {
        format!("{}-{}-", repo_name, song_id)
    }

    pub fn get_local_songs(songs_folder: &str) -> Result<Vec<LocalSong>, String> {
        let mut out = Vec::new();
        let entries = FileService::read_dir(songs_folder).map_err(|e| e.to_string())?;
        for e in entries {
            if e.is_directory && e.name != ".tmp" {
                if let Some(ls) = Self::load_song(songs_folder, &e.name)? {
                    out.push(ls);
                }
            }
        }
        Ok(out)
    }

    pub fn load_song(songs_path: &str, song_dir_name: &str) -> Result<Option<LocalSong>, String> {
        let song_path = Path::new(songs_path).join(song_dir_name);
        let entries = FileService::read_dir(&song_path).map_err(|e| e.to_string())?;
        let mut difficulties: Vec<String> = Vec::new();
        let mut song: Option<Song> = None;
        let mut base_file_name = String::new();

        for ent in entries {
            if ent.is_file {
                if ent.name.ends_with(".rlrr") {
                    let last_us = ent.name.rfind('_').unwrap_or(0);
                    if song.is_none() {
                        base_file_name = ent.name[..last_us].to_string();
                        let pdata = Self::get_paradiddle_song(&song_path.join(&ent.name))?;
                        let cover_path = song_path.join(&pdata.recording_metadata.cover_image_path);
                        // We can't send bytes as URL here; front will request via a command that returns bytes
                        let cover_url = Some(cover_path.to_string_lossy().to_string());
                        song = Some(Song {
                            title: pdata.recording_metadata.title.clone(),
                            artist: pdata.recording_metadata.artist.clone(),
                            id: Uuid::new_v4().to_string(),
                            difficulties: vec![],
                            uploaded_at: chrono::Utc::now().to_rfc3339(),
                            uploaded_by: pdata.recording_metadata.creator.clone(),
                            cover_url,
                            downloads: None,
                            download_url: None,
                        });
                    }
                    let diff = ent.name[last_us + 1..ent.name.len() - 5].to_string();
                    difficulties.push(if diff.is_empty() { "Easy".into() } else { diff });
                }
            }
        }

        if let Some(mut s) = song {
            s.difficulties = difficulties;
            Ok(Some(LocalSong {
                base_file_name: format!("{}/{}", song_dir_name, base_file_name),
                song: Some(s),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_paradiddle_song(path: &Path) -> Result<ParadiddleSong, String> {
        // Read bytes and detect encoding similar to TS logic
        let bytes = FileService::read_file_bytes(&path.to_string_lossy()).map_err(|e| e.to_string())?;
        let json = decode_text_best_effort(bytes).map_err(|e| e.to_string())?;
        let cleaned = clean_json_like(&json);
        serde_json::from_str::<ParadiddleSong>(&cleaned).map_err(|e| e.to_string())
    }

    pub fn get_image_bytes(path: &str) -> Result<Vec<u8>, String> {
        FileService::read_file_bytes(path).map_err(|e| e.to_string())
    }
}

fn clean_json_like(s: &str) -> String {
    let mut out = s.to_string();
    if out.starts_with('\u{feff}') { out = out.trim_start_matches('\u{feff}').to_string(); }
    out = out.replace("\r\n", "\n").replace('\r', "\n");
    out.trim().to_string()
}

fn decode_text_best_effort(bytes: Vec<u8>) -> Result<String, io::Error> {
    use encoding_rs::*;
    // BOM checks
    if bytes.len() >= 2 {
        let b0 = bytes[0];
        let b1 = bytes[1];
        if b0 == 0xFF && b1 == 0xFE { // UTF-16LE
            let (cow, _had_errors) = UTF_16LE.decode_with_bom_removal(&bytes);
            return Ok(cow.into_owned());
        } else if b0 == 0xFE && b1 == 0xFF { // UTF-16BE
            let (cow, _had_errors) = UTF_16BE.decode_with_bom_removal(&bytes);
            return Ok(cow.into_owned());
        }
    }
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        let (cow, _had_errors) = UTF_8.decode_with_bom_removal(&bytes);
        return Ok(cow.into_owned());
    }
    // Heuristic for UTF-16LE without BOM (every second byte 0 for ASCII)
    if bytes.len() >= 4 && bytes[1] == 0 && bytes[3] == 0 && bytes[0] != 0 && bytes[2] != 0 {
        let (cow, _had_errors) = UTF_16LE.decode_without_bom_handling(&bytes);
        return Ok(cow.into_owned());
    }
    // fallback to utf-8 lossy
    let (cow, _had_errors) = UTF_8.decode_with_bom_removal(&bytes);
    Ok(cow.into_owned())
}
