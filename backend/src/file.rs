use eyre::Result;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::os::unix::fs::MetadataExt;
use std::path::Path;

use walkdir::{DirEntry, WalkDir};

#[derive(Serialize, Debug, Clone)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub checksum: String,
    pub modified: u64,
}

fn sha256_digest(path: &Path) -> Result<String> {
    let input = File::open(path)?;
    let mut reader = BufReader::new(input);

    let digest = {
        let mut hasher = Sha256::new();
        let mut buffer = [0; 1024];
        loop {
            let count = reader.read(&mut buffer)?;
            if count == 0 {
                break;
            }
            hasher.update(&buffer[..count]);
        }
        hasher.finalize()
    };

    Ok(format!("{:X}", digest))
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with("."))
        .unwrap_or(false)
}

#[tauri::command]
pub fn find_files(path: &str, extension: &str) -> Result<Vec<FileInfo>, String> {
    let walker = WalkDir::new(path).into_iter();
    let mut res = vec![];

    for entry in walker.filter_entry(|e| !is_hidden(e)) {
        let entry = entry.map_err(|e| e.to_string())?;

        if entry.file_name().to_string_lossy().ends_with(extension) {
            let meta = entry.metadata().unwrap();

            let name = entry.file_name().to_string_lossy().into_owned();
            let path = entry.path().display().to_string();
            let size = meta.size();
            let modified = meta.mtime() as u64;
            let checksum = sha256_digest(entry.path()).unwrap();

            res.push(FileInfo {
                name,
                path,
                size,
                checksum,
                modified,
            });
        }
    }

    Ok(res)
}
