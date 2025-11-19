'use client'

import React, { useState, useMemo } from 'react'

// Hàm format ngày tháng từ YYYY-MM-DD sang DD/MM/YYYY
// Lưu ý: Hàm này yêu cầu dữ liệu 'last_updated' được trả về từ backend của bạn
const formatDate = (dateString: string) => {
  try {
    const parts = dateString.split('-'); // Giả định backend trả về YYYY-MM-DD
    if (parts.length === 3) {
      // Đảo ngược thành DD/MM/YYYY
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch (e) {
    console.error("Lỗi format ngày:", e);
  }
  return dateString; // Trả về nguyên gốc nếu lỗi
};


// Dữ liệu 5 nút Quick Buttons (Đã sắp xếp lại thứ tự)
const LINKS = [
  // 1. SOPie Index
  { 
    label: 'SOPie Index', 
    icon: '📚', 
    url: 'https://sites.google.com/view/cs-faq-chung/home',
    styleClass: 'bg-green-100 text-green-700 hover:bg-green-200'
  },
  // 2. Bảng tin SOP
  {
    label: 'Bảng tin SOP',
    icon: '📅',
    url: 'https://docs.google.com/spreadsheets/d/1bEZ0VmD8BF5q85oF4RAMmxVUVil6IBV5/edit?gid=1267671571#gid=1267671571',
    styleClass: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
  },
  // 3. Báo lỗi SOP
  { 
    label: 'Báo lỗi SOP', 
    icon: '🐞', 
    url: 'https://forms.gle/Hbjuzu7RwdhscNfW9',
    styleClass: 'bg-red-100 text-red-700 hover:bg-red-200'
  },
  // 4. Đề xuất SOP
  { 
    label: 'Đề xuất SOP', 
    icon: '✨', 
    url: 'https://forms.gle/rXZvHgfuLHMYQ7Wn6',
    styleClass: 'bg-purple-100 text-purple-700 hover:bg-purple-200'
  },
  // 5. CSWriteLab
  {
    label: 'CSWriteLab', 
    icon: '✍️', 
    url: 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab',
    styleClass: 'bg-orange-100 text-orange-700 hover:bg-orange-200'
  }
]

export default function Home() {
  // --- DEBUG LOG ---
  console.log("VERCEL BUILD V3 (PRODUCTION READY) ĐÃ CHẠY!");
  // -----------------

  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('all')
  const [searchType, setSearchType] = useState('ai')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [activeHxlTabs, setActiveHxlTabs] = useState<{[key: string]: 'cs1' | 'cs2'}>({})
  const [selectedSop, setSelectedSop] = useState<any | null>(null)
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

    // --- LOGIC KẾT NỐI BACKEND THẬT ---
    // Dùng logic kiểm tra URL trình duyệt (an toàn nhất cho localhost/production)
    const backendUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : 'https://sopie-search-tool.onrender.com';
    
    console.log("Đang gọi backend tại (PRODUCTION LOGIC):", backendUrl);

    try {
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
          // Lỗi không tìm thấy: hiển thị thông báo lỗi QC
          setError('Không tìm thấy SOP phù hợp. Vui lòng thử lại với từ khóa chi tiết hơn hoặc kiểm tra lại domain filter.')
        } else {
          setError('') 
        }
        
        setResults(data.results)
        
        // Khởi tạo tabs mặc định cho các kết quả mới
        const defaultTabs: {[key: string]: 'cs1' | 'cs2'} = {}
        data.results.forEach((r: any) => {
          defaultTabs[r.id] = 'cs1' 
        })
        setActiveHxlTabs(defaultTabs)
      } else {
        setError('Lỗi kết nối API. Vui lòng kiểm tra status của backend server.')
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError('Không thể kết nối backend. Vui lòng kiểm tra server hoặc Network/CORS.')
    } finally {
      setLoading(false)
    }
    // --- KẾT THÚC LOGIC KẾT NỐI BACKEND THẬT ---
  }

  // Component Modal (ĐÃ KHÔI PHỤC ĐẦY ĐỦ CÁC KHỐI THÔNG TIN)
  const SopDetailModal = () => {
    if (!selectedSop) return null
    const r = selectedSop

    // Biến kiểm tra tab HXL nào đang hoạt động
    const activeHxlLevel = activeHxlTabs[r.id] || 'cs1';
    
    // Link CSWriteLab tĩnh
    const csWriteLabLink = 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab';

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
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{r.cause}</p>
            </div>
          )}

          {/* 3. Tab Hướng dẫn kiểm tra tool */}
          {r.check_tools && r.check_tools.guideline && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
              <strong className="text-blue-700 block mb-2">🔧 Hướng dẫn kiểm tra tool:</strong>
              <p className="text-gray-800 mb-3 whitespace-pre-wrap break-words leading-relaxed">
                {r.check_tools.guideline}
              </p>
              
              {r.check_tools.name && r.check_tools.url && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {(() => {
                    // Split names và URLs bằng dấu phẩy
                    const names = r.check_tools.name.split(',').map((n: string) => n.trim()).filter(Boolean)
                    const urls = r.check_tools.url.split(',').map((u: string) => u.trim()).filter(Boolean)
                    
                    // Render từng cặp name-url
                    return names.map((name: string, index: number) => {
                      // Fallback to first URL if mismatch, đảm bảo luôn có link
                      const url = urls[index] || urls[0]
                      return (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                        >
                          🔗 {name}
                        </a>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          )}
          
          {/* 4. Tab Hướng xử lý (HXL CS1 / HXL CS2) */}
          {(r.solution?.level1 || r.solution?.level2) && (
            <div className="mb-4">
              <strong className="text-green-700 block mb-3 text-base">✅ Hướng xử lý:</strong>
              <div className="flex gap-2 mb-3 border-b border-gray-200">
                <button
                  onClick={() => setActiveHxlTabs({...activeHxlTabs, [r.id]: 'cs1'})}
                  className={activeHxlLevel === 'cs1' ? 'px-4 py-2 font-semibold text-green-700 border-b-2 border-green-600' : 'px-4 py-2 font-medium text-gray-500 hover:text-gray-700'}
                >
                  HXL CS1
                </button>
                {r.solution?.level2 && (
                  <button
                    onClick={() => setActiveHxlTabs({...activeHxlTabs, [r.id]: 'cs2'})}
                    className={activeHxlLevel === 'cs2' ? 'px-4 py-2 font-semibold text-green-700 border-b-2 border-green-600' : 'px-4 py-2 font-medium text-gray-500 hover:text-gray-700'}
                  >
                    HXL CS2
                  </button>
                )}
              </div>
              <div className="p-4 bg-green-50 rounded-xl border-l-4 border-green-500">
                {activeHxlLevel === 'cs1' && r.solution?.level1 && (
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line">{r.solution.level1}</p>
                )}
                {activeHxlLevel === 'cs2' && r.solution?.level2 && (
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line">{r.solution.level2}</p>
                )}
              </div>
            </div>
          )}

          {/* 5. Khối Lưu ý (Notes) */}
          {r.notes && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-xl border-l-4 border-yellow-500">
              <strong className="text-yellow-700 block mb-2">📝 Lưu ý:</strong>
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">{r.notes}</p>
            </div>
          )}

          {/* 6. Template Phản hồi / Gợi ý CSWriteLab */}
          {(r.templates && (r.templates.email || r.templates.chat)) || activeHxlLevel === 'cs2' ? (
            <div className="mb-4">
              {/* HIỂN THỊ TEMPLATE CS1 */}
              {activeHxlLevel === 'cs1' && (r.templates.email || r.templates.chat) && (
                <>
                  <strong className="text-gray-700 block mb-3 text-base">Gợi ý phản hồi dành cho CS1:</strong>
                  {r.templates.email && (
                    <details className="mb-3">
                      <summary className="cursor-pointer font-semibold text-gray-700 hover:text-blue-600 p-3 bg-gray-50 rounded-lg">
                        📧 Template App/Mail
                      </summary>
                      <div className="mt-2 p-4 bg-white border-2 border-gray-200 rounded-lg text-sm text-gray-800 whitespace-pre-line">
                        {r.templates.email}
                      </div>
                    </details>
                  )}
                  {r.templates.chat && (
                    <details className="mb-3">
                      <summary className="cursor-pointer font-semibold text-gray-700 hover:text-blue-600 p-3 bg-gray-50 rounded-lg">
                        💬 Template Call/Chat
                      </summary>
                      <div className="mt-2 p-4 bg-white border-2 border-gray-200 rounded-lg text-sm text-gray-800 whitespace-pre-line">
                        {r.templates.chat}
                      </div>
                    </details>
                  )}
                </>
              )}

              {/* HIỂN THỊ CSWRITELAB KHI Ở CS2 */}
              {activeHxlLevel === 'cs2' && (
                <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                  <strong className="text-blue-700 block mb-2">💡 Soạn thảo phản hồi dành cho CS2:</strong>
                  <p className="text-gray-800 leading-relaxed mb-3">
                    Sau khi có kết quả từ BPLQ, CS có thể soạn thảo nhanh văn bản phản hồi với <a
                      href={csWriteLabLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-semibold hover:text-blue-800 underline transition-colors"
                    >
                      CSWriteLab ✍️
                    </a>
                  </p>
                </div>
              )}
            </div>
          ) : null}


          {/* Footer */}
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

  const top5Results = results.slice(0, 5)
  const moreSuggestions = results.slice(5)

  const suggestionDomains = useMemo(() => {
    const domainCounts: {[key: string]: number} = {}
    moreSuggestions.forEach(r => {
      if (r.domain) {
        domainCounts[r.domain] = (domainCounts[r.domain] || 0) + 1
      }
    })
    return Object.entries(domainCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([domain]) => domain)
  }, [moreSuggestions])

  const filteredSuggestions = useMemo(() => {
    if (activeSuggestionTab === 'All') {
      return moreSuggestions
    }
    return moreSuggestions.filter(r => r.domain === activeSuggestionTab)
  }, [moreSuggestions, activeSuggestionTab])

  const SopSummaryCard = ({ r, isTopMatch = false }: { r: any, isTopMatch?: boolean }) => (
    <div 
      className={`bg-white rounded-2xl shadow-md hover:shadow-lg p-6 transition-all cursor-pointer border-l-4 ${isTopMatch ? 'border-yellow-500' : 'border-blue-600'}`}
      onClick={() => setSelectedSop(r)}
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
        {r.cause ? `Nguyên nhân: ${r.cause}` : (r.solution?.level1 ? r.solution.level1 : "Nhấp để xem chi tiết...")}
      </p>

      <div className="flex justify-between items-center text-sm">
        <span className="text-xs text-gray-400 font-medium">
          {/* Lấy dữ liệu 'last_updated' động từ backend */}
          Cập nhật: {r.last_updated ? formatDate(r.last_updated) : 'N/A'}
        </span>
        <span className={`font-semibold ${isTopMatch ? 'text-yellow-700' : 'text-blue-600'}`}>
          ⚡ {Math.round(r.relevance_score * 100)}% Match
        </span>
      </div>
    </div>
  )
  
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-900">FAQ Search Tool</h1>
              <p className="text-sm text-gray-500">powered by SOPie</p>
            </div>
            
            <div className="flex gap-3">
              {searchType === 'ai' ? (
                <button onClick={() => setSearchType('ai')} className="py-3 px-6 rounded-xl font-bold text-white bg-blue-600 shadow-md transition-transform hover:scale-105">
                  🤖 AI Search
                </button>
              ) : (
                <button onClick={() => setSearchType('ai')} className="py-3 px-6 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                  🤖 AI Search
                </button>
              )}
              {searchType === 'keyword' ? (
                <button onClick={() => setSearchType('keyword')} className="py-3 px-6 rounded-xl font-bold text-white bg-green-500 shadow-md transition-transform hover:scale-105">
                  🔑 Key Search
                </button>
              ) : (
                <button onClick={() => setSearchType('keyword')} className="py-3 px-6 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                  🔑 Key Search
                </button>
              )}
            </div>
          </div>

          {/* --- TOP BUTTONS (Quick Buttons) --- */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center md:text-left">Quick Buttons</p>
            <div className="flex flex-wrap justify-between gap-3"> 
                {LINKS.map((link, index) => (
                    <a 
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow-md ${link.styleClass}`}
                    >
                        <span className="text-lg">{link.icon}</span>
                        <span>{link.label}</span>
                    </a>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Bar Container */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
            
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="px-5 py-4 border-2 border-gray-300 rounded-xl bg-white md:min-w-[200px] font-medium focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="Account">Tài khoản</option>
              <option value="Payment">Thanh toán</option>
              <option value="Application">Ứng dụng</option>
              <option value="Merchant">Đối tác</option>
              <option value="Lending">DVTC</option>
              <option value="Travel">OTA</option>
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
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg animate-fade-in">
              <div className="flex items-start gap-3">
                 <div className="text-xl">⚠️</div>
                 <div>
                    <strong>{error}</strong>
                    {error.includes('Không tìm thấy') && (
                        <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                          <li>Thử mô tả chi tiết hơn vấn đề</li>
                          <li>Kiểm tra lại domain filter</li>
                          <li>Liên hệ QC để được hỗ trợ thêm</li>
                        </ul>
                    )}
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Display */}
        {!loading && results.length > 0 && (
          <div className="mt-8 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Tìm thấy {results.length} kết quả</h2>
              <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {searchType === 'ai' ? '🤖 AI Search' : '🔑 Key Search'}
              </span>
            </div>

            {/* A. Top 5 Results */}
            <div className="mb-12">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-yellow-400 inline-block pr-8">
                🏆 Top {top5Results.length} Kết quả hàng đầu
              </h3>
              <div className="space-y-4">
                {top5Results.map((r) => (
                  <SopSummaryCard key={r.id} r={r} isTopMatch={true} />
                ))}
              </div>
            </div>

            {/* B. More Suggestions */}
            {moreSuggestions.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300 inline-block pr-8">
                  📑 Gợi ý thêm ({moreSuggestions.length} SOPs)
                </h3>
                
                {/* Tabs Navigation */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  <button
                    onClick={() => setActiveSuggestionTab('All')}
                    className={`px-4 py-2 font-semibold rounded-lg transition-colors ${activeSuggestionTab === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Tất cả ({moreSuggestions.length})
                  </button>
                  {suggestionDomains.map(domain => (
                    <button
                      key={domain}
                      onClick={() => setActiveSuggestionTab(domain)}
                      className={`px-4 py-2 font-semibold rounded-lg whitespace-nowrap transition-colors ${activeSuggestionTab === domain ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
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

      <SopDetailModal />
    </div>
  )
}