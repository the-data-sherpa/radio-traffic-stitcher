use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioClip {
    pub id: String,
    pub path: String,
    pub name: String,
    pub duration: f64,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StitchResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioInfo {
    pub duration: f64,
    pub size: u64,
    pub valid: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImageFitMode {
    Fit,  // Letterbox/pillarbox with black bars
    Fill, // Scale and crop to fill
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoConfig {
    pub image_path: Option<String>,
    pub fit_mode: ImageFitMode,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub valid: bool,
    pub error: Option<String>,
}

/// Get audio file information using ffprobe
#[tauri::command]
fn get_audio_info(path: String) -> AudioInfo {
    let path_buf = PathBuf::from(&path);

    // Check if file exists
    if !path_buf.exists() {
        return AudioInfo {
            duration: 0.0,
            size: 0,
            valid: false,
            error: Some("File does not exist".to_string()),
        };
    }

    // Get file size
    let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    // Try to get duration using ffprobe
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            &path,
        ])
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let duration_str = String::from_utf8_lossy(&output.stdout);
                let duration: f64 = duration_str.trim().parse().unwrap_or(0.0);
                AudioInfo {
                    duration,
                    size,
                    valid: true,
                    error: None,
                }
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                AudioInfo {
                    duration: 0.0,
                    size,
                    valid: false,
                    error: Some(format!("FFprobe error: {}", error)),
                }
            }
        }
        Err(e) => AudioInfo {
            duration: 0.0,
            size,
            valid: false,
            error: Some(format!(
                "Failed to run ffprobe: {}. Is FFmpeg installed?",
                e
            )),
        },
    }
}

/// Stitch multiple audio clips into a single MP3 file
#[tauri::command]
async fn stitch_audio(clips: Vec<AudioClip>, output_path: String, bitrate: String) -> StitchResult {
    if clips.is_empty() {
        return StitchResult {
            success: false,
            output_path: None,
            error: Some("No clips provided".to_string()),
        };
    }

    // Create a temporary file for the concat list
    let temp_dir = std::env::temp_dir();
    let concat_file_path = temp_dir.join("ffmpeg_concat_list.txt");

    // Create the concat file
    let mut concat_file = match File::create(&concat_file_path) {
        Ok(f) => f,
        Err(e) => {
            return StitchResult {
                success: false,
                output_path: None,
                error: Some(format!("Failed to create temp file: {}", e)),
            };
        }
    };

    // Write file paths to concat list
    for clip in &clips {
        // Escape single quotes in paths for FFmpeg
        let escaped_path = clip.path.replace("'", "'\\''");
        if writeln!(concat_file, "file '{}'", escaped_path).is_err() {
            return StitchResult {
                success: false,
                output_path: None,
                error: Some("Failed to write concat list".to_string()),
            };
        }
    }

    // Close the file
    drop(concat_file);

    // Run FFmpeg to concatenate
    let output = Command::new("ffmpeg")
        .args([
            "-y", // Overwrite output
            "-f",
            "concat", // Concat demuxer
            "-safe",
            "0", // Allow absolute paths
            "-i",
            concat_file_path.to_str().unwrap(),
            "-c:a",
            "libmp3lame", // MP3 codec
            "-b:a",
            &bitrate, // Bitrate
            &output_path,
        ])
        .output();

    // Clean up temp file
    let _ = fs::remove_file(&concat_file_path);

    match output {
        Ok(output) => {
            if output.status.success() {
                StitchResult {
                    success: true,
                    output_path: Some(output_path),
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                StitchResult {
                    success: false,
                    output_path: None,
                    error: Some(format!("FFmpeg error: {}", stderr)),
                }
            }
        }
        Err(e) => StitchResult {
            success: false,
            output_path: None,
            error: Some(format!("Failed to run FFmpeg: {}. Is FFmpeg installed?", e)),
        },
    }
}

/// Get image file information using ffprobe
#[tauri::command]
fn get_image_info(path: String) -> ImageInfo {
    let path_buf = PathBuf::from(&path);

    // Check if file exists
    if !path_buf.exists() {
        return ImageInfo {
            width: 0,
            height: 0,
            valid: false,
            error: Some("File does not exist".to_string()),
        };
    }

    // Get image dimensions using ffprobe
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=s=x:p=0",
            &path,
        ])
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let dimensions = String::from_utf8_lossy(&output.stdout);
                let parts: Vec<&str> = dimensions.trim().split('x').collect();
                if parts.len() == 2 {
                    let width: u32 = parts[0].parse().unwrap_or(0);
                    let height: u32 = parts[1].parse().unwrap_or(0);
                    if width > 0 && height > 0 {
                        return ImageInfo {
                            width,
                            height,
                            valid: true,
                            error: None,
                        };
                    }
                }
                ImageInfo {
                    width: 0,
                    height: 0,
                    valid: false,
                    error: Some("Could not parse image dimensions".to_string()),
                }
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                ImageInfo {
                    width: 0,
                    height: 0,
                    valid: false,
                    error: Some(format!("FFprobe error: {}", error)),
                }
            }
        }
        Err(e) => ImageInfo {
            width: 0,
            height: 0,
            valid: false,
            error: Some(format!(
                "Failed to run ffprobe: {}. Is FFmpeg installed?",
                e
            )),
        },
    }
}

