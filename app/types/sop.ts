// ============================================================
// SOP Types — zalopay-cs-search
// ============================================================

export interface CheckTools {
  guideline?: string
  name?: string
  url?: string
}

export interface Solution {
  level1?: string
  level2?: string
}

export interface Templates {
  email?: string
  chat?: string
}

export interface SOP {
  id: string
  title: string
  domain: string
  cause?: string
  solution?: Solution
  templates: Templates
  check_tools?: CheckTools
  notes?: string
  link?: string
  last_updated?: string
  relevance_score: number
}

export interface Notification {
  id: number
  type?: 'realtime' | 'summary' | 'issue'
  message: string
  created_at: string
  // Enriched client-side
  theme?: 'blue' | 'green' | 'orange'
  position?: 'left' | 'right'
  header?: string
  time?: string
  url?: string
  btnLabel?: string
}

export interface BackendSuggestion {
  link?: string
  link_label?: string
}

export type SearchType = 'ai' | 'keyword'
export type HxlLevel = 'cs1' | 'cs2'

export interface SearchHistoryItem {
  query: string
  searchType: SearchType
  timestamp: number
}
