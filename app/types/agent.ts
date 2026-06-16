// Agent Types - SOPie Resolution Agent V2

export type AnalyzeMode = 'fd' | 'free'

export type Urgency = 'Thap' | 'Trung binh' | 'Cao'

// Actual values from backend (main.py)
export type CustomerTone =
  | 'binh_thuong'  // neutral, normal
  | 'kho_chiu'     // frustrated
  | 'gay_gat'      // aggressive
  | 'de_doa'       // threatening
  | 'angry' | 'neutral' | 'normal' // legacy fallbacks

export interface SourceKnowledge {
  sopId: string
  sopTitle: string
  domain: string
  relevance: string
  link?: string
}

export interface ToolLink {
  name: string
  url: string
}

export interface ToolGuidance {
  guideline: string
  tools: ToolLink[]
}

export interface InternalNote {
  userId: string | null
  transId: string | null
  hasTransId: boolean
  issueSummary: string
  rootCause: string
  suggestedAction: string
  fullText: string
}

export interface AnalysisResult {
  caseSummary: string
  errorCodes: string[]
  domain: string
  urgency: Urgency
  customerTone: CustomerTone
  processingDirection: string
  internalNote: InternalNote
  customerReply: string
  replyToneNote: string
  sourceKnowledge: SourceKnowledge[]
  confidence: number
  toolGuidance?: ToolGuidance
  appointmentDate?: string | null  // T+N business days deadline, calculated from TransID date
}

export interface AnalyzeResponse {
  success: boolean
  result?: AnalysisResult | Partial<AnalysisResult>
  error?: string
  errorCode?: 'NOT_FOUND' | 'LOW_CONFIDENCE' | 'EXTRACTION_ERROR' | 'API_ERROR'
}

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
