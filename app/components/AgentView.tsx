'use client'

import React, { useState, useCallback } from 'react'
import { useAnalyze } from '../hooks/useAnalyze'
import type { AnalyzeMode } from '../types/agent'

// ── Constants ─────────────────────────────────────────────────────────────────

const FD_PLACEHOLDER = `Dán toàn bộ nội dung ticket FD vào đây. Ví dụ:

Ticket ID: #12345
Tiêu đề: Không rút được tiền về ngân hàng
Khách hàng: Nguyễn Văn A - 0901234567
Nội dung: Tôi muốn rút tiền từ ví ZaloPay về tài khoản Vietcombank nhưng bị báo lỗi "Giao dịch không thành công". Số tiền: 2,000,000 VNĐ. Thời gian: 10/06/2026 09:30. Mã GD: TXN2026XXXX
Trạng thái: Open`

const FREE_ISSUE_PLACEHOLDER = `Mô tả vấn đề của khách hàng. Ví dụ:
"Khách hàng báo không nhận được tiền hoàn sau khi hủy đơn hàng, đã 3 ngày chưa thấy tiền về ví."`

const FREE_TRIED_PLACEHOLDER = `Những gì đã thử hoặc đã làm. Ví dụ:
"Đã hướng dẫn khách kiểm tra lịch sử GD, đã gửi ticket cho CS2 nhưng chưa có phản hồi."`

const URGENCY_COLOR: Record<string, string> = {
  'Cao': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Trung bình': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Thấp': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const CONFIDENCE_COLOR = (score: number) => {
  if (score >= 85) return 'text-green-600 dark:text-green-400'
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
    >
      {copied ? '✅ Đã copy' : '📋 Copy'}
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

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

  const canAnalyze = mode === 'fd' ? ticketContent.trim().length > 10 : issueDescription.trim().length > 5

  return (
    <div className="space-y-6">
      {/* ── Input Panel ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-1">Chế độ:</span>
          <button
            onClick={() => { setMode('fd'); reset() }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'fd'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            📋 FD Ticket
          </button>
          <button
            onClick={() => { setMode('free'); reset() }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'free'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            ✏️ Tùy chọn
          </button>
        </div>

        {/* FD Mode */}
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

        {/* Free Mode */}
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
                Đã thử / đã làm gì <span className="text-gray-400 font-normal">(tùy chọn)</span>
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

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleAnalyze}
            disabled={loading || !canAnalyze}
            className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md ${
              loading || !canAnalyze
                ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 hover:scale-105'
            }`}
          >
            {loading ? '🔄 Đang phân tích...' : '🔍 Phân tích'}
          </button>

          {(result || error) && (
            <button
              onClick={handleReset}
              className="px-5 py-3 rounded-xl font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              🔁 Phân tích mới
            </button>
          )}
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded mt-4" />
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            🤖 Đang trích xuất context → tìm SOP → phân tích...
          </p>
        </div>
      )}

      {/* ── Error (non-recoverable) ──────────────────────────────────────── */}
      {!loading && error && !result && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-red-700 dark:text-red-400">{error}</p>
              {errorCode === 'NOT_FOUND' && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Không tìm thấy SOP phù hợp. Vui lòng liên hệ QC team hoặc tra cứu thủ công tại SOPie Index.
                </p>
              )}
              {errorCode === 'EXTRACTION_ERROR' && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Không thể đọc nội dung ticket. Vui lòng cung cấp thêm thông tin mô tả vấn đề.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Result Panel ────────────────────────────────────────────────── */}
      {!loading && result && (
        <div className="space-y-4">
          {/* Low confidence warning */}
          {isLowConfidence && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
              ⚠️ <strong>Độ tin cậy thấp</strong> — {error}. Kết quả chỉ mang tính tham khảo, vui lòng xác minh với QC team.
            </div>
          )}

          {/* Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Domain</p>
              <p className="font-bold text-gray-900 dark:text-white text-sm">{result.domain}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mức độ</p>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${URGENCY_COLOR[result.urgency] || URGENCY_COLOR['Thấp']}`}>
                {result.urgency}
              </span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Leo thang</p>
              <p className="font-bold text-sm">
                {result.recommendation?.escalate
                  ? <span className="text-orange-600 dark:text-orange-400">⬆️ {result.recommendation.escalateTo || 'Cần leo thang'}</span>
                  : <span className="text-green-600 dark:text-green-400">✅ Không cần</span>
                }
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Độ tin cậy</p>
              <p className={`font-bold text-sm ${CONFIDENCE_COLOR(result.confidence)}`}>
                {result.confidence}/100
              </p>
            </div>
          </div>

          {/* Context Analysis */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">📋 Phân tích ticket</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400 font-medium">Tóm tắt: </span>
                <span className="text-gray-800 dark:text-gray-200">{result.ticketSummary}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 font-medium">Nguyên nhân: </span>
                <span className="text-gray-800 dark:text-gray-200">{result.rootCause}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 font-medium">KH muốn: </span>
                <span className="text-gray-800 dark:text-gray-200">{result.customerIntent}</span>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          {result.recommendation && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">🎯 Khuyến nghị xử lý</h3>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-3">
                {result.recommendation.primaryAction}
              </p>
              {result.recommendation.steps?.length > 0 && (
                <ol className="space-y-2">
                  {result.recommendation.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Customer Reply */}
          {result.customerReply && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">💬 Phản hồi khách hàng</h3>
                <CopyButton text={result.customerReply} />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                {result.customerReply}
              </p>
            </div>
          )}

          {/* Internal Note */}
          {result.internalNote && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">🔒 Ghi chú nội bộ</h3>
                <CopyButton text={result.internalNote} />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                {result.internalNote}
              </p>
            </div>
          )}

          {/* Source Knowledge */}
          {result.sourceKnowledge?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">📚 SOP tham chiếu</h3>
              <div className="space-y-2">
                {result.sourceKnowledge.map((src, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <span className="text-purple-500 font-bold flex-shrink-0">#{i + 1}</span>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{src.sopTitle}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{src.domain} · {src.relevance}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
