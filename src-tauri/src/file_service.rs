use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;

#[cfg(target_os = "android")]
const IS_ANDROID: bool = true;
#[cfg(not(target_os = "android"))]
const IS_ANDROID: bool = false;

pub struct DirEntryLite {
    pub name: String,
    pub is_file: bool,
    pub is_directory: bool,
}

pub struct FileService;

impl FileService {
    #[inline]
    pub fn is_content_uri(p: &str) -> bool {
        p.starts_with("content://")
    }

    #[inline]
    pub fn exists(path: impl AsRef<Path>) -> bool {
        path.as_ref().exists()
    }

    pub fn create_dir_all(path: impl AsRef<Path>) -> io::Result<()> {
        fs::create_dir_all(path)
    }

    pub fn remove_dir_all(path: impl AsRef<Path>) -> io::Result<()> {
        if path.as_ref().exists() {
            fs::remove_dir_all(path)
        } else {
            Ok(())
        }
    }

    pub fn remove_file(path: impl AsRef<Path>) -> io::Result<()> {
        if path.as_ref().exists() {
            fs::remove_file(path)
        } else {
            Ok(())
        }
    }

    pub fn rename(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<()> {
        fs::rename(src, dst)
    }

    pub fn copy_file(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<u64> {
        fs::copy(src, dst)
    }

    pub fn read_dir(path: impl AsRef<Path>) -> io::Result<Vec<DirEntryLite>> {
        #[cfg(target_os = "android")]
        {
            // If it's a content tree URI, list via SAF
            let pstr = path.as_ref().to_string_lossy().to_string();
            if Self::is_content_uri(&pstr) {
                // Use android_saf to list children
                match crate::android_saf::android_saf::list_children(&pstr) {
                    Some(list) => {
                        let mut out = Vec::with_capacity(list.len());
                        for (name, is_dir) in list {
                            out.push(DirEntryLite { name, is_file: !is_dir, is_directory: is_dir });
                        }
                        return Ok(out);
                    }
                    None => return Err(io::Error::new(io::ErrorKind::Other, "SAF list_children failed")),
                }
            }
        }
        let mut out = Vec::new();
        for ent in fs::read_dir(path)? {
            let ent = ent?;
            let md = ent.metadata()?;
            let name = ent.file_name().to_string_lossy().to_string();
            out.push(DirEntryLite {
                name,
                is_file: md.is_file(),
                is_directory: md.is_dir(),
            });
        }
        Ok(out)
    }

    pub fn read_file_bytes(path: &str) -> io::Result<Vec<u8>> {
        #[cfg(target_os = "android")]
        if Self::is_content_uri(path) {
            match crate::android_saf::android_saf::read_all_bytes(path) {
                Some(bytes) => return Ok(bytes),
                None => return Err(io::Error::new(io::ErrorKind::Other, "SAF read_all_bytes failed")),
            }
        }
        fs::read(Path::new(path))
    }

    pub fn read_text_file_utf8_lossy(path: &str) -> io::Result<String> {
        if IS_ANDROID && Self::is_content_uri(path) {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "Reading content:// URIs is not yet implemented",
            ));
        }
        let mut s = String::new();
        let mut f = File::open(Path::new(path))?;
        f.read_to_string(&mut s)?;
        Ok(s)
    }

    pub fn open_file(path: &str) -> io::Result<File> {
        if IS_ANDROID && Self::is_content_uri(path) {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "Opening content:// URIs as File is not yet implemented",
            ));
        }
        File::open(Path::new(path))
    }

    pub fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            let from = entry.path();
            let to = dst.join(entry.file_name());
            if ty.is_dir() {
                Self::copy_dir_recursive(&from, &to)?;
            } else if ty.is_file() {
                fs::copy(&from, &to)?;
            }
        }
        Ok(())
    }
}
