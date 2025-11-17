'use client'

import { useState, useMemo } from 'react'

export default function Home() {
  // --- THÊM DÒNG NÀY ĐỂ DEBUG BUILD MỚI ---
  console.log("VERCEL BUILD MỚI NHẤT ĐÃ CHẠY!");
  // ------------------------------------------

  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('all')
  const [searchType, setSearchType] = useState('ai')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [activeHxlTabs, setActiveHxlTabs] = useState<{[key: string]: 'cs1' | 'cs2'}>({})
  const [selectedSop, setSelectedSop] = useState<any | null>(null)

  // State để quản lý tab nào đang active trong phần "Gợi ý thêm"
  const [activeSuggestionTab, setActiveSuggestionTab] = useState('All')

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Vui lòng nhập câu hỏi')
      return
    }

    if (searchType === 'keyword' && query.trim().split(' ').length > 5) {
      setError('Bạn đang ở chế độ tra cứu bằng từ khóa. Xin vui lòng nhập từ khóa hoặc bật chế độ tra cứu AI')
      return
    }

    setLoading(true)
    setError('')
    setResults([])
    setSelectedSop(null) 
    setActiveSuggestionTab('All') 

    // --- SỬA LỖI DEPLOY ---
    // 1. Lấy URL backend từ biến môi trường
    // 2. Nếu không có (chạy local), thì dùng localhost:5000
    // const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    
    // THAY THẾ BẰNG LOGIC MỚI (theo yêu cầu của bạn):
    // Kiểm tra URL trình duyệt để quyết định backend
    const backendUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : 'https://sopie-search-tool.onrender.com';
    
    // 2.1: THÊM DÒNG LOG ĐỂ KIỂM TRA
    console.log("Đang gọi backend tại:", backendUrl);
    // ----------------------------

    try {
      // 3. Sử dụng biến backendUrl
      const response = await fetch(`${backendUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          domain: domain === 'all' ? null : domain,
          type: searchType === 'ai' ? 'semantic' : 'keyword',
          limit: 25 
        }),
      })

      const data = await response.json()
      if (data.success) {
        if (data.results.length === 0) {
          setError('Không tìm thấy SOP phù hợp. Vui lòng thử lại với từ khóa chi tiết hơn hoặc kiểm tra lại domain filter.')
        } else {
          setError('') 
        }
        
        setResults(data.results)
        
        const defaultTabs: {[key: string]: 'cs1' | 'cs2'} = {}
        data.results.forEach((r: any) => {
          defaultTabs[r.id] = 'cs1' 
        })
        setActiveHxlTabs(defaultTabs)
      } else {
        setError('Không tìm thấy kết quả')
      }
    } catch (err) {
      setError('Không thể kết nối backend. Vui lòng kiểm tra server.')
    } finally {
      setLoading(false)
    }
  }

  // Component Modal (Giữ nguyên, không đổi)
  const SopDetailModal = () => {
    if (!selectedSop) return null
    const r = selectedSop
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        onClick={() => setSelectedSop(null)}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => setSelectedSop(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* 1. Title */}
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-2xl font-bold text-gray-900 flex-1 pr-4">{r.title}</h3>
            <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold whitespace-nowrap">
              {r.domain}
            </span>
          </div>

          {/* 2. Nguyên nhân */}
          {r.cause && (
            <div className="mb-4 p-4 bg-red-50 rounded-xl border-l-4 border-red-500">
              <strong className="text-red-700 block mb-2">⚠️ Nguyên nhân:</strong>
              <p className="text-gray-800 leading-relaxed">{r.cause}</p>
            </div>
          )}
          
          {/* 3. Check Tool */}
          {r.check_tools && r.check_tools.guideline && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
              <strong className="text-blue-700 block mb-2">🔧 Check Tool:</strong>
              <p className="text-gray-800 mb-2">{r.check_tools.guideline}</p>
              {r.check_tools.name && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Tool: {r.check_tools.name}</span>
                  {r.check_tools.url && (
                    <a href={r.check_tools.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      🔗 Link
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. Hướng xử lý - WITH TABS */}
          {(r.solution?.level1 || r.solution?.level2) && (
            <div className="mb-4">
              <strong className="text-green-700 block mb-3 text-base">✅ Hướng xử lý:</strong>
              <div className="flex gap-2 mb-3 border-b border-gray-200">
                <button
                  onClick={() => setActiveHxlTabs({...activeHxlTabs, [r.id]: 'cs1'})}
                  className={activeHxlTabs[r.id] === 'cs1' ? 'px-4 py-2 font-semibold text-green-700 border-b-2 border-green-600' : 'px-4 py-2 font-medium text-gray-500 hover:text-gray-700'}
                >
                  HXL CS1
                </button>
                {r.solution?.level2 && (
                  <button
                    onClick={() => setActiveHxlTabs({...activeHxlTabs, [r.id]: 'cs2'})}
                    className={activeHxlTabs[r.id] === 'cs2' ? 'px-4 py-2 font-semibold text-green-700 border-b-2 border-green-600' : 'px-4 py-2 font-medium text-gray-500 hover:text-gray-700'}
                  >
                    HXL CS2
                  </button>
                )}
              </div>
              <div className="p-4 bg-green-50 rounded-xl border-l-4 border-green-500">
                {activeHxlTabs[r.id] === 'cs1' && r.solution?.level1 && (
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line">{r.solution.level1}</p>
                )}
                {activeHxlTabs[r.id] === 'cs2' && r.solution?.level2 && (
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line">{r.solution.level2}</p>
                )}
              </div>
            </div>
          )}

          {/* 5. Notes */}
          {r.notes && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-xl border-l-4 border-yellow-500">
              <strong className="text-yellow-700 block mb-2">📝 Lưu ý:</strong>
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">{r.notes}</p>
            </div>
          )}

          {/* 6. Templates */}
          {r.templates && r.templates.email && (
            <details className="mb-3">
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-blue-600 p-3 bg-gray-50 rounded-lg">
                📧 Template Email/App
              </summary>
              <div className="mt-2 p-4 bg-white border-2 border-gray-200 rounded-lg text-sm text-gray-800 whitespace-pre-line">
                {r.templates.email}
              </div>
            </details>
          )}
          {r.templates && r.templates.chat && (
            <details className="mb-3">
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-blue-600 p-3 bg-gray-50 rounded-lg">
                💬 Template Call/Chat
              </summary>
              <div className="mt-2 p-4 bg-white border-2 border-gray-200 rounded-lg text-sm text-gray-800 whitespace-pre-line">
                {r.templates.chat}
              </div>
            </details>
          )}

          {/* Footer (Link) */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
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
              <div></div>
            )}
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
              Relevance: {Math.round(r.relevance_score * 100)}%
            </span>
          </div>
        </div>
      </div>
    )
  }
  // ------------------------------------

  // --- TÍNH NĂNG MỚI (CHIA TÁCH KẾT QUẢ) ---
  const top5Results = results.slice(0, 5)
  const moreSuggestions = results.slice(5)

  // Tính toán các domain cho "Gợi ý thêm"
  const suggestionDomains = useMemo(() => {
    const domainCounts: {[key: string]: number} = {}
    moreSuggestions.forEach(r => {
      if (r.domain) {
        domainCounts[r.domain] = (domainCounts[r.domain] || 0) + 1
      }
    })
    // Sắp xếp domain theo số lượng giảm dần
    return Object.entries(domainCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([domain]) => domain)
  }, [moreSuggestions])

  // Lọc kết quả "Gợi ý thêm" dựa trên tab
  const filteredSuggestions = useMemo(() => {
    if (activeSuggestionTab === 'All') {
      return moreSuggestions
    }
    return moreSuggestions.filter(r => r.domain === activeSuggestionTab)
  }, [moreSuggestions, activeSuggestionTab])
  // ------------------------------------

  // Component Thẻ Tóm Tắt (dùng cho cả Top 5 và Gợi ý)
  const SopSummaryCard = ({ r, isTopMatch = false }: { r: any, isTopMatch?: boolean }) => (
    <div 
      className={`bg-white rounded-2xl shadow-md hover:shadow-lg p-6 transition-all cursor-pointer border-l-4 ${isTopMatch ? 'border-yellow-500' : 'border-blue-600'}`}
      onClick={() => setSelectedSop(r)} // Click để mở Modal
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className={`font-bold text-gray-900 flex-1 pr-4 ${isTopMatch ? 'text-xl' : 'text-lg'}`}>
          {isTopMatch && '⭐ '} {r.title}
        </h3>
        <span className={`px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${isTopMatch ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-700'}`}>
          {r.domain}
        </span>
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {/* Placeholder cho 'Highlighted Content Snippet' */}
        {r.cause ? `Nguyên nhân: ${r.cause}` : (r.solution?.level1 ? r.solution.level1 : "Nhấp để xem chi tiết...")}
      </p>

      <div className="flex justify-between items-center text-sm">
        <span className="text-xs text-gray-400 font-medium">
          Cập nhật: 17/11/2024
        </span>
        <span className={`font-semibold ${isTopMatch ? 'text-yellow-700' : 'text-blue-600'}`}>
          ⚡ {Math.round(r.relevance_score * 100)}% Match
        </span>
      </div>
    </div>
  )
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header (Giữ nguyên) */}
      <div className="bg-white border-b py-6">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">FAQ Search Tool</h1>
            <p className="text-sm text-gray-500">powered by SOPie</p>
          </div>
          <div className="flex gap-3">
            {searchType === 'ai' ? (
              <button onClick={() => setSearchType('ai')} className="py-3 px-6 rounded-xl font-bold text-white bg-blue-600 shadow-md">
                🤖 AI Search
              </button>
            ) : (
              <button onClick={() => setSearchType('ai')} className="py-3 px-6 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                🤖 AI Search
              </button>
            )}
            {searchType === 'keyword' ? (
              <button onClick={() => setSearchType('keyword')} className="py-3 px-6 rounded-xl font-bold text-white bg-green-500 shadow-md">
                🔑 Key Search
              </button>
            ) : (
              <button onClick={() => setSearchType('keyword')} className="py-3 px-6 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                🔑 Key Search
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Bar (Giữ nguyên) */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex gap-3 mb-4">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="px-5 py-4 border-2 border-gray-300 rounded-xl bg-white min-w-[200px] font-medium"
            >
              <option value="all">🔷 Tất cả</option>
              <option value="Account">👤 Tài khoản</option>
              <option value="General">💳 Thanh toán</option>
              <option value="Lending">📱 Ứng dụng</option>
              <option value="Merchant">🏪 Merchant</option>
              <option value="Promotion">🎁 Khuyến Mãi</option>
              <option value="Travelling">✈️ DVTC</option>
            </select>
            <input
              type="text"
              placeholder={searchType === 'ai' ? 'Nhập câu hỏi của bạn...' : 'Nhập từ khóa ngắn gọn...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-5 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className={loading ? 'px-8 py-4 rounded-xl font-bold text-white bg-gray-400 cursor-not-allowed' : searchType === 'ai' ? 'px-8 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md' : 'px-8 py-4 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 shadow-md'}
            >
              {loading ? '🔄 Đang tìm...' : '🔍 Tìm kiếm'}
            </button>
          </div>
          {searchType === 'keyword' && (
            <p className="text-sm text-gray-500 mb-3">
              💡 Mẹo: Key Search hoạt động tốt nhất với từ khóa ngắn gọn (1-5 từ). Dùng AI Search cho câu hỏi dài.
            </p>
          )}
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              <strong>⚠️ </strong>{error}
              {error.includes('Không tìm thấy') && (
                <ul className="list-disc list-inside mt-2 text-sm">
                  <li>Thử mô tả chi tiết hơn vấn đề</li>
                  <li>Kiểm tra lại domain filter</li>
                  <li>Liên hệ Shift Lead nếu cần hỗ trợ</li>
                </ul>
              )}
            </div>
          )}
        </div>

        {/* --- TÍNH NĂNG MỚI (PHẦN HIỂN THỊ KẾT QUẢ) --- */}
        {!loading && results.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Tìm thấy {results.length} kết quả</h2>
              <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {searchType === 'ai' ? '🤖 AI Search' : '🔑 Key Search'}
              </span>
            </div>

            {/* A. Top 5 Results */}
            <div className="mb-12">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-yellow-400">
                🏆 Top {top5Results.length} Kết quả hàng đầu
              </h3>
              <div className="space-y-4">
                {top5Results.map((r, index) => (
                  <SopSummaryCard key={r.id} r={r} isTopMatch={true} />
                ))}
              </div>
            </div>

            {/* B. More Suggestions */}
            {moreSuggestions.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
                  📑 Gợi ý thêm ({moreSuggestions.length} SOPs)
                </h3>
                
                {/* Tabs Navigation */}
                <div className="flex gap-2 mb-4 overflow-x-auto">
                  <button
                    onClick={() => setActiveSuggestionTab('All')}
                    className={`px-4 py-2 font-semibold rounded-lg ${activeSuggestionTab === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    Tất cả ({moreSuggestions.length})
                  </button>
                  {suggestionDomains.map(domain => (
                    <button
                      key={domain}
                      onClick={() => setActiveSuggestionTab(domain)}
                      className={`px-4 py-2 font-semibold rounded-lg whitespace-nowrap ${activeSuggestionTab === domain ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                      {domain} ({moreSuggestions.filter(r => r.domain === domain).length})
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-4">
                  {filteredSuggestions.map(r => (
                    <SopSummaryCard key={r.id} r={r} isTopMatch={false} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Render Modal chi tiết */}
      <SopDetailModal />
    </div>
  )
}