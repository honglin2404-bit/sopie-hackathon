'use client'

import { useState, useCallback } from 'react'
import type { AnalysisResult, AnalyzeResponse, AnalyzeRequest } from '../types/agent'

interface UseAnalyzeReturn {
  loading: boolean
  result: AnalysisResult | null
  error: string | null
  errorCode: string | null
  isLowConfidence: boolean
  analyze: (payload: AnalyzeRequest) => Promise<void>
  reset: () => void
}

export function useAnalyze(): UseAnalyzeReturn {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isLowConfidence, setIsLowConfidence] = useState(false)

  const analyze = useCallback(async (payload: AnalyzeRequest) => {
    setLoading(true)
    setError(null)
    setErrorCode(null)
    setResult(null)
    setIsLowConfidence(false)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data: AnalyzeResponse = await res.json()

      if (data.success && data.result) {
        setResult(data.result as AnalysisResult)
      } else if (data.errorCode === 'LOW_CONFIDENCE' && data.result) {
        setIsLowConfidence(true)
        setResult(data.result as AnalysisResult)
        setError(data.error || null)
        setErrorCode(data.errorCode)
      } else {
        setError(data.error || 'Đã xảy ra lỗi không xác định')
        setErrorCode(data.errorCode || null)
      }
    } catch {
      setError('Không thể kết nối đến server. Vui lòng thử lại.')
      setErrorCode('API_ERROR')
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setErrorCode(null)
    setIsLowConfidence(false)
  }, [])

  return { loading, result, error, errorCode, isLowConfidence, analyze, reset }
}
