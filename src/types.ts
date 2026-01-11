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
