import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioClip, AudioInfo, StitchResult, SUPPORTED_EXTENSIONS, BITRATE_OPTIONS } from './types';
import './App.css';

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Lazy load Tauri APIs only when needed
const getTauriApis = async () => {
  const { invoke } = await import('@tauri-apps/api/core');
  const { open, save } = await import('@tauri-apps/plugin-dialog');
  return { invoke, open, save };
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Format duration in mm:ss
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format file size
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Check if file extension is supported
const isSupportedAudio = (filename: string): boolean => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext);
};

function App() {
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [outputName, setOutputName] = useState('combined_audio');
  const [bitrate, setBitrate] = useState('256k');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<{ installed: boolean; version?: string; error?: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isInTauri, setIsInTauri] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if running in Tauri and check FFmpeg on mount
  useEffect(() => {
    const inTauri = isTauri();
    setIsInTauri(inTauri);

    if (inTauri) {
      getTauriApis()
        .then(({ invoke }) => invoke<string>('check_ffmpeg'))
        .then((version) => {
          setFfmpegStatus({ installed: true, version });
        })
        .catch((error: unknown) => {
          setFfmpegStatus({ installed: false, error: String(error) });
        });
    } else {
      // Not in Tauri - show helpful message
      setFfmpegStatus({ installed: false, error: 'Not running in Tauri desktop app' });
    }
  }, []);

  // Show toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Add audio files
  const addAudioFiles = useCallback(async (paths: string[]) => {
    if (!isInTauri) {
      showToast('error', 'File operations require the Tauri desktop app');
      return;
    }

    const { invoke } = await getTauriApis();
    const newClips: AudioClip[] = [];

    for (const path of paths) {
      const filename = path.split(/[/\\]/).pop() || path;

      if (!isSupportedAudio(filename)) {
        showToast('error', `Unsupported format: ${filename}`);
        continue;
      }

      try {
        const info = await invoke<AudioInfo>('get_audio_info', { path });

        if (info.valid) {
          newClips.push({
            id: generateId(),
            path,
            name: filename,
            duration: info.duration,
            size: info.size,
          });
        } else {
          showToast('error', info.error || `Invalid audio: ${filename}`);
        }
      } catch (error) {
        showToast('error', `Error reading: ${filename}`);
      }
    }

    if (newClips.length > 0) {
      setClips(prev => [...prev, ...newClips]);
      showToast('success', `Added ${newClips.length} clip${newClips.length > 1 ? 's' : ''}`);
    }
  }, [isInTauri]);

  // Handle file picker
  const handleBrowse = async () => {
    if (!isInTauri) {
      showToast('error', 'File picker requires the Tauri desktop app');
      return;
    }

    try {
      const { open } = await getTauriApis();
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Audio Files',
          extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'],
        }],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        addAudioFiles(paths);
      }
    } catch (error) {
      showToast('error', `Error opening file picker: ${error}`);
    }
  };

  // Handle drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!isInTauri) {
      showToast('error', 'Drag & drop requires the Tauri desktop app');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    // In Tauri, files have a path property
    const paths = files.map(f => (f as unknown as { path: string }).path).filter(Boolean);

    if (paths.length > 0) {
      addAudioFiles(paths);
    } else {
      showToast('error', 'Could not get file paths');
    }
  };

  // Move clip up/down
  const moveClip = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= clips.length) return;

    const newClips = [...clips];
    [newClips[index], newClips[newIndex]] = [newClips[newIndex], newClips[index]];
    setClips(newClips);
  };

  // Remove clip
  const removeClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
  };

  // Drag reordering handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newClips = [...clips];
    const [draggedClip] = newClips.splice(draggedIndex, 1);
    newClips.splice(index, 0, draggedClip);
    setClips(newClips);
    setDraggedIndex(index);
  };

  // Export audio
  const handleExport = async () => {
    if (!isInTauri) {
      showToast('error', 'Export requires the Tauri desktop app');
      return;
    }

    if (clips.length === 0) {
      showToast('error', 'Add some clips first!');
      return;
    }

    try {
      const { invoke, save } = await getTauriApis();

      const outputPath = await save({
        defaultPath: `${outputName}.mp3`,
        filters: [{
          name: 'MP3 Audio',
          extensions: ['mp3'],
        }],
      });

      if (!outputPath) return;

      setIsProcessing(true);

      const result = await invoke<StitchResult>('stitch_audio', {
        clips,
        outputPath,
        bitrate,
      });

      if (result.success) {
        showToast('success', 'Audio exported successfully!');
      } else {
        showToast('error', result.error || 'Export failed');
      }
    } catch (error) {
      showToast('error', `Export error: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate totals
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  const totalSize = clips.reduce((sum, clip) => sum + clip.size, 0);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1 className="header__title">
          <span className="header__icon">🎵</span>
          Radio Traffic Stitcher
        </h1>
        <div className={`header__status ${ffmpegStatus?.installed ? 'header__status--success' : 'header__status--error'}`}>
          {ffmpegStatus?.installed ? '✓ FFmpeg Ready' : '✗ FFmpeg Required'}
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Left: Drop Zone + Clip List */}
        <div className="dropzone-container">
          {/* Drop Zone */}
          <div
            className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
            onClick={handleBrowse}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="dropzone__icon">📁</div>
            <div className="dropzone__text">
              Drag audio files here or click to browse
            </div>
            <div className="dropzone__subtext">
              Supports MP3, WAV, OGG, FLAC, M4A, AAC, WMA, OPUS
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SUPPORTED_EXTENSIONS.join(',')}
              className="visually-hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const paths = files.map(f => (f as unknown as { path: string }).path).filter(Boolean);
                if (paths.length > 0) addAudioFiles(paths);
              }}
            />
          </div>

          {/* Clip List */}
          <div className="clip-list">
            <div className="clip-list__header">
              <span className="clip-list__title">Audio Clips</span>
              <span className="clip-list__count">{clips.length} clip{clips.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="clip-list__items">
              {clips.length === 0 ? (
                <div className="clip-list__empty">
                  <div className="clip-list__empty-icon">🎧</div>
                  <div>No clips added yet</div>
                  <div style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                    Drop files above to get started
                  </div>
                </div>
              ) : (
                clips.map((clip, index) => (
                  <div
                    key={clip.id}
                    className={`clip-item ${draggedIndex === index ? 'clip-item--dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOverItem(e, index)}
                  >
                    <div className="clip-item__drag-handle">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>

                    <div className="clip-item__order">
                      <button
                        className="clip-item__order-btn"
                        onClick={() => moveClip(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="clip-item__order-btn"
                        onClick={() => moveClip(index, 'down')}
                        disabled={index === clips.length - 1}
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="clip-item__info">
                      <div className="clip-item__name" title={clip.name}>
                        {clip.name}
                      </div>
                      <div className="clip-item__meta">
                        <span>⏱ {formatDuration(clip.duration)}</span>
                        <span>📦 {formatSize(clip.size)}</span>
                      </div>
                    </div>

                    <div className="clip-item__actions">
                      <button
                        className="clip-item__btn clip-item__btn--danger"
                        onClick={() => removeClip(clip.id)}
                        title="Remove clip"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Export Panel */}
        <div className="export-panel">
          <h2 className="export-panel__title">Export Settings</h2>

          {/* Stats */}
          <div className="export-panel__stats">
            <div className="export-panel__stat">
              <div className="export-panel__stat-value">{clips.length}</div>
              <div className="export-panel__stat-label">Clips</div>
            </div>
            <div className="export-panel__stat">
              <div className="export-panel__stat-value">{formatDuration(totalDuration)}</div>
              <div className="export-panel__stat-label">Total Duration</div>
            </div>
          </div>

          {/* Output name */}
          <div className="export-panel__section">
            <label className="export-panel__label" htmlFor="output-name">
              Output Filename
            </label>
            <input
              id="output-name"
              type="text"
              className="export-panel__input"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              placeholder="combined_audio"
            />
          </div>

          {/* Bitrate */}
          <div className="export-panel__section">
            <label className="export-panel__label" htmlFor="bitrate">
              Quality (Bitrate)
            </label>
            <select
              id="bitrate"
              className="export-panel__select"
              value={bitrate}
              onChange={(e) => setBitrate(e.target.value)}
            >
              {BITRATE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Total size estimate */}
          <div className="export-panel__section">
            <span className="export-panel__label">Estimated Size</span>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              ~{formatSize(totalSize)}
            </div>
          </div>

          {/* Export button */}
          <button
            className="export-btn"
            onClick={handleExport}
            disabled={clips.length === 0 || isProcessing || !ffmpegStatus?.installed}
          >
            <span className="export-btn__icon">🚀</span>
            Export to MP3
          </button>

          {!ffmpegStatus?.installed && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-error)', textAlign: 'center' }}>
              {ffmpegStatus?.error || 'FFmpeg is required. Please install it and restart the app.'}
            </div>
          )}
        </div>
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="progress-overlay">
          <div className="progress-modal">
            <div className="progress-modal__spinner"></div>
            <div className="progress-modal__title">Stitching Audio...</div>
            <div className="progress-modal__subtitle">
              Combining {clips.length} clips into MP3
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast--${toast.type}`}>
          <span className="toast__icon">
            {toast.type === 'success' ? '✓' : '✕'}
          </span>
          <span className="toast__message">{toast.message}</span>
          <button className="toast__close" onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
