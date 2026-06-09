// ============================================================
// Agent Types — SOPie Resolution Agent V2
// ============================================================

export type AnalyzeMode = 'fd' | 'free'

export type Urgency = 'Thấp' | 'Trung bình' | 'Cao'

export interface SourceKnowledge {
  sopId: string
  sopTitle: string
  domain: string
  relevance: string
}

export interface RecommendedAction {
  primaryAction: string
  steps: string[]
  escalate: boolean
  escalateTo?: string | null
}

export interface AnalysisResult {
  // Context Extraction
  ticketSummary: string
  rootCause: string
  customerIntent: string
  domain: string
  urgency: Urgency
  // Reasoning + Recommendation
  recommendation: RecommendedAction
  // Response Generation
  customerReply: string
  internalNote: string
  // Meta
  confidence: number
  sourceKnowledge: SourceKnowledge[]
}

export interface AnalyzeResponse {
  success: boolean
  result?: AnalysisResult | Partial<AnalysisResult>
  error?: string
  errorCode?: 'NOT_FOUND' | 'LOW_CONFIDENCE' | 'EXTRACTION_ERROR' | 'API_ERROR'
}

// Request shapes
export interface FDAnalyzeRequest {
  mode: 'fd'
  ticketContent: string
}

export interface FreeAnalyzeRequest {
  mode: 'free'
  issueDescription: string
  attemptedSolutions?: string
}

export type AnalyzeRequest = FDAnalyzeRequest | FreeAnalyzeRequest
