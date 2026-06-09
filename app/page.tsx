'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

import { NotificationSystem } from './components/NotificationSystem'
import { SopCard } from './components/SopCard'
import { SopDetailModal } from './components/SopDetailModal'
import { QuickLinks } from './components/QuickLinks'
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { SearchHistory } from './components/SearchHistory'
import { AgentView } from './components/AgentView'
import { useSearch } from './hooks/useSearch'
import type { SOP, SearchHistoryItem } from './types/sop'

type ActiveTab = 'agent' | 'search'

export default function Home() {
  const [darkMode, setDarkMode] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('agent')
  const [selectedSop, setSelectedSop] = useState<SOP | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    query, setQuery,
    domain, setDomain,
    searchType, setSearchType,
    loading, error,
    hasSearched, backendSuggestion,
    activeHxlTabs,
    activeSuggestionTab, setActiveSuggestionTab,
    searchHistory,
    hasHighConfidence,
    top5Results,
    moreSuggestions,
    suggestionDomains,
    filteredSuggestions,
    handleSearch,
    handleTabChange,
    clearHistory,
  } = useSearch()

  // Dark mode — persist to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sopie_dark_mode') === 'true'
    setDarkMode(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('sopie_dark_mode', darkMode.toString())
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const handleCloseModal = useCallback(() => setSelectedSop(null), [])

  const handleHistorySelect = useCallback(
    (item: SearchHistoryItem) => {
      setQuery(item.query)
      setSearchType(item.searchType)
      setShowHistory(false)
      // Timeout nhỏ để state setQuery kịp flush trước khi search
      setTimeout(() => handleSearch(item.query), 0)
    },
    [setQuery, setSearchType, handleSearch],
  )

  const visibleCount = top5Results.length + moreSuggestions.length

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-300 ${
        darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <NotificationSystem />

      {/* ============================================================ */}
      {/* HEADER                                                        */}
      {/* ============================================================ */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 py-6 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            {/* Brand */}
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                FAQ Search Tool
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">powered by SOPie</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* [Enhancement #10] aria-label cho icon button */}
              <button
                onClick={() => setDarkMode(d => !d)}
                className={`flex items-center justify-center p-3 rounded-xl shadow-md transition-all duration-300 hover:scale-110 ${
                  darkMode ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800 text-yellow-400'
                }`}
                aria-label={darkMode ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
              >
                <span className="text-xl" aria-hidden="true">
                  {darkMode ? '☀️' : '🌙'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('agent')}
                aria-pressed={activeTab === 'agent'}
                className={`py-3 px-6 rounded-xl font-bold transition-all shadow-md ${
                  activeTab === 'agent'
                    ? 'text-white bg-purple-600 hover:scale-105'
                    : 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                🤖 SOPie Agent
              </button>

              <button
                onClick={() => { setActiveTab('search'); setSearchType('keyword') }}
                aria-pressed={activeTab === 'search'}
                className={`py-3 px-6 rounded-xl font-bold transition-all shadow-md ${
                  activeTab === 'search'
                    ? 'text-white bg-green-500 hover:scale-105'
                    : 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                🔑 Key Search
              </button>
            </div>
          </div>

          <QuickLinks />
        </div>
      </header>

      {/* ============================================================ */}
      {/* MAIN CONTENT                                                  */}
      {/* ============================================================ */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* SOPie Agent Tab */}
        {activeTab === 'agent' && <AgentView darkMode={darkMode} />}

        {/* Key Search Tab */}
        {activeTab === 'search' && (<>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 transition-colors duration-300 border border-gray-100 dark:border-gray-700">
          {/* Search inputs */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <select
              value={domain}
              onChange={e => setDomain(e.target.value)}
              aria-label="Lọc theo domain"
              className="px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white md:min-w-[200px] font-medium focus:border-blue-500 focus:outline-none transition-colors"
            >
              <option value="all">Tất cả</option>
              <option value="Account (AC)">Tài khoản</option>
              <option value="Payment (PY)">Thanh toán</option>
              <option value="Application (AP)">Ứng dụng</option>
              <option value="Lending (LD)">DVTC</option>
              <option value="Promotion (PM)">Khuyến mãi</option>
              <option value="Travel (TV)">OTA</option>
              <option value="Merchant (MC)">Đối tác</option>
              <option value="General (GE)">Thông tin chung</option>
            </select>

            {/* Search input + history dropdown */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  searchType === 'ai' ? 'Nhập câu hỏi của bạn...' : 'Nhập từ khóa ngắn gọn...'
                }
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                aria-label="Nhập từ khóa tìm kiếm"
                aria-autocomplete="list"
                aria-controls="search-history-list"
                className="w-full px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400"
              />

              {/* [Enhancement #8] Search history dropdown */}
              {showHistory && !query && searchHistory.length > 0 && (
                <div id="search-history-list">
                  <SearchHistory
                    history={searchHistory}
                    onSelect={handleHistorySelect}
                    onClear={clearHistory}
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => handleSearch()}
              disabled={loading}
              aria-busy={loading}
              className={
                loading
                  ? 'px-8 py-4 rounded-xl font-bold text-white bg-gray-400 cursor-not-allowed'
                  : searchType === 'ai'
                    ? 'px-8 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md'
                    : 'px-8 py-4 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 shadow-md'
              }
            >
              {loading ? '🔄 Đang tìm...' : '🔍 Tìm kiếm'}
            </button>
          </div>

          {searchType === 'keyword' && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              💡 Mẹo: Key Search hoạt động tốt nhất với từ khóa ngắn gọn (1-5 từ). Dùng AI Search
              cho câu hỏi dài.
            </p>
          )}

          {/* Box vàng — không tìm thấy kết quả đủ tin cậy */}
          {hasSearched && !loading && !hasHighConfidence && (
            <div className="mt-6 p-6 bg-amber-50 dark:bg-amber-900/20 border-l-8 border-amber-500 rounded-xl text-amber-900 dark:text-amber-200 transition-all">
              <div className="flex items-start gap-4">
                <div className="text-2xl mt-1" aria-hidden="true">
                  💡
                </div>
                <div className="space-y-3 w-full">
                  <p className="font-bold text-base">Chưa tìm thấy kết quả phù hợp, CS vui lòng:</p>
                  <ul className="list-disc list-inside text-sm space-y-2 font-medium opacity-90">
                    <li>Thay đổi cách mô tả vấn đề và thử lại</li>
                    <li>Kiểm tra lại bộ lọc domain kiến thức</li>
                  </ul>
                  <div className="mt-3 pl-1">
                    <a
                      href={
                        backendSuggestion?.link ||
                        'https://sites.google.com/view/cs-faq-chung/quy-%C4%91%E1%BB%8Bnh-chung'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold rounded-lg shadow-sm hover:scale-105 transition-all"
                    >
                      🔗 {backendSuggestion?.link_label || 'Tra cứu thủ công tại SOPie Index'}
                    </a>
                  </div>
                  <p className="text-sm font-bold pt-2 border-t border-amber-200 dark:border-amber-800/50 mt-2">
                    Hoặc CS có thể liên hệ QC team để được hỗ trợ nhanh chóng.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-lg transition-colors"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <div className="text-xl" aria-hidden="true">⚠️</div>
                <div>
                  <strong>{error}</strong>
                  {error.includes('Không tìm thấy') && (
                    <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                      <li>Thử mô tả chi tiết hơn vấn đề</li>
                      <li>Kiểm tra lại domain filter</li>
                      <li>Liên hệ QC để được hỗ trợ nhanh chóng</li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* [Enhancement #7] LOADING SKELETON                            */}
        {/* ============================================================ */}
        {loading && <LoadingSkeleton />}

        {/* ============================================================ */}
        {/* RESULTS                                                       */}
        {/* ============================================================ */}
        {!loading && visibleCount > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Tìm thấy {visibleCount} kết quả
              </h2>
              <span className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium border border-gray-200 dark:border-gray-700">
                {searchType === 'ai' ? '🤖 AI Search' : '🔑 Key Search'}
              </span>
            </div>

            {/* Top results */}
            {top5Results.length > 0 && (
              <section className="mb-12" aria-label="Top kết quả hàng đầu">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-yellow-400 inline-block pr-8">
                  🏆 Top {top5Results.length} Kết quả hàng đầu
                </h3>
                <div className="space-y-4">
                  {top5Results.map(r => (
                    <SopCard key={r.id} r={r} isTopMatch onClick={setSelectedSop} />
                  ))}
                </div>
              </section>
            )}

            {/* More suggestions */}
            {moreSuggestions.length > 0 && (
              <section aria-label="Gợi ý thêm">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-300 dark:border-gray-700 inline-block pr-8">
                  Gợi ý thêm ({moreSuggestions.length} SOPs)
                </h3>

                {/* Domain filter tabs */}
                <div
                  className="flex gap-2 mb-4 overflow-x-auto pb-2"
                  role="tablist"
                  aria-label="Lọc gợi ý theo domain"
                >
                  <button
                    role="tab"
                    aria-selected={activeSuggestionTab === 'All'}
                    onClick={() => setActiveSuggestionTab('All')}
                    className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                      activeSuggestionTab === 'All'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Tất cả ({moreSuggestions.length})
                  </button>
                  {suggestionDomains.map(d => (
                    <button
                      key={d}
                      role="tab"
                      aria-selected={activeSuggestionTab === d}
                      onClick={() => setActiveSuggestionTab(d)}
                      className={`px-4 py-2 font-semibold rounded-lg whitespace-nowrap transition-colors ${
                        activeSuggestionTab === d
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {d} ({moreSuggestions.filter(r => r.domain === d).length})
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {filteredSuggestions.map(r => (
                    <SopCard key={r.id} r={r} isTopMatch={false} onClick={setSelectedSop} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        </>)}

      </main>

      {/* ============================================================ */}
      {/* SOP DETAIL MODAL                                             */}
      {/* ============================================================ */}
      <SopDetailModal
        r={selectedSop}
        onClose={handleCloseModal}
        activeHxlLevel={selectedSop ? (activeHxlTabs[selectedSop.id] ?? 'cs1') : 'cs1'}
        onTabChange={handleTabChange}
      />
    </div>
  )
}
