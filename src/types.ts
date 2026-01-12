// Audio clip type
export interface AudioClip {
    id: string;
    path: string;
    name: string;
    duration: number;
    size: number;
}

// Result from stitching operation
export interface StitchResult {
    success: boolean;
    output_path: string | null;
    error: string | null;
}

// Audio file info from FFprobe
export interface AudioInfo {
    duration: number;
    size: number;
    valid: boolean;
    error: string | null;
}

// Supported audio extensions
export const SUPPORTED_EXTENSIONS = [
    '.mp3',
    '.wav',
    '.ogg',
    '.flac',
    '.m4a',
    '.aac',
    '.wma',
    '.opus'
];

// Bitrate options for export
export const BITRATE_OPTIONS = [
    { label: '128 kbps', value: '128k' },
    { label: '192 kbps', value: '192k' },
    { label: '256 kbps', value: '256k' },
    { label: '320 kbps', value: '320k' },
];

// Export format type
export type ExportFormat = 'mp3' | 'mp4';

// Image fit mode for video export
export type ImageFitMode = 'fit' | 'fill';

// Supported image extensions
export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// Video configuration for export
export interface VideoConfig {
    image_path: string | null;
    fit_mode: ImageFitMode;
}

// Image info from FFprobe
export interface ImageInfo {
    width: number;
    height: number;
    valid: boolean;
    error: string | null;
}

// Background image state
export interface BackgroundImage {
    path: string;
    name: string;
    width: number;
    height: number;
}
