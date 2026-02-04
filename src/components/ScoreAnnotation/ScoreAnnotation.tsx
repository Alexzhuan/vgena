import { useState, useCallback, useEffect } from 'react'
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  ZoomIn,
  Film,
  Info,
  Star,
} from 'lucide-react'
import { VideoPlayer } from '../VideoPlayer/VideoPlayer'
import { Checklist } from '../Checklist/Checklist'
import { ImageModal } from '../common/ImageModal'
import { useAnnotationStore } from '../../stores/annotationStore'
import { DIMENSIONS, DIMENSION_LABELS, DIMENSION_DESCRIPTIONS, SCORE_LABELS } from '../../types'
import { PROBLEM_TEMPLATES } from '../../utils'
import type { ScoreSample, Dimension } from '../../types'
import clsx from 'clsx'

interface ScoreAnnotationProps {
  sample: ScoreSample
}

export function ScoreAnnotation({ sample }: ScoreAnnotationProps) {
  const {
    currentScoreDraft,
    setDimensionScore,
    setDimensionMajorReason,
    setDimensionMinorReason,
    saveCurrentAnnotation,
    goToNextSample,
    goToPrevSample,
    markAsDoubtful,
    currentSampleIndex,
    taskPackage,
    isCurrentAnnotationValid,
  } = useAnnotationStore()

  const [showImageModal, setShowImageModal] = useState(false)
  const [showGtVideo, setShowGtVideo] = useState(false)
  const [activeDimension, setActiveDimension] = useState<Dimension>('text_consistency')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Reset activeDimension to first dimension when entering a new sample
  useEffect(() => {
    setActiveDimension('text_consistency')
  }, [sample.sample_id])

  const isValid = isCurrentAnnotationValid()

  const handleSaveAndNext = useCallback(() => {
    if (!isValid) return
    
    setSaveStatus('saving')
    const success = saveCurrentAnnotation()
    
    if (success) {
      setSaveStatus('saved')
      setTimeout(() => {
        goToNextSample()
        setSaveStatus('idle')
      }, 300)
    } else {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [isValid, saveCurrentAnnotation, goToNextSample])

  // Helper to check if a score is disabled based on reasons
  const isScoreDisabledForDimension = (s: number): boolean => {
    const majorReason = currentScoreDraft.scores[activeDimension].major_reason
    const minorReason = currentScoreDraft.scores[activeDimension].minor_reason
    const hasMajorReason = majorReason.trim().length > 0
    const hasMinorReason = minorReason.trim().length > 0

    if (hasMajorReason) {
      // Major issues noted -> cannot select 3, 4, 5
      return s >= 3
    }
    if (hasMinorReason) {
      // Only minor issues noted -> cannot select 1, 2
      return s <= 2
    }
    return false
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Score shortcuts (1-5) - respect disabled scores
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        const scoreValue = parseInt(e.key)
        // Only set score if it's not disabled
        if (!isScoreDisabledForDimension(scoreValue)) {
          setDimensionScore(activeDimension, scoreValue)
        }
        return
      }

      // Tab to switch dimensions
      if (e.key === 'Tab') {
        e.preventDefault()
        const currentIndex = DIMENSIONS.indexOf(activeDimension)
        const nextIndex = e.shiftKey 
          ? (currentIndex - 1 + DIMENSIONS.length) % DIMENSIONS.length
          : (currentIndex + 1) % DIMENSIONS.length
        setActiveDimension(DIMENSIONS[nextIndex])
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            goToPrevSample()
          }
          break
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            goToNextSample()
          }
          break
        case 'Enter':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleSaveAndNext()
          }
          break
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleSaveAndNext()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeDimension, goToPrevSample, goToNextSample, handleSaveAndNext, setDimensionScore, currentScoreDraft, isScoreDisabledForDimension])

  const isFirst = currentSampleIndex === 0
  const isLast = taskPackage ? currentSampleIndex === taskPackage.samples.length - 1 : true

  // Dimension colors
  const dimensionColors: Record<Dimension, { bg: string; border: string; text: string }> = {
    text_consistency: { bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-400' },
    temporal_consistency: { bg: 'bg-purple-500/10', border: 'border-purple-500', text: 'text-purple-400' },
    visual_quality: { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-400' },
    distortion: { bg: 'bg-orange-500/10', border: 'border-orange-500', text: 'text-orange-400' },
    motion_quality: { bg: 'bg-pink-500/10', border: 'border-pink-500', text: 'text-pink-400' },
  }

  return (
    <div className="h-full flex">
      {/* Main content area */}
      {/* Left side - Prompt, Videos and scoring */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Prompt section - fills left side space */}
        <div className="flex-shrink-0 p-4 border-b border-surface-700">
          <div className="flex items-start gap-4 p-3 bg-surface-800/50 rounded-xl">
            {/* First frame thumbnail */}
            <button
              onClick={() => setShowImageModal(true)}
              className="relative w-28 h-[70px] rounded-lg overflow-hidden bg-surface-800 hover:ring-2 hover:ring-accent-500 transition-all flex-shrink-0 group"
            >
              <img 
                src={sample.first_frame_url} 
                alt="First frame"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="w-5 h-5" />
              </div>
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-xs">
                首帧
              </div>
            </button>
            
            {/* Prompt text */}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-surface-400 mb-1">Prompt</div>
              <p className="text-surface-100 leading-relaxed text-base font-medium">{sample.prompt}</p>
            </div>

            {/* GT Video toggle */}
            {sample.gt_video_url && (
              <button
                onClick={() => setShowGtVideo(!showGtVideo)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
                  showGtVideo 
                    ? 'bg-accent-600 text-white' 
                    : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                )}
              >
                <Film className="w-4 h-4" />
                {showGtVideo ? '隐藏原视频' : '显示原视频'}
              </button>
            )}
          </div>
        </div>

        {/* Video area - First frame + Video side by side */}
        <div className="flex-shrink-0 p-4">
          <div className={clsx(
            'grid gap-4',
            showGtVideo ? 'grid-cols-3' : 'grid-cols-2'
          )}>
            {/* First frame - aspect ratio matching video */}
            <div className="aspect-video bg-surface-800 rounded-lg overflow-hidden relative group">
              <img 
                src={sample.first_frame_url}
                alt="First frame"
                className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setShowImageModal(true)}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <ZoomIn className="w-8 h-8" />
              </div>
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-sm font-medium">
                首帧
              </div>
            </div>
            {/* Generated video */}
            <div className="aspect-video">
              <VideoPlayer
                src={sample.video_url}
                label={sample.video_model ? `模型: ${sample.video_model}` : undefined}
                className="w-full h-full"
              />
            </div>
            {showGtVideo && sample.gt_video_url && (
              <div className="aspect-video">
                <VideoPlayer
                  src={sample.gt_video_url}
                  label="原视频 (GT)"
                  className="w-full h-full"
                />
              </div>
            )}
          </div>
        </div>

          {/* Dimension tabs and scoring form */}
          <div className="flex-1 flex flex-col border-t border-surface-700 overflow-hidden">
            {/* Dimension tabs */}
            <div className="flex border-b border-surface-700 overflow-x-auto flex-shrink-0">
              {DIMENSIONS.map((dimension) => {
                const score = currentScoreDraft.scores[dimension].score
                const colors = dimensionColors[dimension]
                const isActive = activeDimension === dimension
                
                return (
                  <button
                    key={dimension}
                    onClick={() => setActiveDimension(dimension)}
                    className={clsx(
                      'flex-1 min-w-0 px-3 py-3 text-sm font-medium transition-all border-b-2 -mb-px',
                      isActive 
                        ? `${colors.border} ${colors.bg} ${colors.text}` 
                        : 'border-transparent text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                    )}
                  >
                    <div className="truncate">{DIMENSION_LABELS[dimension]}</div>
                    {score > 0 && (
                      <div className={clsx(
                        'flex items-center justify-center gap-0.5 mt-1',
                        score >= 4 ? 'text-green-400' : score >= 3 ? 'text-yellow-400' : 'text-red-400'
                      )}>
                        {Array.from({ length: score }).map((_, i) => (
                          <Star key={i} className="w-3 h-3" fill="currentColor" />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Active dimension content - Reason input FIRST, then Score */}
            <div className="flex-1 overflow-y-auto p-4">
              <DimensionScorePanel
                dimension={activeDimension}
                score={currentScoreDraft.scores[activeDimension].score}
                majorReason={currentScoreDraft.scores[activeDimension].major_reason}
                minorReason={currentScoreDraft.scores[activeDimension].minor_reason}
                onScoreChange={(score) => setDimensionScore(activeDimension, score)}
                onMajorReasonChange={(reason) => setDimensionMajorReason(activeDimension, reason)}
                onMinorReasonChange={(reason) => setDimensionMinorReason(activeDimension, reason)}
                colors={dimensionColors[activeDimension]}
              />
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex-shrink-0 border-t border-surface-700 bg-surface-900/80 p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={goToPrevSample}
                disabled={isFirst}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                上一个
              </button>

              <div className="flex items-center gap-3">
                {/* Score summary */}
                <div className="flex items-center gap-2 px-3 py-1 bg-surface-800 rounded-lg">
                  {DIMENSIONS.map((dim) => {
                    const score = currentScoreDraft.scores[dim].score
                    return (
                      <div
                        key={dim}
                        className={clsx(
                          'w-7 h-7 rounded flex items-center justify-center text-sm font-bold',
                          score === 0 
                            ? 'bg-surface-700 text-surface-500' 
                            : score >= 4 
                              ? 'bg-green-600/20 text-green-400' 
                              : score >= 3 
                                ? 'bg-yellow-600/20 text-yellow-400' 
                                : 'bg-red-600/20 text-red-400'
                        )}
                        title={DIMENSION_LABELS[dim]}
                      >
                        {score || '-'}
                      </div>
                    )
                  })}
                </div>

                {!isValid && (
                  <div className="flex items-center gap-2 text-sm text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    请完成所有维度评分
                  </div>
                )}
                
                <button
                  onClick={markAsDoubtful}
                  disabled={isLast}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  存疑
                </button>

                <button
                  onClick={handleSaveAndNext}
                  disabled={!isValid || saveStatus === 'saving'}
                  className={clsx(
                    'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all',
                    isValid
                      ? 'bg-accent-600 hover:bg-accent-500 text-white'
                      : 'bg-surface-700 text-surface-400 cursor-not-allowed'
                  )}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      保存中...
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      已保存
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存并下一个
                      <kbd className="kbd ml-1">⌘↵</kbd>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={goToNextSample}
                disabled={isLast}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一个
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      {/* Right sidebar - Checklist filtered by active dimension */}
      <div className="w-80 border-l border-surface-700 bg-surface-900 flex flex-col flex-shrink-0 overflow-hidden">
        <Checklist items={sample.checklist} activeDimension={activeDimension} className="flex-1 overflow-hidden" />
      </div>

      {/* Image modal */}
      <ImageModal
        src={sample.first_frame_url}
        alt="First frame"
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
      />
    </div>
  )
}

interface DimensionScorePanelProps {
  dimension: Dimension
  score: number
  majorReason: string
  minorReason: string
  onScoreChange: (score: number) => void
  onMajorReasonChange: (reason: string) => void
  onMinorReasonChange: (reason: string) => void
  colors: { bg: string; border: string; text: string }
}

function DimensionScorePanel({
  dimension,
  score,
  majorReason,
  minorReason,
  onScoreChange,
  onMajorReasonChange,
  onMinorReasonChange,
  colors,
}: DimensionScorePanelProps) {
  const templates = PROBLEM_TEMPLATES[dimension]
  const hasAnyReason = majorReason.trim() || minorReason.trim()

  // Determine which scores are disabled based on reasons
  const hasMajorReason = majorReason.trim().length > 0
  const hasMinorReason = minorReason.trim().length > 0

  const isScoreDisabled = (s: number): boolean => {
    if (hasMajorReason) {
      // Major issues noted -> cannot select 3, 4, 5
      return s >= 3
    }
    if (hasMinorReason) {
      // Only minor issues noted -> cannot select 1, 2
      return s <= 2
    }
    return false
  }

  const getDisabledReason = (s: number): string | undefined => {
    if (hasMajorReason && s >= 3) {
      return '已填写主要问题，不可选择3-5分'
    }
    if (!hasMajorReason && hasMinorReason && s <= 2) {
      return '仅填写次要问题，不可选择1-2分'
    }
    return undefined
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Description */}
      <div className={clsx('flex items-start gap-2 p-3 rounded-lg', colors.bg)}>
        <Info className={clsx('w-4 h-4 flex-shrink-0 mt-0.5', colors.text)} />
        <p className="text-sm text-surface-300">{DIMENSION_DESCRIPTIONS[dimension]}</p>
      </div>

      {/* Problem description - Major and Minor side by side */}
      <div className="p-4 bg-surface-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">问题描述</span>
          <span className="text-xs text-surface-500">先描述问题，再打分（无问题则留空）</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Major problems column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-red-400">主要问题</span>
              <span className="text-xs text-surface-500">（严重错误）</span>
            </div>
            
            {/* Major templates */}
            <div className="flex flex-wrap gap-1.5">
              {templates.major.map((template) => (
                <button
                  key={template}
                  onClick={() => {
                    const newReason = majorReason ? `${majorReason}；${template}` : template
                    onMajorReasonChange(newReason)
                  }}
                  className="px-2 py-1 text-xs bg-red-600/20 text-red-300 hover:bg-red-600/30 rounded transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>
            
            <textarea
              value={majorReason}
              onChange={(e) => onMajorReasonChange(e.target.value)}
              placeholder="描述主要问题（如有）..."
              rows={3}
              className="w-full px-3 py-2 bg-surface-800 border border-red-600/30 rounded-lg text-sm resize-none
                         placeholder:text-surface-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
            />
          </div>

          {/* Minor problems column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-yellow-400">次要问题</span>
              <span className="text-xs text-surface-500">（轻微错误）</span>
            </div>
            
            {/* Minor templates */}
            <div className="flex flex-wrap gap-1.5">
              {templates.minor.map((template) => (
                <button
                  key={template}
                  onClick={() => {
                    const newReason = minorReason ? `${minorReason}；${template}` : template
                    onMinorReasonChange(newReason)
                  }}
                  className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/30 rounded transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>
            
            <textarea
              value={minorReason}
              onChange={(e) => onMinorReasonChange(e.target.value)}
              placeholder="描述次要问题（如有）..."
              rows={3}
              className="w-full px-3 py-2 bg-surface-800 border border-yellow-600/30 rounded-lg text-sm resize-none
                         placeholder:text-surface-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Score buttons - AFTER problem description */}
      <div className="p-4 bg-surface-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">评分</span>
          <span className="text-xs text-surface-500">按 1-5 快速评分</span>
        </div>
        <div className="flex gap-2">
          {[5, 4, 3, 2, 1].map((s) => {
            const scoreInfo = SCORE_LABELS[s]
            const disabled = isScoreDisabled(s)
            const disabledReason = getDisabledReason(s)
            return (
              <button
                key={s}
                onClick={() => !disabled && onScoreChange(s)}
                disabled={disabled}
                title={disabledReason}
                className={clsx(
                  'flex-1 py-3 rounded-lg transition-all border-2',
                  disabled
                    ? 'bg-surface-800/50 border-surface-700 text-surface-600 cursor-not-allowed opacity-50'
                    : score === s
                      ? s >= 4 
                        ? 'bg-green-600/20 border-green-500 text-green-400' 
                        : s === 3 
                          ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400' 
                          : 'bg-red-600/20 border-red-500 text-red-400'
                      : 'bg-surface-800 border-surface-600 text-surface-300 hover:border-surface-500'
                )}
              >
                <div className="text-2xl font-bold">{s}</div>
                <div className="text-xs mt-1 opacity-80">{scoreInfo.label}</div>
              </button>
            )
          })}
        </div>

        {/* Score description */}
        {score > 0 && (
          <div className={clsx(
            'mt-3 p-3 rounded-lg text-sm',
            score >= 4 ? 'bg-green-600/10 text-green-300' : score === 3 ? 'bg-yellow-600/10 text-yellow-300' : 'bg-red-600/10 text-red-300'
          )}>
            {SCORE_LABELS[score].description}
          </div>
        )}

        {/* Validation hint */}
        {score > 0 && score < 5 && !hasAnyReason && (
          <div className="mt-3 p-2 bg-warning/10 rounded-lg text-sm text-warning flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            分数低于5分需要填写至少一个问题描述
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="text-xs text-surface-500 text-center">
        按 <kbd className="kbd">Tab</kbd> 切换维度 • 按 <kbd className="kbd">1-5</kbd> 快速评分
      </div>
    </div>
  )
}
