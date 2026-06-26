import { useEffect, useState } from 'react'

interface CompanionTypingIndicatorProps {
  content: string
  intervalMs?: number
  className?: string
  onComplete?: () => void
}

const DEFAULT_INTERVAL = 18

export function CompanionTypingIndicator({
  content,
  intervalMs = DEFAULT_INTERVAL,
  className,
  onComplete,
}: CompanionTypingIndicatorProps) {
  const [displayedCount, setDisplayedCount] = useState(0)

  useEffect(() => {
    setDisplayedCount(0)
  }, [content])

  useEffect(() => {
    if (displayedCount >= content.length) {
      onComplete?.()
      return
    }

    const timer = setInterval(() => {
      setDisplayedCount((prev) => {
        const next = prev + 1
        if (next >= content.length) {
          clearInterval(timer)
        }
        return next
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [content, displayedCount, intervalMs, onComplete])

  return (
    <span className={className}>
      {content.slice(0, displayedCount)}
      {displayedCount < content.length && (
        <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" />
      )}
    </span>
  )
}
