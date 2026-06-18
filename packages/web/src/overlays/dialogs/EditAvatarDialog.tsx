import { Loader2, RotateCcw, RotateCw, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGE_DIMENSION = 4096 // 最大像素尺寸（宽或高）
const OUTPUT_SIZE = 512 // 输出头像尺寸上限
const VIEW_SIZE = 320 // 预览画布尺寸
const SCALE_RATIO = OUTPUT_SIZE / VIEW_SIZE

interface EditAvatarDialogProps {
  currentAvatar?: string | null
  onClose?: (result?: unknown) => void
  onConfirm?: (file: File) => void | Promise<void>
}

export default function EditAvatarDialog({
  currentAvatar,
  onClose,
  onConfirm,
}: EditAvatarDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imageSrc, setImageSrc] = useState<string | null>(currentAvatar ?? null)
  const [scale, setScale] = useState(1)
  const [rotate, setRotate] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingImage, setIsLoadingImage] = useState(false)

  // 加载图片对象
  useEffect(() => {
    if (!imageSrc) {
      setImgObj(null)
      return
    }
    setLoadError(null)
    setIsLoadingImage(true)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setIsLoadingImage(false)
      setImgObj(img)
      setScale(1)
      setRotate(0)
      setOffset({ x: 0, y: 0 })
    }
    img.onerror = () => {
      setIsLoadingImage(false)
      setLoadError('图片加载失败，请尝试其他图片')
      setImgObj(null)
    }
    img.src = imageSrc
  }, [imageSrc])

  // 绘制画布
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgObj) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = VIEW_SIZE * dpr
    canvas.height = VIEW_SIZE * dpr
    canvas.style.width = `${VIEW_SIZE}px`
    canvas.style.height = `${VIEW_SIZE}px`
    ctx.scale(dpr, dpr)

    // 清空画布
    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE)

    // 绘制半透明黑色背景（遮罩）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE)

    // 计算中心裁剪区域（正方形）
    const frameSize = VIEW_SIZE * 0.8
    const frameX = (VIEW_SIZE - frameSize) / 2
    const frameY = (VIEW_SIZE - frameSize) / 2

    // 在中心区域清空（透明）
    ctx.clearRect(frameX, frameY, frameSize, frameSize)

    // 绘制图片（限制在中心区域内）
    ctx.save()
    ctx.beginPath()
    ctx.rect(frameX, frameY, frameSize, frameSize)
    ctx.clip()

    // 计算绘制参数
    const rad = (rotate * Math.PI) / 180
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))
    const imgW = imgObj.width
    const imgH = imgObj.height

    // 计算旋转后的包围盒，使图片能覆盖整个裁剪框
    const boxW = imgW * cos + imgH * sin
    const boxH = imgW * sin + imgH * cos
    const baseScale = Math.max(frameSize / boxW, frameSize / boxH)
    const finalScale = baseScale * scale

    ctx.translate(VIEW_SIZE / 2 + offset.x, VIEW_SIZE / 2 + offset.y)
    ctx.rotate(rad)
    ctx.scale(finalScale, finalScale)
    ctx.drawImage(imgObj, -imgW / 2, -imgH / 2)

    ctx.restore()

    // 绘制白色边框
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(frameX, frameY, frameSize, frameSize)
  }, [imgObj, scale, rotate, offset])

  /**
   * 压缩图片至最大像素尺寸内
   */
  const compressImage = useCallback((dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
          resolve(dataUrl)
          return
        }
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height)
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(dataUrl)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.92))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  }, [])

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error('图片大小不能超过 5MB')
        return
      }
      if (!ACCEPTED_TYPES.split(',').includes(file.type)) {
        toast.error('仅支持 PNG、JPEG、WebP 格式')
        return
      }

      const reader = new FileReader()
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string
        const compressed = await compressImage(dataUrl)
        setImageSrc(compressed)
      }
      reader.onerror = () => {
        toast.error('图片读取失败')
      }
      reader.readAsDataURL(file)
    },
    [compressImage],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
      e.target.value = ''
    },
    [handleFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleRotateLeft = () => setRotate((prev) => prev - 90)
  const handleRotateRight = () => setRotate((prev) => prev + 90)

  const handleScaleChange = (value: number[]) => setScale(value[0])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prev) => Math.min(3, Math.max(0.5, prev + delta)))
  }, [])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imgObj) return
    setIsDraggingImage(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingImage) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    // 将鼠标 delta 逆旋转，使拖拽方向与视觉一致
    const rad = (-rotate * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const rdx = dx * cos - dy * sin
    const rdy = dx * sin + dy * cos
    setOffset((prev) => ({
      x: prev.x + rdx,
      y: prev.y + rdy,
    }))
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => setIsDraggingImage(false)
  const handleMouseLeave = () => setIsDraggingImage(false)

  const getCroppedFile = async (): Promise<File | null> => {
    if (!imgObj) return null

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 白色背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    const rad = (rotate * Math.PI) / 180
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))
    const imgW = imgObj.width
    const imgH = imgObj.height
    const boxW = imgW * cos + imgH * sin
    const boxH = imgW * sin + imgH * cos
    const baseScale = OUTPUT_SIZE / Math.max(boxW, boxH)
    const finalScale = baseScale * scale

    ctx.translate(
      OUTPUT_SIZE / 2 + offset.x * SCALE_RATIO,
      OUTPUT_SIZE / 2 + offset.y * SCALE_RATIO,
    )
    ctx.rotate(rad)
    ctx.scale(finalScale, finalScale)
    ctx.drawImage(imgObj, -imgW / 2, -imgH / 2)

    return new Promise((resolve) => {
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          resolve(null)
          return
        }
        const file = new File([blob], 'avatar.png', { type: 'image/png' })
        resolve(file)
      }, 'image/png')
    })
  }

  const handleConfirm = async () => {
    if (!imageSrc) {
      toast.error('请先选择图片')
      return
    }

    setIsSubmitting(true)
    try {
      const file = await getCroppedFile()
      if (!file) {
        toast.error('图片处理失败')
        return
      }
      await onConfirm?.(file)
      onClose?.(true)
    } catch {
      toast.error('保存失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTriggerUpload = () => fileInputRef.current?.click()

  return (
    <Dialog open onOpenChange={() => onClose?.(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑头像</DialogTitle>
          <DialogDescription>拖拽移动图片，滚轮缩放，点击按钮旋转</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 图片编辑区 */}
          {imageSrc ? (
            <div className="space-y-3">
              {/* Canvas 预览 */}
              <div className="relative mx-auto h-[320px] w-[320px] overflow-hidden rounded-lg bg-muted">
                {isLoadingImage ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-sm">图片加载中...</span>
                  </div>
                ) : loadError ? (
                  <div className="flex h-full items-center justify-center text-sm text-destructive">
                    {loadError}
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="cursor-move"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onWheel={handleWheel}
                  />
                )}
              </div>

              {/* 工具栏 */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRotateLeft}
                  title="向左旋转"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRotateRight}
                  title="向右旋转"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleTriggerUpload}>
                  <Upload className="mr-1.5 h-4 w-4" />
                  重新选择
                </Button>
              </div>

              {/* 缩放滑块 */}
              <div className="flex items-center gap-3 px-2">
                <span className="text-xs text-muted-foreground">缩小</span>
                <Slider
                  value={[scale]}
                  min={0.5}
                  max={3}
                  step={0.1}
                  onValueChange={handleScaleChange}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground">放大</span>
              </div>
            </div>
          ) : (
            /* 上传区域 */
            <div
              className={`flex h-[240px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onClick={handleTriggerUpload}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">点击或拖拽上传图片</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  支持 PNG、JPEG、WebP，不大于 5MB
                </p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleInputChange}
          />

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose?.(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={!imageSrc || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              确认保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
