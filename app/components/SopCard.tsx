import React from 'react'
import type { SOP } from '../types/sop'

function formatDate(dateString: string): string {
  try {
    const parts = dateString.split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  } catch {}
  return dateString
}

interface SopCardProps {
  r: SOP
  isTopMatch?: boolean
  onClick: (r: SOP) => void
}

export const SopCard = React.memo(({ r, isTopMatch = false, onClick }: SopCardProps) => (
  <div
    className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg p-6 transition-all cursor-pointer border-l-4 ${
      isTopMatch ? 'border-yellow-500' : 'border-blue-600'
    } duration-200`}
    onClick={() => onClick(r)}
    // [Enhancement #10] Keyboard + accessibility
    role="button"
    tabIndex={0}
    onKeyDown={e => e.key === 'Enter' && onClick(r)}
    aria-label={`Xem chi tiết SOP: ${r.title}`}
  >
    <div className="flex justify-between items-start mb-3">
      <h3
        className={`font-bold text-gray-900 dark:text-white flex-1 pr-4 ${
          isTopMatch ? 'text-xl' : 'text-lg'
        }`}
      >
        {isTopMatch && '⭐ '}
        {r.title}
      </h3>
      <span
        className={`px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${
          isTopMatch
            ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300'
            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
        }`}
      >
        {r.domain}
      </span>
    </div>

    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
      {r.cause
        ? `Nguyên nhân: ${r.cause}`
        : r.solution?.level1
          ? r.solution.level1
          : 'Nhấp để xem chi tiết...'}
    </p>

    <div className="flex justify-between items-center text-sm">
      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
        Cập nhật: {r.last_updated ? formatDate(r.last_updated) : 'N/A'}
      </span>
      <span
        className={`font-semibold ${
          isTopMatch
            ? 'text-yellow-700 dark:text-yellow-400'
            : 'text-blue-600 dark:text-blue-400'
        }`}
      >
        ⚡ {Math.round(r.relevance_score * 100)}% Match
      </span>
    </div>
  </div>
))
SopCard.displayName = 'SopCard'
