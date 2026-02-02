import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, AlertCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'

export interface UploadedFileInfo {
  file: File
  name: string
  mode: 'pair' | 'score' | 'unknown'
  sampleCount: number
  status: 'pending' | 'parsed' | 'error'
  error?: string
  content?: unknown
}

interface FileUploaderProps {
  onFilesReady: (files: UploadedFileInfo[]) => void
  isLoading?: boolean
}

export function FileUploader({ onFilesReady, isLoading }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback(async (file: File): Promise<UploadedFileInfo> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target?.result as string)
          const mode = content.mode as 'pair' | 'score' | undefined
          const sampleCount = content.results?.length || content.task_package?.samples?.length || 0
          
          if (!mode || (mode !== 'pair' && mode !== 'score')) {
            resolve({
              file,
              name: file.name,
              mode: 'unknown',
              sampleCount: 0,
              status: 'error',
              error: '无法识别文件类型，需要包含 mode: "pair" 或 "score" 字段',
            })
            return
          }
          
          if (!content.task_package) {
            resolve({
              file,
              name: file.name,
              mode,
              sampleCount: 0,
              status: 'error',
              error: '文件缺少 task_package 字段，请使用转换后的格式',
            })
            return
          }
          
          resolve({
            file,
            name: file.name,
            mode,
            sampleCount,
            status: 'parsed',
            content,
          })
        } catch {
          resolve({
            file,
            name: file.name,
            mode: 'unknown',
            sampleCount: 0,
            status: 'error',
            error: 'JSON 解析失败',
          })
        }
      }
      
      reader.onerror = () => {
        resolve({
          file,
          name: file.name,
          mode: 'unknown',
          sampleCount: 0,
          status: 'error',
          error: '文件读取失败',
        })
      }
      
      reader.readAsText(file)
    })
  }, [])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setParseError(null)
    const fileArray = Array.from(files).filter(f => f.name.endsWith('.json'))
    
    if (fileArray.length === 0) {
      setParseError('请选择 JSON 文件')
      return
    }
    
    const parsedFiles = await Promise.all(fileArray.map(parseFile))
    
    // Merge with existing files, replacing duplicates by name
    setUploadedFiles(prev => {
      const newMap = new Map(prev.map(f => [f.name, f]))
      parsedFiles.forEach(f => newMap.set(f.name, f))
      return Array.from(newMap.values())
    })
  }, [parseFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input so the same file can be selected again
    e.target.value = ''
  }, [handleFiles])

  const handleRemoveFile = useCallback((fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName))
  }, [])

  const handleStartAnalysis = useCallback(() => {
    const validFiles = uploadedFiles.filter(f => f.status === 'parsed')
    if (validFiles.length > 0) {
      onFilesReady(validFiles)
    }
  }, [uploadedFiles, onFilesReady])

  const validFileCount = uploadedFiles.filter(f => f.status === 'parsed').length
  const pairFiles = uploadedFiles.filter(f => f.mode === 'pair' && f.status === 'parsed')
  const scoreFiles = uploadedFiles.filter(f => f.mode === 'score' && f.status === 'parsed')

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="w-full max-w-2xl">
        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer',
            'transition-all duration-300 ease-out',
            isDragOver 
              ? 'border-accent-400 bg-accent-500/10 scale-[1.02]' 
              : 'border-surface-700 bg-surface-900/50 hover:border-surface-600 hover:bg-surface-800/50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className={clsx('transition-transform duration-300', isDragOver && 'scale-110')}>
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent-500/20 to-accent-600/20 flex items-center justify-center">
              <Upload 
                className={clsx(
                  'w-10 h-10 transition-colors',
                  isDragOver ? 'text-accent-400' : 'text-surface-400'
                )}
              />
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-2">
              {isDragOver ? '松开以上传文件' : '拖拽文件到此处'}
            </h3>
            <p className="text-surface-400 mb-4">
              或点击选择文件
            </p>
            <p className="text-sm text-surface-500">
              支持 pair 和 score 模式的标注结果 JSON 文件，可多选
            </p>
          </div>
        </div>

        {/* Parse Error */}
        {parseError && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {parseError}
          </div>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-medium text-surface-400 mb-3">已上传文件</h4>
            
            {uploadedFiles.map((file) => (
              <div
                key={file.name}
                className={clsx(
                  'flex items-center justify-between p-4 rounded-xl border transition-colors',
                  file.status === 'error' 
                    ? 'bg-red-500/5 border-red-500/30' 
                    : 'bg-surface-800/50 border-surface-700/50'
                )}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Status Icon */}
                  <div className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    file.status === 'error' 
                      ? 'bg-red-500/20 text-red-400' 
                      : file.mode === 'pair' 
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-sky-500/20 text-sky-400'
                  )}>
                    {file.status === 'error' ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  
                  {/* File Info */}
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{file.name}</p>
                    {file.status === 'error' ? (
                      <p className="text-red-400 text-sm">{file.error}</p>
                    ) : (
                      <p className="text-surface-400 text-sm">
                        <span className={file.mode === 'pair' ? 'text-green-400' : 'text-sky-400'}>
                          {file.mode === 'pair' ? 'Pair' : 'Score'} 模式
                        </span>
                        <span className="mx-2 text-surface-600">|</span>
                        {file.sampleCount} 个样本
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile(file.name)
                  }}
                  className="p-2 text-surface-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Summary and Action */}
        {validFileCount > 0 && (
          <div className="mt-6 p-4 bg-surface-800/50 rounded-xl border border-surface-700/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-surface-400">
                已解析 {validFileCount} 个文件
                {pairFiles.length > 0 && (
                  <span className="ml-2 text-green-400">{pairFiles.length} pair</span>
                )}
                {scoreFiles.length > 0 && (
                  <span className="ml-2 text-sky-400">{scoreFiles.length} score</span>
                )}
              </div>
              
              <button
                onClick={handleStartAnalysis}
                disabled={isLoading}
                className={clsx(
                  'px-6 py-2.5 rounded-xl font-medium transition-all',
                  isLoading
                    ? 'bg-surface-700 text-surface-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-accent-600 to-accent-500 hover:from-accent-500 hover:to-accent-400 text-white shadow-lg shadow-accent-500/25'
                )}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    处理中...
                  </span>
                ) : (
                  '开始分析'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
