import { saveAs } from 'file-saver'
import type { TaskPackage, ChecklistItem, Dimension, ProblemLevel, ComparisonResult } from '../types'
import type { ExportedResults } from '../stores/annotationStore'

/**
 * Format a number with leading zeros
 */
export function padNumber(num: number, length: number = 2): string {
  return String(num).padStart(length, '0')
}

/**
 * Format seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${padNumber(mins)}:${padNumber(secs)}`
}

/**
 * Format seconds to MM:SS.ms format
 */
export function formatTimeWithMs(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${padNumber(mins)}:${padNumber(secs)}.${padNumber(ms)}`
}

/**
 * Download a JSON file
 */
export function downloadJSON(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
  saveAs(blob, filename)
}

/**
 * Parse a task package from JSON string
 */
export function parseTaskPackage(jsonString: string): TaskPackage {
  const parsed = JSON.parse(jsonString)
  
  // Validate required fields
  if (!parsed.task_id || !parsed.annotator_id || !parsed.mode || !parsed.samples) {
    throw new Error('Invalid task package format: missing required fields')
  }
  
  if (parsed.mode !== 'pair' && parsed.mode !== 'score') {
    throw new Error('Invalid task package format: mode must be "pair" or "score"')
  }
  
  if (!Array.isArray(parsed.samples) || parsed.samples.length === 0) {
    throw new Error('Invalid task package format: samples must be a non-empty array')
  }
  
  return parsed as TaskPackage
}

/**
 * Check if the JSON is an exported results file (for rework)
 */
export function isExportedResults(parsed: unknown): parsed is ExportedResults {
  if (typeof parsed !== 'object' || parsed === null) return false
  const obj = parsed as Record<string, unknown>
  return (
    'task_package' in obj &&
    'results' in obj &&
    Array.isArray(obj.results) &&
    typeof obj.task_package === 'object'
  )
}

/**
 * Parse exported results from JSON string (for rework)
 */
export function parseExportedResults(jsonString: string): ExportedResults {
  const parsed = JSON.parse(jsonString)
  
  // Validate it's an exported results file
  if (!isExportedResults(parsed)) {
    throw new Error('Invalid exported results format: missing task_package or results')
  }
  
  // Validate the embedded task package
  const taskPackage = parsed.task_package
  if (!taskPackage.task_id || !taskPackage.annotator_id || !taskPackage.mode || !taskPackage.samples) {
    throw new Error('Invalid exported results: embedded task_package is malformed')
  }
  
  if (taskPackage.mode !== 'pair' && taskPackage.mode !== 'score') {
    throw new Error('Invalid exported results: mode must be "pair" or "score"')
  }
  
  if (!Array.isArray(taskPackage.samples) || taskPackage.samples.length === 0) {
    throw new Error('Invalid exported results: samples must be a non-empty array')
  }
  
  return parsed
}

/**
 * Read a file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Group checklist items by dimension
 */
export function groupChecklistByDimension(items: ChecklistItem[]): Record<Dimension, ChecklistItem[]> {
  const grouped: Record<Dimension, ChecklistItem[]> = {
    text_consistency: [],
    temporal_consistency: [],
    visual_quality: [],
    distortion: [],
    motion_quality: [],
  }
  
  for (const item of items) {
    grouped[item.dimension].push(item)
  }
  
  return grouped
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Get keyboard shortcut display string
 */
export function getShortcutDisplay(key: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  
  return key
    .replace('mod', isMac ? '⌘' : 'Ctrl')
    .replace('alt', isMac ? '⌥' : 'Alt')
    .replace('shift', '⇧')
    .replace('enter', '↵')
    .replace('space', '␣')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
}

/**
 * Playback speed options
 */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

/**
 * Common problem templates for quick fill - organized by major/minor
 * Matches the structure from problem_template.json
 */
export const PROBLEM_TEMPLATES: Record<Dimension, { major: string[]; minor: string[] }> = {
  text_consistency: {
    major: [
      '核心动作没做',
      '动作/运镜反向',
      '动作类型错误',
      '关键属性错误',
      '动作顺序错乱',
      '核心主体数量错误',
      '场景严重不符',
    ],
    minor: [
      '动作做不到位',
      '漏掉次要动作',
      '主体属性偏差',
      '场景偏差',
    ],
  },
  temporal_consistency: {
    major: [
      '人脸改变',
      '核心物体消失',
      '色调明显改变',
    ],
    minor: [
      '人脸漂移',
      '物体特征漂移',
      '非核心物体消失',
      '色调轻微漂移',
    ],
  },
  visual_quality: {
    major: [
      '画面明显模糊',
      '画面过度平滑',
      '人脸严重磨皮',
      '画面明显条纹',
    ],
    minor: [
      '人脸轻微磨皮',
      '轻微模糊',
      '非核心区轻微涂抹',
    ],
  },
  distortion: {
    major: [
      '手指明显畸变',
      '手脚明显畸变',
      '多手多脚',
      '肢体变形',
      '眼球明显畸变',
      '线条明显畸变',
      '文字明显畸变',
    ],
    minor: [
      '手指轻微畸变',
      '脚轻微畸变',
      '眼球轻微畸变',
      '线条轻微畸变',
      '轻微闪烁',
    ],
  },
  motion_quality: {
    major: [
      '滑步',
      '反重力',
      '运动明显穿模',
      '运动僵硬/人机感',
      '表情僵硬',
      '运动卡顿',
      '烟到处飘',
      '水流向不对',
    ],
    minor: [
      '头发、衣服没跟着动',
      '运动有点卡',
      '运动轻微不自然',
      '表情轻微僵硬',
    ],
  },
}

/**
 * Problem level severity ranking: major > minor > none
 */
const PROBLEM_LEVEL_SEVERITY: Record<ProblemLevel, number> = {
  major: 2,
  minor: 1,
  none: 0,
}

/**
 * Human-readable problem level labels
 */
const PROBLEM_LEVEL_DISPLAY: Record<ProblemLevel, string> = {
  major: '主要问题',
  minor: '次要问题',
  none: '无问题',
}

/**
 * Comparison result labels
 */
const COMPARISON_DISPLAY: Record<ComparisonResult, string> = {
  'A>B': 'A 更好',
  'A=B': '一样好',
  'A<B': 'B 更好',
}

/**
 * Detect logical contradiction between problem levels and comparison result
 * 
 * Contradiction occurs when:
 * - A has more severe problems but is selected as better (or equal)
 * - B has more severe problems but is selected as better (or equal)
 * - Problem severity differs but "equal" is selected
 */
export function detectComparisonContradiction(
  aLevel: ProblemLevel,
  bLevel: ProblemLevel,
  comparison: ComparisonResult
): { hasContradiction: boolean; message: string } {
  const aSeverity = PROBLEM_LEVEL_SEVERITY[aLevel]
  const bSeverity = PROBLEM_LEVEL_SEVERITY[bLevel]
  
  // A has more severe problems (A is worse)
  if (aSeverity > bSeverity) {
    // A is worse, so B should be better (A<B is correct)
    if (comparison === 'A>B') {
      return {
        hasContradiction: true,
        message: `视频 A 有${PROBLEM_LEVEL_DISPLAY[aLevel]}，视频 B ${bLevel === 'none' ? '无问题' : `有${PROBLEM_LEVEL_DISPLAY[bLevel]}`}，但选择了 ${COMPARISON_DISPLAY[comparison]}`,
      }
    }
    if (comparison === 'A=B') {
      return {
        hasContradiction: true,
        message: `视频 A 有${PROBLEM_LEVEL_DISPLAY[aLevel]}，视频 B ${bLevel === 'none' ? '无问题' : `有${PROBLEM_LEVEL_DISPLAY[bLevel]}`}，但选择了 ${COMPARISON_DISPLAY[comparison]}`,
      }
    }
  }
  
  // B has more severe problems (B is worse)
  if (bSeverity > aSeverity) {
    // B is worse, so A should be better (A>B is correct)
    if (comparison === 'A<B') {
      return {
        hasContradiction: true,
        message: `视频 A ${aLevel === 'none' ? '无问题' : `有${PROBLEM_LEVEL_DISPLAY[aLevel]}`}，视频 B 有${PROBLEM_LEVEL_DISPLAY[bLevel]}，但选择了 ${COMPARISON_DISPLAY[comparison]}`,
      }
    }
    if (comparison === 'A=B') {
      return {
        hasContradiction: true,
        message: `视频 A ${aLevel === 'none' ? '无问题' : `有${PROBLEM_LEVEL_DISPLAY[aLevel]}`}，视频 B 有${PROBLEM_LEVEL_DISPLAY[bLevel]}，但选择了 ${COMPARISON_DISPLAY[comparison]}`,
      }
    }
  }
  
  return { hasContradiction: false, message: '' }
}
