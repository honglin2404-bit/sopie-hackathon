'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type {
  SOP,
  SearchType,
  BackendSuggestion,
  HxlLevel,
  SearchHistoryItem,
} from '../types/sop'

// ----------------------------------------------------------------
// Config
// ----------------------------------------------------------------
const PROD_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sopie-search-tool.onrender.com'
const MAX_HISTORY = 8

function getBackendUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000'
  }
  return PROD_BACKEND
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function persistHistory(history: SearchHistoryItem[]): void {
  try {
    localStorage.setItem('sopie_search_history', JSON.stringify(history))
  } catch {}
}

function addToHistory(
  prev: SearchHistoryItem[],
  query: string,
  searchType: SearchType,
): SearchHistoryItem[] {
  const filtered = prev.filter(h => h.query !== query)
  return [{ query, searchType, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY)
}

// ----------------------------------------------------------------
// useSearch Hook
// ----------------------------------------------------------------
export function useSearch() {
  // --- Core search state ---
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('all')
  const [searchType, setSearchType] = useState<SearchType>('ai')
  const [results, setResults] = useState<SOP[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [backendSuggestion, setBackendSuggestion] = useState<BackendSuggestion | null>(null)

  // --- UI state ---
  const [activeHxlTabs, setActiveHxlTabs] = useState<Record<string, HxlLevel>>({})
  const [activeSuggestionTab, setActiveSuggestionTab] = useState('All')

  // --- Search history ---
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sopie_search_history')
      if (raw) setSearchHistory(JSON.parse(raw))
    } catch {}
  }, [])

  // ----------------------------------------------------------------
  // Main search handler
  // ----------------------------------------------------------------
  const handleSearch = useCallback(
    async (overrideQuery?: string) => {
      const rawQuery = (overrideQuery ?? query).trim()

      if (!rawQuery) {
        setError('Vui lòng nhập câu hỏi')
        return
      }

      if (searchType === 'keyword' && rawQuery.split(/\s+/).length > 5) {
        setError(
          'Bạn đang ở chế độ tra cứu bằng từ khóa. Xin vui lòng nhập từ khóa hoặc bật chế độ tra cứu AI',
        )
        return
      }

      setLoading(true)
      setError('')
      setResults([])
      setHasSearched(false)
      setBackendSuggestion(null)
      setActiveSuggestionTab('All')

      // ----------------------------------------------------------------
      // [FIX 1] Query Enrichment — AI Search
      // Vấn đề: query ngắn (≤4 từ) tạo ra vector thưa, không khớp tốt với
      // SOP embeddings vốn được tạo từ đoạn văn dài.
      // Giải pháp: làm giàu ngữ cảnh để cải thiện chất lượng vector,
      // nhưng vẫn gửi kèm rawQuery để backend dùng cho token-matching.
      // ----------------------------------------------------------------
      let finalQuery = rawQuery

      if (searchType === 'keyword' && /^-\d+/.test(finalQuery)) {
        // Keyword: bỏ dấu trừ đầu câu để tránh backend hiểu lầm là NOT operator
        finalQuery = finalQuery.replace(/^-/, '')
      }

      if (searchType === 'ai') {
        const wordCount = finalQuery.split(/\s+/).length

        if (wordCount <= 4) {
          // Query ngắn: lặp lại từ khóa để tăng weight, thêm "ZaloPay" để anchor domain.
          // Không dùng prefix dài vì các từ boilerplate ("hướng dẫn", "xử lý", "quy trình")
          // xuất hiện trong mọi SOP → gây false positives với score cao.
          finalQuery = `ZaloPay ${finalQuery} ${finalQuery}`
        }
        // Query dài (> 4 từ): giữ nguyên — đã đủ ngữ cảnh
      }

      const backendBase = getBackendUrl()

      try {
        const response = await fetch(`${backendBase}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: finalQuery,
            // [BUG FIX] Gửi kèm raw_query để backend dùng cho token-matching bonus.
            // Khi query bị enrich, các token phụ ("hướng", "dẫn", "xử lý", ...) làm
            // match_ratio giảm thấp → mất bonus +0.20 → score dưới ngưỡng 0.72.
            // Backend sẽ dùng raw_query cho scoring và finalQuery chỉ để tạo embedding.
            raw_query: rawQuery,
            domain: domain === 'all' ? null : domain,
            type: searchType === 'ai' ? 'semantic' : 'keyword',
            limit: 20,
          }),
        })

        const data = await response.json()

        if (!data.success) {
          setError('Lỗi kết nối API. Vui lòng kiểm tra status của backend server.')
          return
        }

        setHasSearched(true)
        if (data.suggestion) setBackendSuggestion(data.suggestion)

        let sorted: SOP[] = (data.results ?? []).sort(
          (a: SOP, b: SOP) => b.relevance_score - a.relevance_score,
        )

        // ----------------------------------------------------------------
        // [FIX 2] AI Fallback — bổ sung kết quả keyword khi AI yếu
        // Trigger khi: query ngắn (≤4 từ) VÀ không có kết quả nào >= 0.72
        // ----------------------------------------------------------------
        if (searchType === 'ai') {
          const hasGoodResult = sorted.some(r => r.relevance_score >= 0.72)
          const isShortQuery = rawQuery.split(/\s+/).length <= 4

          if (!hasGoodResult && isShortQuery) {
            try {
              const kwRes = await fetch(`${backendBase}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: rawQuery,
                  domain: domain === 'all' ? null : domain,
                  type: 'keyword',
                  limit: 5,
                }),
              })
              const kwData = await kwRes.json()

              if (kwData.success && kwData.results?.length > 0) {
                const aiIds = new Set(sorted.map(r => r.id))
                // Cap keyword scores tại 0.79 để không nhảy lên Top section
                const fromKw: SOP[] = kwData.results
                  .filter((r: SOP) => !aiIds.has(r.id))
                  .map((r: SOP) => ({
                    ...r,
                    relevance_score: Math.min(r.relevance_score, 0.79),
                  }))
                sorted = [...sorted, ...fromKw].sort(
                  (a, b) => b.relevance_score - a.relevance_score,
                )
              }
            } catch {
              // Fallback failure là non-critical, không throw
            }
          }
        }

        setResults(sorted)

        if (sorted.length === 0 && !data.suggestion) {
          setError(
            'Không tìm thấy SOP phù hợp. Vui lòng thử lại với từ khóa chi tiết hơn hoặc kiểm tra lại domain filter.',
          )
        }

        const defaultTabs: Record<string, HxlLevel> = {}
        sorted.forEach(r => {
          defaultTabs[r.id] = 'cs1'
        })
        setActiveHxlTabs(defaultTabs)

        // Save to history
        const newHistory = addToHistory(searchHistory, rawQuery, searchType)
        setSearchHistory(newHistory)
        persistHistory(newHistory)
      } catch (err) {
        console.error(err)
        setError('Không thể kết nối backend. Vui lòng kiểm tra server hoặc Network/CORS.')
      } finally {
        setLoading(false)
      }
    },
    [query, domain, searchType, searchHistory],
  )

  // ----------------------------------------------------------------
  // [FIX 3] hasHighConfidence — Giảm ngưỡng AI từ 0.80 xuống 0.72
  // ----------------------------------------------------------------
  const hasHighConfidence = useMemo(() => {
    if (searchType === 'keyword') {
      const lowerQuery = query.toLowerCase().trim()
      return results.some(item => {
        const content = (
          (item.title ?? '') +
          ' ' +
          (item.id ?? '') +
          ' ' +
          (item.cause ?? '') +
          ' ' +
          (item.solution?.level1 ?? '')
        ).toLowerCase()
        return content.includes(lowerQuery) || item.relevance_score >= 0.8
      })
    }
    // AI: tự tin nếu có ít nhất 1 kết quả >= 0.72
    return results.some(r => r.relevance_score >= 0.72)
  }, [results, searchType, query])

  // ----------------------------------------------------------------
  // [FIX 4] Top/Rest split — Dynamic threshold cho AI Search
  // ----------------------------------------------------------------
  const { top5Results, moreSuggestions } = useMemo(() => {
    let top: SOP[] = []
    let rest: SOP[] = []

    if (searchType === 'keyword') {
      const lowerQuery = query.toLowerCase().trim()

      // Nhóm A: khớp chính xác cụm từ
      const exactMatches = results.filter(item => {
        const content = (
          (item.title ?? '') +
          ' ' +
          (item.id ?? '') +
          ' ' +
          (item.cause ?? '') +
          ' ' +
          (item.solution?.level1 ?? '')
        ).toLowerCase()
        return content.includes(lowerQuery)
      })

      // Nhóm B: điểm cao (>= 0.8) nhưng không khớp chính xác
      const highScoreMatches = results.filter(
        item => !exactMatches.includes(item) && item.relevance_score >= 0.8,
      )

      // Nhóm C: còn lại
      const looseMatches = results.filter(
        item => !exactMatches.includes(item) && !highScoreMatches.includes(item),
      )

      const candidatesForTop = [...exactMatches, ...highScoreMatches]
      top = candidatesForTop.slice(0, 5)
      rest = [...candidatesForTop.slice(5), ...looseMatches].slice(0, 10)
    } else {
      // AI Search: Dynamic threshold
      const highScore = results.filter(r => r.relevance_score >= 0.80)

      if (highScore.length >= 2) {
        // Đủ kết quả tốt → dùng ngưỡng chuẩn
        top = highScore.slice(0, 5)
      } else if (results.length > 0) {
        // Ít kết quả tốt → hạ ngưỡng linh hoạt, không thấp dưới 0.55
        const bestScore = results[0].relevance_score
        const dynamicThreshold = Math.max(bestScore - 0.10, 0.55)
        top = results.filter(r => r.relevance_score >= dynamicThreshold).slice(0, 5)
      }

      rest = results.filter(r => !top.includes(r) && r.relevance_score >= 0.60).slice(0, 10)
    }

    return { top5Results: top, moreSuggestions: rest }
  }, [results, searchType, query])

  // ----------------------------------------------------------------
  // Derived domain tabs for suggestions
  // ----------------------------------------------------------------
  const suggestionDomains = useMemo(() => {
    const counts: Record<string, number> = {}
    moreSuggestions.forEach(r => {
      if (r.domain) counts[r.domain] = (counts[r.domain] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([d]) => d)
  }, [moreSuggestions])

  const filteredSuggestions = useMemo(() => {
    if (activeSuggestionTab === 'All') return moreSuggestions
    return moreSuggestions.filter(r => r.domain === activeSuggestionTab)
  }, [moreSuggestions, activeSuggestionTab])

  // ----------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------
  const handleTabChange = useCallback((id: string, level: HxlLevel) => {
    setActiveHxlTabs(prev => ({ ...prev, [id]: level }))
  }, [])

  const clearHistory = useCallback(() => {
    localStorage.removeItem('sopie_search_history')
    setSearchHistory([])
  }, [])

  return {
    // State
    query,
    setQuery,
    domain,
    setDomain,
    searchType,
    setSearchType,
    results,
    loading,
    error,
    hasSearched,
    backendSuggestion,
    activeHxlTabs,
    activeSuggestionTab,
    setActiveSuggestionTab,
    searchHistory,
    // Computed
    hasHighConfidence,
    top5Results,
    moreSuggestions,
    suggestionDomains,
    filteredSuggestions,
    // Actions
    handleSearch,
    handleTabChange,
    clearHistory,
  }
}
