Android SAF integration plan:

- The Rust FileService currently uses std::fs on all platforms. On Android, content:// paths return Unsupported; the Kotlin helper `SafKit` provides read/write. Next step is to bridge via JNI in `android_saf.rs` and call from FileService when path is content://.
- Frontend should continue passing normal paths on desktop; on Android prefer SAF content URIs.

Commands added:

- ensure_dir, delete_song, get_song_folder_prefix
- get_local_songs, load_song, get_paradiddle_song, get_image_bytes

These mirror the previous TypeScript utilities so song listing and parsing can move to Rust.
