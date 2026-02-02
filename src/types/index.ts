// ============================================
// Core Types for Video Annotation Platform
// ============================================

// Re-export analysis types
export * from './analysis'

/**
 * Annotation mode types
 */
export type AnnotationMode = 'pair' | 'score'

/**
 * Problem level classification
 */
export type ProblemLevel = 'none' | 'minor' | 'major'

/**
 * Comparison result for pair-wise annotation
 */
export type ComparisonResult = 'A>B' | 'A=B' | 'A<B'

/**
 * The 5 evaluation dimensions
 */
export type Dimension = 
  | 'text_consistency'      // 文本一致性
  | 'temporal_consistency'  // 时序一致性
  | 'visual_quality'        // 视觉质量
  | 'distortion'            // 畸变
  | 'motion_quality'        // 运动质量

/**
 * Human-readable dimension labels
 */
export const DIMENSION_LABELS: Record<Dimension, string> = {
  text_consistency: '文本一致性',
  temporal_consistency: '时序一致性',
  visual_quality: '视觉质量',
  distortion: '畸变',
  motion_quality: '运动质量',
}

/**
 * Dimension descriptions for tooltips
 */
export const DIMENSION_DESCRIPTIONS: Record<Dimension, string> = {
  text_consistency: '考量视频内容是否遵循了文本Prompt的控制',
  temporal_consistency: '考量视频内部设定的一致性',
  visual_quality: '考量单帧画面本身的质量/可用性',
  distortion: '考量视频内部的结构稳定性，有没有被破坏',
  motion_quality: '考量动态的流畅度、自然性、物理合理性及镜头运动质量',
}

/**
 * All dimensions in order
 */
export const DIMENSIONS: Dimension[] = [
  'text_consistency',
  'temporal_consistency',
  'visual_quality',
  'distortion',
  'motion_quality',
]

// ============================================
// Checklist Types
// ============================================

/**
 * A single checklist item
 */
export interface ChecklistItem {
  id: string
  dimension: Dimension
  label: string
  description?: string
  isCore?: boolean  // Is this a core sub-dimension
}

/**
 * Checklist state - which items are checked
 */
export type ChecklistState = Record<string, boolean>

// ============================================
// Sample Types
// ============================================

/**
 * Base sample information common to both modes
 */
export interface BaseSample {
  sample_id: string
  prompt: string
  first_frame_url: string
  gt_video_url?: string
  checklist: ChecklistItem[]
}

/**
 * Sample for pair-wise annotation
 */
export interface PairSample extends BaseSample {
  video_a_url: string
  video_a_model?: string
  video_b_url: string
  video_b_model?: string
}

/**
 * Sample for score-wise annotation
 */
export interface ScoreSample extends BaseSample {
  video_url: string
  video_model?: string
}

/**
 * Union type for any sample
 */
export type Sample = PairSample | ScoreSample

/**
 * Type guard for PairSample
 */
export function isPairSample(sample: Sample): sample is PairSample {
  return 'video_a_url' in sample && 'video_b_url' in sample
}

/**
 * Type guard for ScoreSample
 */
export function isScoreSample(sample: Sample): sample is ScoreSample {
  return 'video_url' in sample && !('video_a_url' in sample)
}

// ============================================
// Annotation Result Types
// ============================================

/**
 * Video-level annotation in pair mode
 */
export interface VideoAnnotation {
  level: ProblemLevel
  major_reason: string
  minor_reason: string
}

/**
 * Dimension-level pair annotation
 */
export interface DimensionPairAnnotation {
  video_a: VideoAnnotation
  video_b: VideoAnnotation
  comparison: ComparisonResult
  degree_diff_reason?: string  // Only when same level
}

/**
 * Pair-wise annotation result - now supports per-dimension annotation
 */
export interface PairAnnotationResult {
  sample_id: string
  dimensions: Record<Dimension, DimensionPairAnnotation>
  checklist_results: ChecklistState
  annotated_at: string
}

/**
 * Score for a single dimension
 */
export interface DimensionScore {
  score: number  // 1-5
  major_reason: string
  minor_reason: string
}

/**
 * Score-wise annotation result
 */
export interface ScoreAnnotationResult {
  sample_id: string
  scores: Record<Dimension, DimensionScore>
  checklist_results: ChecklistState
  annotated_at: string
}

/**
 * Union type for any annotation result
 */
export type AnnotationResult = PairAnnotationResult | ScoreAnnotationResult

// ============================================
// Task Package Types
// ============================================

/**
 * Task package for pair-wise annotation
 */
