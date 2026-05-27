'use client'

import React, { useState } from 'react'
import type { SOP, HxlLevel } from '../types/sop'

const CS_WRITE_LAB = 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab'

// ----------------------------------------------------------------
// CopyButton
// ----------------------------------------------------------------
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`ml-2 px-2 py-1 text-xs font-bold rounded border transition-all ${
        copied
          ? 'bg-green-500 text-white border-green-500'
          : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-300 hover:bg-gray-100'
      }`}
      aria-label={copied ? 'Đã sao chép' : 'Sao chép nội dung'}
    >
      {copied ? '✅ Đã chép' : '📋 Sao chép'}
    </button>
  )
}

// ----------------------------------------------------------------
// SopDetailModal
// ----------------------------------------------------------------
interface SopDetailModalProps {
  r: SOP | null
  onClose: () => void
  activeHxlLevel: HxlLevel
  onTabChange: (id: string, level: HxlLevel) => void
}

export const SopDetailModal = React.memo(
  ({ r, onClose, activeHxlLevel, onTabChange }: SopDetailModalProps) => {
    if (!r) return null

    return (
      // [Enhancement #10] role="dialog" + aria-modal cho screen reader
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative transition-colors border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            aria-label="Đóng"
          >
            ✕
          </button>

          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 pr-4">
              <h3
                id="modal-title"
                className="text-2xl font-bold text-gray-900 dark:text-white"
              >
                {r.title}
              </h3>
              <span className="text-xs text-gray-400 font-mono mt-1 block">ID: {r.id}</span>
            </div>
            <span className="px-4 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold whitespace-nowrap">
              {r.domain}
            </span>
          </div>

          {/* Nguyên nhân */}
          {r.cause && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-l-4 border-red-500">
              <strong className="text-red-700 dark:text-red-400 block mb-2">
                ⚠️ Nguyên nhân:
              </strong>
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {r.cause}
              </p>
            </div>
          )}

          {/* Check tools */}
          {r.check_tools?.guideline && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-l-4 border-blue-500">
              <strong className="text-blue-700 dark:text-blue-400 block mb-2">
                🔧 Hướng dẫn kiểm tra tool:
              </strong>
              <p className="text-gray-800 dark:text-gray-200 mb-3 whitespace-pre-wrap break-words leading-relaxed">
                {r.check_tools.guideline}
              </p>
              {r.check_tools.name && r.check_tools.url && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {r.check_tools.name
                    .split(',')
                    .map(n => n.trim())
                    .filter(Boolean)
                    .map((name, index) => {
                      const urls = r.check_tools!.url!.split(',').map(u => u.trim())
                      const url = urls[index] ?? urls[0]
                      return (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-lg text-sm font-medium transition-colors border border-blue-200 dark:border-blue-700"
                        >
                          🔗 {name}
                        </a>
                      )
                    })}
                </div>
              )}
            </div>
          )}

          {/* Solution tabs */}
          {(r.solution?.level1 || r.solution?.level2) && (
            <div className="mb-4">
              <strong className="text-green-700 dark:text-green-400 block mb-3 text-base">
                ✅ Hướng xử lý:
              </strong>
              {/* [Enhancement #10] role="tablist" */}
              <div
                className="flex gap-2 mb-3 border-b border-gray-200 dark:border-gray-700"
                role="tablist"
              >
                <button
                  role="tab"
                  aria-selected={activeHxlLevel === 'cs1'}
                  onClick={() => onTabChange(r.id, 'cs1')}
                  className={
                    activeHxlLevel === 'cs1'
                      ? 'px-4 py-2 font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600'
                      : 'px-4 py-2 font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                >
                  HXL CS1
                </button>
                {r.solution?.level2 && (
                  <button
                    role="tab"
                    aria-selected={activeHxlLevel === 'cs2'}
                    onClick={() => onTabChange(r.id, 'cs2')}
                    className={
                      activeHxlLevel === 'cs2'
                        ? 'px-4 py-2 font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600'
                        : 'px-4 py-2 font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }
                  >
                    HXL CS2
                  </button>
                )}
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-l-4 border-green-500">
                {activeHxlLevel === 'cs1' && r.solution?.level1 && (
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                    {r.solution.level1}
                  </p>
                )}
                {activeHxlLevel === 'cs2' && r.solution?.level2 && (
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                    {r.solution.level2}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {r.notes && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-l-4 border-yellow-500">
              <strong className="text-yellow-700 dark:text-yellow-400 block mb-2">
                📝 Lưu ý:
              </strong>
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                {r.notes}
              </p>
            </div>
          )}

          {/* Templates */}
          <div className="mb-4">
            {activeHxlLevel === 'cs1' && (r.templates?.email || r.templates?.chat) && (
              <>
                <strong className="text-gray-700 dark:text-gray-300 block mb-3 text-base font-bold">
                  Gợi ý phản hồi dành cho CS1:
                </strong>

                {r.templates?.email && (
                  <details className="mb-3 group">
                    <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg list-none flex justify-between items-center transition-all">
                      <span>📧 Template App/Mail</span>
                      <span className="transition-transform group-open:rotate-180">▼</span>
                    </summary>
                    <div className="mt-2 p-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">
                      {r.templates.email}
                      <div className="mt-3 flex justify-end">
                        <CopyButton text={r.templates.email} />
                      </div>
                    </div>
                  </details>
                )}

                {r.templates?.chat && (
                  <details className="mb-3 group">
                    <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg list-none flex justify-between items-center transition-all">
                      <span>💬 Template Call/Chat</span>
                      <span className="transition-transform group-open:rotate-180">▼</span>
                    </summary>
                    <div className="mt-2 p-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">
                      {r.templates.chat}
                      <div className="mt-3 flex justify-end">
                        <CopyButton text={r.templates.chat} />
                      </div>
                    </div>
                  </details>
                )}
              </>
            )}

            {activeHxlLevel === 'cs2' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border-l-4 border-blue-500">
                <strong className="text-blue-700 dark:text-blue-400 block mb-2">
                  💡 Gợi ý sau khi có kết quả BPLQ:
                </strong>
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed mb-3">
                  Sau khi có kết quả từ BPLQ, CS có thể soạn thảo nhanh văn bản phản hồi với:
                </p>
                <a
                  href={CS_WRITE_LAB}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-sm transition-all"
                >
                  CSWriteLab ✍️
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
            {r.link ? (
              <a
                href={r.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow transition-all"
              >
                📄 Xem SOP gốc
              </a>
            ) : (
              <div />
            )}
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
              Relevance: {Math.round(r.relevance_score * 100)}%
            </span>
          </div>
        </div>
      </div>
    )
  },
)
SopDetailModal.displayName = 'SopDetailModal'
