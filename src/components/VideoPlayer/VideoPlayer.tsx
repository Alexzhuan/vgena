import { useRef, useState, useEffect, useCallback } from 'react'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  ChevronDown,
} from 'lucide-react'
import { formatTime, formatTimeWithMs, PLAYBACK_SPEEDS, clamp } from '../../utils'
import clsx from 'clsx'

interface VideoPlayerProps {
  src: string
  label?: string
  syncRef?: React.RefObject<HTMLVideoElement>
  onTimeUpdate?: (time: number) => void
  className?: string
}

export function VideoPlayer({ 
  src, 
  label, 
  syncRef,
  onTimeUpdate,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isMuted, setIsMuted] = useState(true)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPercent, setDragPercent] = useState<number | null>(null)
  const [isFullyBuffered, setIsFullyBuffered] = useState(false)
  const [bufferProgress, setBufferProgress] = useState(0)
  const progressRef = useRef<HTMLDivElement>(null)

  // Sync with external video
  const shouldSync = syncRef && syncRef.current

  // Play/Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    
    if (video.paused) {
      video.play()
      if (shouldSync && syncRef.current) {
        syncRef.current.play()
      }
    } else {
      video.pause()
      if (shouldSync && syncRef.current) {
        syncRef.current.pause()
      }
    }
  }, [shouldSync, syncRef])

  // Seek - use fastSeek for smoother scrubbing when available (like Chrome native player)
  const seek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    
    const newTime = clamp(time, 0, duration)
    
    // fastSeek jumps to nearest keyframe for faster response during scrubbing
    if (typeof video.fastSeek === 'function') {
      video.fastSeek(newTime)
    } else {
      video.currentTime = newTime
    }
    
    if (shouldSync && syncRef.current) {
      if (typeof syncRef.current.fastSeek === 'function') {
        syncRef.current.fastSeek(newTime)
      } else {
        syncRef.current.currentTime = newTime
      }
    }
  }, [duration, shouldSync, syncRef])

  // Frame step (assuming 30fps)
  const stepFrame = useCallback((direction: 1 | -1) => {
    const video = videoRef.current
    if (!video) return
    
    video.pause()
    if (shouldSync && syncRef.current) {
      syncRef.current.pause()
    }
    
    const frameTime = 1 / 30
    seek(video.currentTime + (direction * frameTime))
  }, [seek, shouldSync, syncRef])

  // Change playback rate
  const changeSpeed = useCallback((rate: number) => {
    const video = videoRef.current
    if (!video) return
    
    video.playbackRate = rate
    setPlaybackRate(rate)
    
    if (shouldSync && syncRef.current) {
      syncRef.current.playbackRate = rate
    }
    setShowSpeedMenu(false)
  }, [shouldSync, syncRef])

  // Toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  // Restart
  const restart = useCallback(() => {
    seek(0)
    const video = videoRef.current
    if (video) {
      video.play()
      if (shouldSync && syncRef.current) {
        syncRef.current.play()
      }
    }
  }, [seek, shouldSync, syncRef])

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }, [])

  // Handle progress bar interaction (click and drag) - direct seek for continuous video change
  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    
    const video = videoRef.current
    // 记录拖动前的播放状态，并暂停视频
    const wasPlaying = video ? !video.paused : false
    if (video && wasPlaying) {
      video.pause()
      if (shouldSync && syncRef?.current) {
        syncRef.current.pause()
      }
    }
    
    const getPercent = (evt: MouseEvent | React.MouseEvent) => {
      const progressBar = progressRef.current
      if (!progressBar) return 0
      const rect = progressBar.getBoundingClientRect()
      return clamp((evt.clientX - rect.left) / rect.width, 0, 1)
    }
    
    const initialPercent = getPercent(e)
    setDragPercent(initialPercent)
    seek(initialPercent * duration)  // Direct seek, no throttling
    
    const handleMouseMove = (evt: MouseEvent) => {
      const percent = getPercent(evt)
      setDragPercent(percent)
      seek(percent * duration)  // Direct seek on every move for continuous video change
    }
    
    const handleMouseUp = (evt: MouseEvent) => {
      const finalPercent = getPercent(evt)
      seek(finalPercent * duration)
      setDragPercent(null)
      setIsDragging(false)
      
      // 恢复拖动前的播放状态
      if (wasPlaying && video) {
        video.play()
        if (shouldSync && syncRef?.current) {
          syncRef.current.play()
        }
      }
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [duration, seek, shouldSync, syncRef])

  // Event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdate?.(video.currentTime)
    }
    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
    }
    const handleWaiting = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)
    const handleError = () => setError('视频加载失败')
    
    // Buffer progress detection - for smooth scrubbing like Chrome native player
    const checkBuffer = () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        const progress = bufferedEnd / video.duration
        setBufferProgress(progress)
        setIsFullyBuffered(bufferedEnd >= video.duration - 0.1)
      }
    }
    const handleCanPlayThrough = () => setIsFullyBuffered(true)

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)
    video.addEventListener('progress', checkBuffer)
    video.addEventListener('loadeddata', checkBuffer)
    video.addEventListener('canplaythrough', handleCanPlayThrough)
    
    // Initial buffer check
    checkBuffer()

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('error', handleError)
      video.removeEventListener('progress', checkBuffer)
      video.removeEventListener('loadeddata', checkBuffer)
      video.removeEventListener('canplaythrough', handleCanPlayThrough)
    }
  }, [onTimeUpdate])

  // Reset on src change
  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setIsLoading(true)
    setError(null)
    setIsFullyBuffered(false)
    setBufferProgress(0)
  }, [src])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this video is focused or hovered
      if (!containerRef.current?.contains(document.activeElement) && 
          !containerRef.current?.matches(':hover')) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.shiftKey) {
            stepFrame(-1)
          } else {
            seek(currentTime - 5)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.shiftKey) {
            stepFrame(1)
          } else {
            seek(currentTime + 5)
          }
          break
        case 'm':
          toggleMute()
          break
        case 'f':
          toggleFullscreen()
          break
        case 'r':
          restart()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, seek, stepFrame, toggleMute, toggleFullscreen, restart, currentTime])

  // Progress display: use dragPercent during drag for immediate UI feedback
  const progress = dragPercent !== null 
    ? dragPercent * 100 
    : (duration > 0 ? (currentTime / duration) * 100 : 0)

  return (
    <div 
      ref={containerRef}
      className={clsx(
        'video-container relative bg-black rounded-lg overflow-hidden group',
        className
      )}
      tabIndex={0}
    >
      {/* Label */}
      {label && (
        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/70 rounded text-sm font-medium">
          {label}
        </div>
      )}

      {/* Buffer progress hint - shows when video is not fully buffered */}
      {!isFullyBuffered && bufferProgress > 0 && (
        <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-black/70 rounded text-xs text-white/80">
          缓冲中 {Math.round(bufferProgress * 100)}%
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        muted={isMuted}
        loop
        playsInline
        preload="auto"
      />

      {/* Loading overlay - hide during drag for smoother scrubbing (like Chrome native player) */}
      {isLoading && !error && !isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}

      {/* Controls - appear on hover */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress bar with buffer indicator */}
        <div 
          ref={progressRef}
          className="h-2 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-3 transition-all relative"
          onMouseDown={handleProgressMouseDown}
        >
          {/* Buffer progress (gray) - shows which parts are cached for smooth scrubbing */}
          <div 
            className="absolute inset-y-0 left-0 bg-white/30 rounded-full transition-all"
            style={{ width: `${bufferProgress * 100}%` }}
          />
          {/* Play progress (accent color) */}
          <div 
            className="h-full bg-accent-500 rounded-full relative z-10"
            style={{ width: `${progress}%` }}
          >
            <div className={clsx(
              "absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-opacity",
              isDragging ? 'opacity-100 scale-110' : 'opacity-0 group-hover/progress:opacity-100'
            )} />
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title={isPlaying ? '暂停 (Space)' : '播放 (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          {/* Restart */}
          <button
            onClick={restart}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="重播 (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Frame step */}
          <button
            onClick={() => stepFrame(-1)}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="上一帧 (Shift+←)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => stepFrame(1)}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="下一帧 (Shift+→)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Time display */}
          <div className="text-xs font-mono text-white/80 ml-1">
            {formatTimeWithMs(currentTime)} / {formatTime(duration)}
          </div>

          <div className="flex-1" />

          {/* Speed control */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1 px-2 py-1 hover:bg-white/20 rounded text-xs font-medium transition-colors"
            >
              {playbackRate}x
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-1 py-1 bg-surface-800 rounded-lg shadow-xl border border-surface-600 min-w-[60px]">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => changeSpeed(speed)}
                    className={clsx(
                      'w-full px-3 py-1 text-xs text-left hover:bg-surface-700 transition-colors',
                      playbackRate === speed && 'text-accent-400 font-medium'
                    )}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mute */}
          <button
            onClick={toggleMute}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title={isMuted ? '取消静音 (M)' : '静音 (M)'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="全屏 (F)"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center play button when paused */}
      {!isPlaying && !isLoading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
            <Play className="w-8 h-8 ml-1" />
          </div>
        </button>
      )}
    </div>
  )
}

// Export video ref for syncing
export function useVideoSync() {
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  
  return { videoARef, videoBRef }
}