export interface PairTaskPackage {
  task_id: string
  annotator_id: string
  mode: 'pair'
  created_at: string
  samples: PairSample[]
}

/**
 * Task package for score-wise annotation
 */
export interface ScoreTaskPackage {
  task_id: string
  annotator_id: string
  mode: 'score'
  created_at: string
  samples: ScoreSample[]
}

/**
 * Union type for any task package
 */
export type TaskPackage = PairTaskPackage | ScoreTaskPackage

// ============================================
// Export Result Types
// ============================================

/**
 * Complete export with task info and all annotations
 */
export interface AnnotationExport {
  task_id: string
  annotator_id: string
  mode: AnnotationMode
  total_samples: number
  completed_samples: number
  exported_at: string
  results: AnnotationResult[]
}

// ============================================
// Default Checklist Templates
// ============================================

/**
 * Default checklist items for each dimension
 */
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  // 文本一致性
  { id: 'tc_action', dimension: 'text_consistency', label: '动作对齐', description: '是否生成了文本描述的特定动作、交互、事件', isCore: true },
  { id: 'tc_subject', dimension: 'text_consistency', label: '主体对齐', description: '主体外表（颜色、形状、服饰、年龄等）、数量是否符合' },
  { id: 'tc_scene', dimension: 'text_consistency', label: '场景对齐', description: '场景（地点、时间、天气、室内外）、氛围是否符合' },
  { id: 'tc_camera', dimension: 'text_consistency', label: '运镜指令对齐', description: '是否准确执行了运镜指令' },
  
  // 时序一致性
  { id: 'temp_identity', dimension: 'temporal_consistency', label: '人脸/身份一致性', description: '同一人物不同帧间是否像同一个人', isCore: true },
  { id: 'temp_appearance', dimension: 'temporal_consistency', label: '外观一致性', description: '衣着、发饰、关键纹理保持跨帧一致' },
  { id: 'temp_scene', dimension: 'temporal_consistency', label: '场景一致性', description: '背景结构、空间关系、主要布景保持一致' },
  { id: 'temp_firstframe', dimension: 'temporal_consistency', label: '首帧延续一致性', description: '后续帧是否与首帧保持一致' },
  
  // 视觉质量
  { id: 'vq_clarity', dimension: 'visual_quality', label: '清晰度', description: '画面整体锐利度、细节保留程度', isCore: true },
  { id: 'vq_artifacts', dimension: 'visual_quality', label: '伪影/条纹', description: '有无伪影、条纹、重影、明显压缩感' },
  { id: 'vq_color', dimension: 'visual_quality', label: '色彩与曝光', description: '过曝欠曝、色偏、对比度异常' },
  
  // 畸变
  { id: 'dist_body', dimension: 'distortion', label: '肢体/文字畸变', description: '多手多腿多指、肢体变形、五官错位等', isCore: true },
  { id: 'dist_structure', dimension: 'distortion', label: '结构稳定', description: '局部结构破坏、形变、破碎、闪烁、跳动', isCore: true },
  { id: 'dist_subtitle', dimension: 'distortion', label: '字幕', description: '画面下方突然出现字幕' },
  
  // 运动质量
  { id: 'mq_physics', dimension: 'motion_quality', label: '物理合理性', description: '重力、惯性、碰撞、接触是否合理', isCore: true },
  { id: 'mq_natural', dimension: 'motion_quality', label: '运动自然感', description: '运动是否僵硬、"人机"', isCore: true },
  { id: 'mq_continuity', dimension: 'motion_quality', label: '运动连贯性', description: '有无卡顿、跳动、忽快忽慢', isCore: true },
  { id: 'mq_camera', dimension: 'motion_quality', label: '运镜质量', description: '镜头移动/变焦是否平滑稳定' },
]

// ============================================
// Score Labels
// ============================================

export const SCORE_LABELS: Record<number, { label: string; description: string }> = {
  5: { label: '完美', description: '无任何主要或次要错误，接近真实高质量视频' },
  4: { label: '优秀', description: '无主要错误，存在1-2处不明显的次要错误' },
  3: { label: '合格', description: '无主要错误，但存在明显且可感知的次要错误' },
  2: { label: '较差', description: '存在明显的主要错误，但未完全崩坏' },
  1: { label: '极差', description: '存在严重的主要错误且持续发生' },
}

export const PROBLEM_LEVEL_LABELS: Record<ProblemLevel, string> = {
  none: '无问题',
  minor: '次要问题',
  major: '主要问题',
}