/// Stitch multiple audio clips into a single MP4 video file with optional background image
#[tauri::command]
async fn stitch_video(
    clips: Vec<AudioClip>,
    output_path: String,
    bitrate: String,
    video_config: VideoConfig,
) -> StitchResult {
    if clips.is_empty() {
        return StitchResult {
            success: false,
            output_path: None,
            error: Some("No clips provided".to_string()),
        };
    }

    // Create a temporary file for the concat list
    let temp_dir = std::env::temp_dir();
    let concat_file_path = temp_dir.join("ffmpeg_video_concat_list.txt");

    // Create the concat file
    let mut concat_file = match File::create(&concat_file_path) {
        Ok(f) => f,
        Err(e) => {
            return StitchResult {
                success: false,
                output_path: None,
                error: Some(format!("Failed to create temp file: {}", e)),
            };
        }
    };

    // Write file paths to concat list
    for clip in &clips {
        // Escape single quotes in paths for FFmpeg
        let escaped_path = clip.path.replace("'", "'\\''");
        if writeln!(concat_file, "file '{}'", escaped_path).is_err() {
            return StitchResult {
                success: false,
                output_path: None,
                error: Some("Failed to write concat list".to_string()),
            };
        }
    }

    // Close the file
    drop(concat_file);

    // Build the FFmpeg command based on whether we have an image or not
    let mut args: Vec<String> = vec!["-y".to_string()]; // Overwrite output

    // Video filter based on fit mode - using yuv444p for better color preservation with graphics
    let vf = match video_config.fit_mode {
        ImageFitMode::Fit => {
            // Keep original size (no upscaling), only scale down if larger than 1920x1080
            // Then center on 1920x1080 black canvas
            "scale=iw*min(1\\,min(1920/iw\\,1080/ih)):ih*min(1\\,min(1920/iw\\,1080/ih)),pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv444p".to_string()
        }
        ImageFitMode::Fill => {
            // Scale and crop to fill 1920x1080
            "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv444p"
                .to_string()
        }
    };

    if let Some(image_path) = &video_config.image_path {
        // With image: loop the image for video stream
        args.extend_from_slice(&[
            "-loop".to_string(),
            "1".to_string(),
            "-i".to_string(),
            image_path.clone(),
        ]);
    } else {
        // Without image: generate black background
        args.extend_from_slice(&[
            "-f".to_string(),
            "lavfi".to_string(),
            "-i".to_string(),
            "color=black:s=1920x1080:r=1".to_string(),
        ]);
    }

    // Add audio input
    args.extend_from_slice(&[
        "-f".to_string(),
        "concat".to_string(),
        "-safe".to_string(),
        "0".to_string(),
        "-i".to_string(),
        concat_file_path.to_str().unwrap().to_string(),
    ]);

    // Apply video filter only if we have an image (black background is already 1920x1080)
    if video_config.image_path.is_some() {
        args.extend_from_slice(&["-vf".to_string(), vf]);
    } else {
        args.extend_from_slice(&["-vf".to_string(), "format=yuv420p".to_string()]);
    }

    // Video and audio encoding settings
    // Using CRF 12 for very high quality, slow preset for better compression
    args.extend_from_slice(&[
        "-c:v".to_string(),
        "libx264".to_string(),
        "-crf".to_string(),
        "12".to_string(),
        "-preset".to_string(),
        "slow".to_string(),
        "-tune".to_string(),
        "stillimage".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        bitrate.clone(),
        "-shortest".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        output_path.clone(),
    ]);

    // Run FFmpeg
    let output = Command::new("ffmpeg").args(&args).output();

    // Clean up temp file
    let _ = fs::remove_file(&concat_file_path);

    match output {
        Ok(output) => {
            if output.status.success() {
                StitchResult {
                    success: true,
                    output_path: Some(output_path),
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                StitchResult {
                    success: false,
                    output_path: None,
                    error: Some(format!("FFmpeg error: {}", stderr)),
                }
            }
        }
        Err(e) => StitchResult {
            success: false,
            output_path: None,
            error: Some(format!("Failed to run FFmpeg: {}. Is FFmpeg installed?", e)),
        },
    }
}

/// Check if FFmpeg is available on the system
#[tauri::command]
fn check_ffmpeg() -> Result<String, String> {
    let output = Command::new("ffmpeg").args(["-version"]).output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout);
                // Extract first line which contains version info
                let first_line = version.lines().next().unwrap_or("FFmpeg installed");
                Ok(first_line.to_string())
            } else {
                Err("FFmpeg found but returned an error".to_string())
            }
        }
        Err(_) => Err("FFmpeg is not installed or not in PATH".to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_audio_info,
            get_image_info,
            stitch_audio,
            stitch_video,
            check_ffmpeg
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
