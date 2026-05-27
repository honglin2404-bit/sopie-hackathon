'use client'

import type { SearchHistoryItem } from '../types/sop'

interface SearchHistoryProps {
  history: SearchHistoryItem[]
  onSelect: (item: SearchHistoryItem) => void
  onClear: () => void
}

// [Enhancement #8] Recent search history — hiện khi focus vào input rỗng
export function SearchHistory({ history, onSelect, onClear }: SearchHistoryProps) {
  if (history.length === 0) return null

  return (
    <div
      className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
      role="listbox"
      aria-label="Lịch sử tìm kiếm"
    >
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Tìm kiếm gần đây
        </span>
        <button
          onClick={onClear}
          className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
          aria-label="Xóa toàn bộ lịch sử tìm kiếm"
        >
          Xóa tất cả
        </button>
      </div>

      {history.map((item, index) => (
        <button
          key={index}
          role="option"
          aria-selected={false}
          onClick={() => onSelect(item)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-gray-400 text-sm" aria-hidden="true">
            🕐
          </span>
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">
            {item.query}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              item.searchType === 'ai'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300'
            }`}
          >
            {item.searchType === 'ai' ? '🤖 AI' : '🔑 Key'}
          </span>
        </button>
      ))}
    </div>
  )
}
