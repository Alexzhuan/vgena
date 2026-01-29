import { useState, useCallback, useRef } from 'react'
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useAnnotationStore } from '../../stores/annotationStore'
import { parseTaskPackage, readFileAsText } from '../../utils'
import clsx from 'clsx'

export function TaskLoader() {
  const { loadTaskPackage } = useAnnotationStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('请上传 JSON 格式的任务包文件')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const content = await readFileAsText(file)
      const taskPackage = parseTaskPackage(content)
      
      setSuccess(true)
      setTimeout(() => {
        loadTaskPackage(taskPackage)
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败')
    } finally {
      setIsLoading(false)
    }
  }, [loadTaskPackage])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  // Demo task for testing
  const loadDemoTask = () => {
    const demoTask = {
      task_id: 'demo_task_001',
      annotator_id: 'demo_annotator',
      mode: 'pair' as const,
      created_at: new Date().toISOString(),
      samples: [
        {
          sample_id: 'demo_sample_1',
          prompt: 'A young woman with long brown hair walks through a sunlit forest, her dress flowing in the gentle breeze. She pauses to pick a wildflower, smiling softly.',
          first_frame_url: 'https://picsum.photos/seed/frame1/640/360',
          video_a_url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
          video_a_model: 'model_a',
          video_b_url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
          video_b_model: 'model_b',
          checklist: [
            { id: 'tc_action', dimension: 'text_consistency' as const, label: '动作对齐', description: '是否生成了文本描述的动作', isCore: true },
            { id: 'tc_subject', dimension: 'text_consistency' as const, label: '主体对齐', description: '主体外表是否符合' },
            { id: 'temp_identity', dimension: 'temporal_consistency' as const, label: '人脸/身份一致性', description: '是否像同一个人', isCore: true },
            { id: 'vq_clarity', dimension: 'visual_quality' as const, label: '清晰度', description: '画面整体锐利度', isCore: true },
            { id: 'dist_body', dimension: 'distortion' as const, label: '肢体/文字畸变', description: '多手多腿多指等', isCore: true },
            { id: 'mq_physics', dimension: 'motion_quality' as const, label: '物理合理性', description: '物理是否合理', isCore: true },
          ],
        },
        {
          sample_id: 'demo_sample_2',
          prompt: 'A chef in a professional kitchen expertly flips a pancake in a sizzling pan, steam rising as the golden-brown surface glistens.',
          first_frame_url: 'https://picsum.photos/seed/frame2/640/360',
          video_a_url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
          video_a_model: 'model_a',
          video_b_url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
          video_b_model: 'model_b',
          checklist: [
            { id: 'tc_action', dimension: 'text_consistency' as const, label: '动作对齐', description: '是否生成了文本描述的动作', isCore: true },
            { id: 'tc_subject', dimension: 'text_consistency' as const, label: '主体对齐', description: '主体外表是否符合' },
            { id: 'temp_identity', dimension: 'temporal_consistency' as const, label: '人脸/身份一致性', description: '是否像同一个人', isCore: true },
            { id: 'vq_clarity', dimension: 'visual_quality' as const, label: '清晰度', description: '画面整体锐利度', isCore: true },
            { id: 'dist_body', dimension: 'distortion' as const, label: '肢体/文字畸变', description: '多手多腿多指等', isCore: true },
            { id: 'mq_physics', dimension: 'motion_quality' as const, label: '物理合理性', description: '物理是否合理', isCore: true },
          ],
        },
      ],
    }
    
    loadTaskPackage(demoTask)
  }

  return (
    <div className="w-full max-w-2xl animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent-400/20 to-accent-600/20 border border-accent-500/30 flex items-center justify-center">
          <FileJson className="w-8 h-8 text-accent-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">加载标注任务</h1>
        <p className="text-surface-400">
          上传 JSON 格式的任务包文件开始标注工作
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
          isDragging 
            ? 'border-accent-500 bg-accent-500/10' 
            : 'border-surface-600 hover:border-surface-500 hover:bg-surface-800/50',
          success && 'border-success bg-success/10',
          error && 'border-danger bg-danger/10',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-accent-400 animate-spin" />
            <span className="text-surface-300">正在解析任务文件...</span>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-success" />
            <span className="text-success font-medium">任务加载成功！</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-12 h-12 text-danger" />
            <span className="text-danger font-medium">{error}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setError(null); }}
              className="text-sm text-surface-400 hover:text-surface-200 underline"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={clsx(
              'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
              isDragging ? 'bg-accent-500/30' : 'bg-surface-700'
            )}>
              <Upload className={clsx(
                'w-8 h-8 transition-colors',
                isDragging ? 'text-accent-400' : 'text-surface-400'
              )} />
            </div>
            <div>
              <span className="text-surface-200 font-medium">点击选择文件</span>
              <span className="text-surface-500"> 或拖拽到此处</span>
            </div>
            <span className="text-sm text-surface-500">
              支持 .json 格式的任务包文件
            </span>
          </div>
        )}
      </div>

      {/* Task format hint */}
      <div className="mt-6 p-4 bg-surface-800/50 rounded-xl border border-surface-700">
        <h3 className="font-medium mb-2 text-sm">任务包格式说明</h3>
        <pre className="text-xs text-surface-400 font-mono overflow-x-auto">
{`{
  "task_id": "batch_001",
  "annotator_id": "annotator_A",
  "mode": "pair" | "score",
  "samples": [
    {
      "sample_id": "...",
      "prompt": "...",
      "first_frame_url": "...",
      "video_a_url": "...",  // pair mode
      "video_b_url": "...",  // pair mode
      "video_url": "...",    // score mode
      "checklist": [...]
    }
  ]
}`}
        </pre>
      </div>

      {/* Demo button */}
      <div className="mt-6 text-center">
        <button
          onClick={loadDemoTask}
          className="text-sm text-surface-400 hover:text-accent-400 underline transition-colors"
        >
          加载演示任务（测试用）
        </button>
      </div>
    </div>
  )
}
