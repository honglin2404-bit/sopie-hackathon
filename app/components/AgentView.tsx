'use client'

import React, { useState, useCallback } from 'react'
import { useAnalyze } from '../hooks/useAnalyze'
import type { AnalyzeMode, AnalysisResult, ToolGuidance } from '../types/agent'

const FD_PLACEHOLDER = `Dán toàn bộ nội dung ticket FD vào đây. Ví dụ:

Ticket ID: #5885023
Tiêu đề: Không được giảm giá khi thanh toán (Mã GD: 260603003785147)
UserID: 190115000006235
Mã lỗi TPE: -333 Thất bại
Step result: -1|21|111003|Không thể áp dụng ưu đãi.
Bank Code: ZPTCB - Techcombank`

const FREE_ISSUE_PLACEHOLDER = `Mô tả vấn đề của khách hàng. Ví dụ:
"KH báo mã lỗi -333 khi thanh toán bằng voucher, GD thất bại. TransID: 260603003785147"`

const FREE_TRIED_PLACEHOLDER = `Những gì đã thử hoặc đã làm. Ví dụ:
"Đã hướng dẫn KH thử lại không dùng voucher, vẫn lỗi."`

// Pre-defined payment status codes for re-check dropdown
const PAYMENT_STATUS_OPTIONS = [
  { value: '1', label: '1 — Giao dịch thành công' },
  { value: '-400', label: '-400 — Đang xử lý / Pending' },
  { value: '-53', label: '-53 — Đang xử lý / Pending (đối tác)' },
  { value: '6', label: '6 — Đang xử lý / Pending (đối tác)' },
  { value: '7', label: '7 — Đang xử lý / Pending (đối tác)' },
  { value: '-402', label: '-402 — Thất bại hoàn toàn' },
  { value: '-1', label: '-1 — Lỗi hệ thống' },
  { value: '-333', label: '-333 — Voucher / Khuyến mãi lỗi' },
  { value: '-1343', label: '-1343 — Vượt hạn mức chi tiêu' },
  { value: 'other', label: 'Khác (nhập tay)' },
]

const URGENCY_COLOR: Record<string, string> = {
  'Cao': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Trung binh': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Thap': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Thấp': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Trung bình': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

const TONE_MAP: Record<string, { label: string; color: string }> = {
  // Values from main.py
  binh_thuong: { label: 'Bình thường',  color: 'text-green-600 dark:text-green-400' },
  kho_chiu:    { label: 'Khó chịu',     color: 'text-yellow-600 dark:text-yellow-400' },
  gay_gat:     { label: 'Gay gắt',      color: 'text-orange-600 dark:text-orange-400' },
  de_doa:      { label: 'Đe dọa',       color: 'text-red-600 dark:text-red-400' },
  // Legacy fallbacks
  angry:       { label: 'Bức xúc',      color: 'text-red-600 dark:text-red-400' },
  neutral:     { label: 'Trung tính',   color: 'text-yellow-600 dark:text-yellow-400' },
  normal:      { label: 'Bình thường',  color: 'text-green-600 dark:text-green-400' },
}

const confidenceColor = (n: number) =>
  n >= 85 ? 'text-green-600 dark:text-green-400' : n >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
    >
      {copied ? 'Copied!' : `Copy ${label}`}
    </button>
  )
}

function SectionCard({
  icon, title, sub, children, copyText, copyLabel,
}: {
  icon: string; title: string; sub?: string; children: React.ReactNode; copyText?: string; copyLabel?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          {sub && <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{sub}</span>}
        </div>
        {copyText && <CopyButton text={copyText} label={copyLabel} />}
      </div>
      {children}
    </div>
  )
}

