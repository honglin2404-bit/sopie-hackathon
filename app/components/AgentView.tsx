'use client'

import React, { useState, useCallback } from 'react'
import { useAnalyze } from '../hooks/useAnalyze'
import type { AnalyzeMode, AnalysisResult } from '../types/agent'

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

const URGENCY_COLOR: Record<string, string> = {
  'Cao': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Trung binh': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Thap': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Thấp': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Trung bình': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

const TONE_MAP: Record<string, { label: string; color: string }> = {
  angry:   { label: 'Bức xúc', color: 'text-red-600 dark:text-red-400' },
  neutral: { label: 'Trung tính', color: 'text-yellow-600 dark:text-yellow-400' },
  normal:  { label: 'Bình thường', color: 'text-green-600 dark:text-green-400' },
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

function ResultPanel({ result, isLowConfidence, error }: {
  result: AnalysisResult; isLowConfidence: boolean; error: string | null
}) {
  const tone = TONE_MAP[result.customerTone] || TONE_MAP.normal
  const urgencyClass = URGENCY_COLOR[result.urgency] || 'bg-gray-100 text-gray-700'

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

      {/* Section 1 -- AI Assessment */}
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
            <span className="text-gray-500 dark:text-gray-400 font-medium">Hướng xử lý: </span>
            <span className="text-gray-800 dark:text-gray-200">{result.processingDirection}</span>
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

      {/* Section 2 -- Internal Note */}
      <SectionCard
        icon="📝"
        title="Internal Note"
        sub="copy vào Freshdesk"
        copyText={result.internalNote?.fullText}
        copyLabel="note"
      >
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
          {result.internalNote?.fullText}
        </div>
      </SectionCard>

      {/* Section 3 -- Customer Reply */}
      <SectionCard
        icon="💬"
        title="Template phản hồi KH"
        sub={tone.label}
        copyText={result.customerReply}
        copyLabel="template"
      >
        {result.replyToneNote && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic">{result.replyToneNote}</p>
        )}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
          {result.customerReply}
        </div>
      </SectionCard>
    </div>
  )
}

export function AgentView({ darkMode }: { darkMode: boolean }) {
  const [mode, setMode] = useState<AnalyzeMode>('fd')
  const [ticketContent, setTicketContent] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [attemptedSolutions, setAttemptedSolutions] = useState('')
  const { loading, result, error, errorCode, isLowConfidence, analyze, reset } = useAnalyze()

  const handleAnalyze = useCallback(() => {
    if (mode === 'fd') {
      analyze({ mode: 'fd', ticketContent })
    } else {
      analyze({ mode: 'free', issueDescription, attemptedSolutions })
    }
  }, [mode, ticketContent, issueDescription, attemptedSolutions, analyze])

  const handleReset = useCallback(() => {
    reset()
    setTicketContent('')
    setIssueDescription('')
    setAttemptedSolutions('')
  }, [reset])

  const canAnalyze = !loading && (
    mode === 'fd' ? ticketContent.trim().length > 10 : issueDescription.trim().length > 5
  )

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-1">Chế độ:</span>
          {(['fd', 'free'] as AnalyzeMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); reset() }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {m === 'fd' ? 'FD Ticket' : 'Tuy chon'}
            </button>
          ))}
        </div>

        {mode === 'fd' && (
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
        )}

        {mode === 'free' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mô tả vấn đề của khách hàng <span className="text-red-500">*</span>
              </label>
              <textarea
                value={issueDescription}
                onChange={e => setIssueDescription(e.target.value)}
                placeholder={FREE_ISSUE_PLACEHOLDER}
                rows={5}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:border-purple-500 transition-colors placeholder-gray-400 text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Đã thử / đã làm gì <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
              </label>
              <textarea
                value={attemptedSolutions}
                onChange={e => setAttemptedSolutions(e.target.value)}
                placeholder={FREE_TRIED_PLACEHOLDER}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:border-purple-500 transition-colors placeholder-gray-400 text-sm resize-none"
              />
            </div>
          </div>
        )}

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
