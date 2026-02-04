import { useEffect, useRef, useState } from 'react'
import { User } from 'lucide-react'
import clsx from 'clsx'

interface InputDialogProps {
  isOpen: boolean
  title: string
  label: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  onConfirm: (value: string) => void
  onCancel: () => void
  validate?: (value: string) => string | null // Returns error message or null if valid
}

export function InputDialog({
  isOpen,
  title,
  label,
  placeholder = '',
  defaultValue = '',
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  validate,
}: InputDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)

  // Reset value when dialog opens
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
      setError(null)
      // Focus input after a small delay
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, defaultValue])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  const handleConfirm = () => {
    const trimmedValue = value.trim()
    
    // Run validation if provided
    if (validate) {
      const validationError = validate(trimmedValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    
    // Default validation: require non-empty value
    if (!trimmedValue) {
      setError('请输入内容')
      return
    }
    
    onConfirm(trimmedValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    if (error) setError(null) // Clear error on input change
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-700">
          <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-accent-400" />
          </div>
          <h2 id="dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          <label className="block text-sm font-medium text-surface-300 mb-2">
            {label}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={clsx(
              'w-full px-3 py-2.5 bg-surface-900 border rounded-lg text-sm',
              'placeholder:text-surface-500 transition-colors outline-none',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-surface-600 focus:border-accent-500 focus:ring-1 focus:ring-accent-500'
            )}
          />
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-surface-700 bg-surface-850 rounded-b-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-600 hover:bg-accent-500 text-white transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