// ─── Tool Check Guidance Box ───────────────────────────────────────────────────
function ToolCheckBox({ toolGuidance }: { toolGuidance: ToolGuidance }) {
  if (!toolGuidance.guideline) return null
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔧</span>
        <h3 className="text-base font-bold text-blue-800 dark:text-blue-300">Hướng dẫn kiểm tra tool</h3>
      </div>
      <p className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-wrap leading-relaxed mb-4">
        {toolGuidance.guideline}
      </p>
      {toolGuidance.tools.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {toolGuidance.tools.map((tool, i) => (
            tool.url ? (
              <a
                key={i}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                🔗 {tool.name}
              </a>
            ) : (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold"
              >
                🔗 {tool.name}
              </span>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CS Validation Checkpoint ─────────────────────────────────────────────────
function ValidationCheckpoint({
  onConfirm,
}: {
  onConfirm: () => void
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">✅</span>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Xác nhận kết quả tool</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Sau khi kiểm tra trên tool, nhấn để tạo Internal Note và Template phản hồi.
      </p>
      <button
        onClick={onConfirm}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors shadow-sm"
      >
        ✓ Tạo kết quả
      </button>
    </div>
  )
}

// ─── Final Output Panel ────────────────────────────────────────────────────────
function OutputPanel({
  internalNoteText,
  customerReply,
  replyToneNote,
}: {
  internalNoteText: string
  customerReply: string
  replyToneNote: string
}) {
  return (
    <div className="space-y-4">

      <SectionCard
        icon="📝"
        title="Internal Note"
        sub="copy vào Freshdesk"
        copyText={internalNoteText}
        copyLabel="note"
      >
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
          {internalNoteText}
        </div>
      </SectionCard>

      <SectionCard
        icon="💬"
        title="Template phản hồi KH"
        sub={replyToneNote || undefined}
        copyText={customerReply}
        copyLabel="template"
      >
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
          {customerReply}
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Result Panel (full flow) ──────────────────────────────────────────────────
function ResultPanel({ result, isLowConfidence, error }: {
  result: AnalysisResult; isLowConfidence: boolean; error: string | null
}) {
  const tone = TONE_MAP[result.customerTone] || TONE_MAP.normal
  const urgencyClass = URGENCY_COLOR[result.urgency] || 'bg-gray-100 text-gray-700'

  const [showOutput, setShowOutput] = useState(false)

  const hasToolGuidance = !!(result.toolGuidance?.guideline)

  const handleConfirm = useCallback(() => {
    setShowOutput(true)
  }, [])

  return (
    <div className="space-y-4">
      {isLowConfidence && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
          <strong>Độ tin cậy thấp</strong> — {error}. Kết quả chỉ mang tính tham khảo.
        </div>
      )}

      {/* Meta row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Domain', value: result.domain, cls: 'text-gray-900 dark:text-white font-bold text-sm' },
          { label: 'Mức độ', value: null, badge: <span className={`text-xs font-bold px-2 py-1 rounded-full ${urgencyClass}`}>{result.urgency}</span> },
          { label: 'Tone KH', value: null, badge: <span className={`font-bold text-sm ${tone.color}`}>{tone.label}</span> },
          { label: 'Độ tin cậy', value: null, badge: <span className={`font-bold text-sm ${confidenceColor(result.confidence)}`}>{result.confidence}/100</span> },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{item.label}</p>
            {item.value ? <p className={item.cls}>{item.value}</p> : item.badge}
          </div>
        ))}
      </div>

      {/* Section 1 — AI Assessment */}
      <SectionCard icon="🤖" title="AI nhận định về case">
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400 font-medium">Tóm tắt: </span>
            <span className="text-gray-800 dark:text-gray-200">{result.caseSummary}</span>
          </div>
          {result.errorCodes?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Mã lỗi:</span>
              {result.errorCodes.map((code, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded font-mono text-xs font-semibold border border-red-200 dark:border-red-800">
                  {code}
                </span>
              ))}
            </div>
          )}
          <div>
            <span className="text-gray-500 dark:text-gray-400 font-medium">Hướng xử lý:</span>
            <div className="mt-1 space-y-1">
              {(Array.isArray(result.processingDirection) ? result.processingDirection : [result.processingDirection]).map((step: string, i: number) => (
                <div key={i} className="flex gap-2 text-gray-800 dark:text-gray-200">
                  <span className="text-purple-500 font-bold mt-0.5 shrink-0">→</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
          {result.sourceKnowledge?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">SOP tham chiếu:</p>
              <div className="space-y-1.5">
                {result.sourceKnowledge.map((src, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="text-purple-500 font-bold flex-shrink-0">#{i + 1}</span>
                    <span className="flex-1">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{src.sopTitle}</span>
                      <span className="mx-1">·</span>{src.relevance}
                    </span>
                    {src.link && (
                      <a
                        href={src.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 font-medium transition-colors"
                      >
                        📋 Xem SOP
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Section 2 — Tool Check Guidance */}
      {hasToolGuidance && result.toolGuidance && (
        <ToolCheckBox toolGuidance={result.toolGuidance} />
      )}

      {/* Section 3 — Validation Checkpoint */}
      {hasToolGuidance && !showOutput && (
        <ValidationCheckpoint onConfirm={handleConfirm} />
      )}

      {/* No tool guidance: show generate button directly */}
      {!hasToolGuidance && !showOutput && (
        <div className="flex justify-start">
          <button
            onClick={() => setShowOutput(true)}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm shadow-sm transition-colors"
          >
            Tạo Internal Note & Reply
          </button>
        </div>
      )}

      {/* Final Output */}
      {showOutput && (
        <OutputPanel
          internalNoteText={result.internalNote?.fullText || ''}
          customerReply={result.customerReply}
          replyToneNote={result.replyToneNote}
        />
      )}
    </div>
  )
}

// ─── Main AgentView ────────────────────────────────────────────────────────────
export function AgentView({ darkMode }: { darkMode: boolean }) {
  const [ticketContent, setTicketContent] = useState('')
  const { loading, result, error, errorCode, isLowConfidence, analyze, reset } = useAnalyze()

  const handleAnalyze = useCallback(() => {
    analyze({ mode: 'fd', ticketContent })
  }, [ticketContent, analyze])

  const handleReset = useCallback(() => {
    reset()
    setTicketContent('')
  }, [reset])

  const canAnalyze = !loading && ticketContent.trim().length > 10

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Dán nội dung ticket FD
          </label>
          <textarea
            value={ticketContent}
            onChange={e => setTicketContent(e.target.value)}
            placeholder={FD_PLACEHOLDER}
            rows={9}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:border-purple-500 transition-colors placeholder-gray-400 text-sm resize-none"
          />
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md ${
              !canAnalyze
                ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 hover:scale-105'
            }`}
          >
            {loading ? 'Đang phân tích...' : 'Phân tích'}
          </button>
          {(result || error) && !loading && (
            <button
              onClick={handleReset}
              className="px-5 py-3 rounded-xl font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Phân tích mới
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
          <div className="space-y-3 animate-pulse">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded mt-4" />
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
            Đang trích xuất context, tìm SOP, tổng hợp kết quả...
          </p>
        </div>
      )}

      {!loading && error && !result && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <span className="text-2xl">!</span>
            <div>
              <p className="font-bold text-red-700 dark:text-red-400">{error}</p>
              {errorCode === 'NOT_FOUND' && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Thử mô tả lại vấn đề, kiểm tra domain filter, hoặc liên hệ QC team.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && result && (
        <ResultPanel
          result={result as AnalysisResult}
          isLowConfidence={isLowConfidence}
          error={error}
        />
      )}
    </div>
  )
}
