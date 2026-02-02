import { useState, useCallback, useEffect } from 'react'
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  SkipForward,
  AlertTriangle,
  CheckCircle2,
  ZoomIn,
  Film,
  Link2,
  Link2Off,
  Check,
  X,
  Info,
} from 'lucide-react'
import { VideoPlayer } from '../VideoPlayer/VideoPlayer'
import { Checklist } from '../Checklist/Checklist'
import { ImageModal } from '../common/ImageModal'
import { useAnnotationStore } from '../../stores/annotationStore'
import { DIMENSIONS, DIMENSION_LABELS, DIMENSION_DESCRIPTIONS } from '../../types'
import { PROBLEM_TEMPLATES } from '../../utils'
import type { PairSample, ComparisonResult, Dimension } from '../../types'
import clsx from 'clsx'

interface PairAnnotationProps {
  sample: PairSample
}

export function PairAnnotation({ sample }: PairAnnotationProps) {
  const {
    currentPairDraft,
    setPairDimensionVideoAMajorReason,
    setPairDimensionVideoAMinorReason,
    setPairDimensionVideoBMajorReason,
    setPairDimensionVideoBMinorReason,
    setPairDimensionComparison,
    setPairDimensionDegreeDiff,
    saveCurrentAnnotation,
    goToNextSample,
    goToPrevSample,
    currentSampleIndex,
    taskPackage,
    isCurrentAnnotationValid,
    isDimensionComplete,
  } = useAnnotationStore()

  const [showImageModal, setShowImageModal] = useState(false)
  const [showGtVideo, setShowGtVideo] = useState(false)
  const [syncVideos, setSyncVideos] = useState(true)
  const [activeDimension, setActiveDimension] = useState<Dimension>('text_consistency')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Reset activeDimension to first dimension when entering a new sample
  useEffect(() => {
    setActiveDimension('text_consistency')
  }, [sample.sample_id])

  const isValid = isCurrentAnnotationValid()
  const currentDraft = currentPairDraft[activeDimension]

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
  }, [activeDimension, goToPrevSample, goToNextSample, handleSaveAndNext])

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
      {/* Left side - Prompt, Videos and annotation */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Prompt section - fills left side space */}
        <div className="flex-shrink-0 p-4 border-b border-surface-700">
          <div className="flex items-start gap-4 p-3 bg-surface-800/50 rounded-xl">
            {/* First frame thumbnail - clickable for zoom */}
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

            {/* Sync toggle */}
            <button
              onClick={() => setSyncVideos(!syncVideos)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
                syncVideos 
                  ? 'bg-accent-600/20 text-accent-400 border border-accent-500/30' 
                  : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
              )}
            >
              {syncVideos ? <Link2 className="w-4 h-4" /> : <Link2Off className="w-4 h-4" />}
              {syncVideos ? '同步' : '独立'}
            </button>
          </div>
        </div>

        {/* Video area */}
        <div className="flex-shrink-0 p-4">
          <div className={clsx(
            'grid gap-4',
            showGtVideo ? 'grid-cols-3' : 'grid-cols-2'
          )}>
            <div className="aspect-video">
              <VideoPlayer
                src={sample.video_a_url}
                label={`视频 A ${sample.video_a_model ? `(${sample.video_a_model})` : ''}`}
                className="w-full h-full"
              />
            </div>
            <div className="aspect-video">
              <VideoPlayer
                src={sample.video_b_url}
                label={`视频 B ${sample.video_b_model ? `(${sample.video_b_model})` : ''}`}
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

          {/* Dimension tabs and annotation form */}
          <div className="flex-1 flex flex-col border-t border-surface-700 overflow-hidden">
            {/* Dimension tabs */}
            <div className="flex border-b border-surface-700 overflow-x-auto flex-shrink-0">
              {DIMENSIONS.map((dimension) => {
                const isComplete = isDimensionComplete(dimension)
                const isActive = activeDimension === dimension
                const colors = dimensionColors[dimension]
                
                return (
                  <button
                    key={dimension}
                    onClick={() => setActiveDimension(dimension)}
                    className={clsx(
                      'flex-1 min-w-0 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px flex items-center justify-center gap-2',
                      isActive 
                        ? `${colors.border} ${colors.bg} ${colors.text}` 
                        : 'border-transparent text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                    )}
                  >
                    <span className="truncate">{DIMENSION_LABELS[dimension]}</span>
                    {isComplete ? (
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-surface-600 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Dimension annotation panel */}
            <div className="flex-1 overflow-y-auto p-4">
              <DimensionPairPanel
                dimension={activeDimension}
                draft={currentDraft}
                colors={dimensionColors[activeDimension]}
                onVideoAMajorReasonChange={(reason) => setPairDimensionVideoAMajorReason(activeDimension, reason)}
                onVideoAMinorReasonChange={(reason) => setPairDimensionVideoAMinorReason(activeDimension, reason)}
                onVideoBMajorReasonChange={(reason) => setPairDimensionVideoBMajorReason(activeDimension, reason)}
                onVideoBMinorReasonChange={(reason) => setPairDimensionVideoBMinorReason(activeDimension, reason)}
                onComparisonChange={(comparison) => setPairDimensionComparison(activeDimension, comparison)}
                onDegreeDiffChange={(reason) => setPairDimensionDegreeDiff(activeDimension, reason)}
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
                {/* Dimension completion summary */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 rounded-lg">
                  {DIMENSIONS.map((dim) => {
                    const complete = isDimensionComplete(dim)
                    return (
                      <div
                        key={dim}
                        className={clsx(
                          'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                          complete 
                            ? 'bg-success/20 text-success' 
                            : 'bg-surface-700 text-surface-500'
                        )}
                        title={DIMENSION_LABELS[dim]}
                      >
                        {complete ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </div>
                    )
                  })}
                </div>

                {!isValid && (
                  <div className="flex items-center gap-2 text-sm text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    请完成所有维度
                  </div>
                )}
                
                <button
                  onClick={goToNextSample}
                  disabled={isLast}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  跳过
                  <SkipForward className="w-4 h-4" />
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

interface DimensionPairPanelProps {
  dimension: Dimension
  draft: {
    video_a_major_reason: string
    video_a_minor_reason: string
    video_b_major_reason: string
    video_b_minor_reason: string
    comparison: ComparisonResult | null
    degree_diff_reason: string
  }
  colors: { bg: string; border: string; text: string }
  onVideoAMajorReasonChange: (reason: string) => void
  onVideoAMinorReasonChange: (reason: string) => void
  onVideoBMajorReasonChange: (reason: string) => void
  onVideoBMinorReasonChange: (reason: string) => void
  onComparisonChange: (comparison: ComparisonResult) => void
  onDegreeDiffChange: (reason: string) => void
}

function DimensionPairPanel({
  dimension,
  draft,
  colors,
  onVideoAMajorReasonChange,
  onVideoAMinorReasonChange,
  onVideoBMajorReasonChange,
  onVideoBMinorReasonChange,
  onComparisonChange,
  onDegreeDiffChange,
}: DimensionPairPanelProps) {
  const templates = PROBLEM_TEMPLATES[dimension]

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className={clsx('flex items-start gap-2 p-3 rounded-lg', colors.bg)}>
        <Info className={clsx('w-4 h-4 flex-shrink-0 mt-0.5', colors.text)} />
        <p className="text-sm text-surface-300">{DIMENSION_DESCRIPTIONS[dimension]}</p>
      </div>

      {/* Video A and B annotation side by side */}
      <div className="grid grid-cols-2 gap-4">
        <VideoAnnotationPanel
          label="视频 A"
          majorReason={draft.video_a_major_reason}
          minorReason={draft.video_a_minor_reason}
          templates={templates}
          onMajorReasonChange={onVideoAMajorReasonChange}
          onMinorReasonChange={onVideoAMinorReasonChange}
        />
        <VideoAnnotationPanel
          label="视频 B"
          majorReason={draft.video_b_major_reason}
          minorReason={draft.video_b_minor_reason}
          templates={templates}
          onMajorReasonChange={onVideoBMajorReasonChange}
          onMinorReasonChange={onVideoBMinorReasonChange}
        />
      </div>

      {/* Comparison result */}
      <div className="p-4 bg-surface-800/50 rounded-xl">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-surface-300">对比结果:</span>
          <div className="flex gap-2 flex-1">
            {(['A>B', 'A=B', 'A<B'] as ComparisonResult[]).map((result) => (
              <button
                key={result}
                onClick={() => onComparisonChange(result)}
                className={clsx(
                  'flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all',
                  draft.comparison === result
                    ? result === 'A>B' 
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                      : result === 'A<B'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                        : 'bg-accent-600 text-white shadow-lg shadow-accent-600/30'
                    : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                )}
              >
                {result === 'A>B' ? 'A 更好' : result === 'A<B' ? 'B 更好' : '一样好'}
              </button>
            ))}
          </div>
        </div>

        {/* Degree difference (optional) */}
        {draft.comparison && (
          <div className="mt-3">
            <input
              type="text"
              value={draft.degree_diff_reason}
              onChange={(e) => onDegreeDiffChange(e.target.value)}
              placeholder="程度差异说明（可选）：如谁的问题更严重"
              className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded-lg text-sm 
                         placeholder:text-surface-500 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="text-xs text-surface-500 text-center">
        按 <kbd className="kbd">Tab</kbd> 切换维度
      </div>
    </div>
  )
}

interface VideoAnnotationPanelProps {
  label: string
  majorReason: string
  minorReason: string
  templates: { major: string[]; minor: string[] }
  onMajorReasonChange: (reason: string) => void
  onMinorReasonChange: (reason: string) => void
}

function VideoAnnotationPanel({
  label,
  majorReason,
  minorReason,
  templates,
  onMajorReasonChange,
  onMinorReasonChange,
}: VideoAnnotationPanelProps) {
  const hasAnyReason = majorReason.trim() || minorReason.trim()

  return (
    <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-surface-200">{label}</span>
        {hasAnyReason ? (
          <span className="text-xs text-green-400">已填写</span>
        ) : (
          <span className="text-xs text-surface-500">无问题可留空</span>
        )}
      </div>
      
      {/* Problem descriptions - always show both */}
      <div className="space-y-3">
        {/* Major problems */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-red-400">主要问题</span>
            <span className="text-xs text-surface-500">（严重错误）</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {templates.major.slice(0, 4).map((template) => (
              <button
                key={template}
                onClick={() => {
                  const newReason = majorReason ? `${majorReason}；${template}` : template
                  onMajorReasonChange(newReason)
                }}
                className="px-1.5 py-0.5 text-xs bg-red-600/20 text-red-300 hover:bg-red-600/30 rounded transition-colors"
              >
                {template}
              </button>
            ))}
          </div>
          <textarea
            value={majorReason}
            onChange={(e) => onMajorReasonChange(e.target.value)}
            placeholder="描述主要问题（如有）..."
            rows={2}
            className="w-full px-2 py-1.5 bg-surface-800 border border-red-600/30 rounded-lg text-xs resize-none
                       placeholder:text-surface-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
          />
        </div>

        {/* Minor problems */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-yellow-400">次要问题</span>
            <span className="text-xs text-surface-500">（轻微错误）</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {templates.minor.slice(0, 4).map((template) => (
              <button
                key={template}
                onClick={() => {
                  const newReason = minorReason ? `${minorReason}；${template}` : template
                  onMinorReasonChange(newReason)
                }}
                className="px-1.5 py-0.5 text-xs bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/30 rounded transition-colors"
              >
                {template}
              </button>
            ))}
          </div>
          <textarea
            value={minorReason}
            onChange={(e) => onMinorReasonChange(e.target.value)}
            placeholder="描述次要问题（如有）..."
            rows={2}
            className="w-full px-2 py-1.5 bg-surface-800 border border-yellow-600/30 rounded-lg text-xs resize-none
                       placeholder:text-surface-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
          />
        </div>
      </div>
    </div>
  )
}
