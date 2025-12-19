'use client'

import React, { useState, useMemo, useEffect } from 'react'

// --- HELPER FUNCTIONS & CONSTANTS ---

// Hàm format ngày tháng từ YYYY-MM-DD sang DD/MM/YYYY
const formatDate = (dateString: string) => {
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch (e) {
    // Silent fail
  }
  return dateString;
};

// Dữ liệu các nút Quick Buttons
const LINKS = [
  { label: 'SOPie Index', icon: '📚', url: 'https://sites.google.com/view/cs-faq-chung/quy-%C4%91%E1%BB%8Bnh-chung', styleClass: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60' },
  { label: 'Bảng tin SOP', icon: '📅', url: 'https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0', styleClass: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60' },
  { label: 'Báo lỗi SOP', icon: '🐞', url: 'https://forms.gle/Hbjuzu7RwdhscNfW9', styleClass: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60' },
  { label: 'Đề xuất SOP', icon: '✨', url: 'https://forms.gle/rXZvHgfuLHMYQ7Wn6', styleClass: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60' },
  { label: 'CSWriteLab', icon: '✍️', url: 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab', styleClass: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60' }
]

// --- TOAST NOTIFICATION COMPONENT (NEW) ---

const NotificationPopup = () => {
  const [noti, setNoti] = useState<{show: boolean, msg: string, id: number | null}>({
    show: false,
    msg: '',
    id: null
  });

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0";

  useEffect(() => {
    const checkNewNoti = async () => {
      try {
        const backendUrl = 'https://sopie-search-tool.onrender.com';
        const res = await fetch(`${backendUrl}/api/get-latest-noti`);
        const data = await res.json();

        if (data.success && data.noti) {
          const lastSeenId = localStorage.getItem('sopie_last_noti_id');
          if (data.noti.id.toString() !== lastSeenId) {
            setNoti({
              show: true,
              msg: data.noti.message,
              id: data.noti.id
            });
          }
        }
      } catch (error) {
        console.error("Lỗi kiểm tra thông báo:", error);
      }
    };

    checkNewNoti();
    const interval = setInterval(checkNewNoti, 30000); 
    return () => clearInterval(interval);
  }, []);

  const handleClose = (markAsRead: boolean) => {
    if (markAsRead && noti.id) {
      localStorage.setItem('sopie_last_noti_id', noti.id.toString());
    }
    setNoti({ ...noti, show: false });
  };

  if (!noti.show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-full duration-500">
      <div className="bg-white dark:bg-gray-800 w-85 shadow-2xl rounded-2xl border-t-4 border-blue-500 overflow-hidden ring-1 ring-black/5">
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
              </span>
              <h3 className="font-bold text-blue-700 dark:text-blue-400 text-xs uppercase tracking-widest">Tin mới từ QC</h3>
            </div>
            <button onClick={() => handleClose(false)} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mb-4 border border-blue-100 dark:border-blue-800/50">
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed italic">
              "{noti.msg}"
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleClose(true)} className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600">Bỏ qua</button>
            <a href={SHEET_URL} target="_blank" onClick={() => handleClose(true)} className="flex-1 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center shadow-md transition-all active:scale-95 flex items-center justify-center gap-1">Xem ngay 🚀</a>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

// 1. Thẻ tóm tắt kết quả tìm kiếm
const SopSummaryCard = ({ r, isTopMatch = false, onClick }: { r: any, isTopMatch?: boolean, onClick: () => void }) => (
  <div 
    className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg p-6 transition-all cursor-pointer border-l-4 
    ${isTopMatch ? 'border-yellow-500' : 'border-blue-600 dark:border-blue-500'}`}
    onClick={onClick}
  >
    <div className="flex justify-between items-start mb-3">
      <h3 className={`font-bold text-gray-900 dark:text-white flex-1 pr-4 ${isTopMatch ? 'text-xl' : 'text-lg'}`}>
        {isTopMatch && '⭐ '} {r.title}
      </h3>
      <span className={`px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap 
        ${isTopMatch ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'}`}>
        {r.domain}
      </span>
    </div>
    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
      {r.cause ? `Nguyên nhân: ${r.cause}` : (r.solution?.level1 ? r.solution.level1 : "Nhấp để xem chi tiết...")}
    </p>
    <div className="flex justify-between items-center text-sm">
      <span className="text-xs text-gray-400 font-medium">Cập nhật: {r.last_updated ? formatDate(r.last_updated) : 'N/A'}</span>
      <span className={`font-semibold ${isTopMatch ? 'text-yellow-700 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'}`}>
        ⚡ {Math.round(r.relevance_score * 100)}% Match
      </span>
    </div>
  </div>
)

// 2. Modal chi tiết
const SopDetailModal = ({ sop, onClose, activeHxlTabs, setActiveHxlTabs }: { sop: any, onClose: () => void, activeHxlTabs: any, setActiveHxlTabs: any }) => {
  if (!sop) return null;
  const activeHxlLevel = activeHxlTabs[sop.id] || 'cs1';
  const csWriteLabLink = 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative border border-gray-200 dark:border-gray-700 transition-colors duration-200" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex-1 pr-4">{sop.title}</h3>
          <span className="px-4 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-semibold whitespace-nowrap">{sop.domain}</span>
        </div>

        {sop.cause && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-l-4 border-red-500">
            <strong className="text-red-700 dark:text-red-400 block mb-2">⚠️ Nguyên nhân:</strong>
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{sop.cause}</p>
          </div>
        )}

        {sop.check_tools && sop.check_tools.guideline && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-l-4 border-blue-500">
            <strong className="text-blue-700 dark:text-blue-400 block mb-2">🔧 Hướng dẫn kiểm tra tool:</strong>
            <p className="text-gray-800 dark:text-gray-200 mb-3 whitespace-pre-wrap leading-relaxed">{sop.check_tools.guideline}</p>
            {sop.check_tools.name && sop.check_tools.url && (
              <div className="flex flex-wrap gap-3 mt-2">
                {(() => {
                  const names = sop.check_tools.name.split(',').map((n:string) => n.trim()).filter(Boolean)
                  const urls = sop.check_tools.url.split(',').map((u:string) => u.trim()).filter(Boolean)
                  return names.map((name:string, index:number) => (
                    <a key={index} href={urls[index] || urls[0]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-100 rounded-lg text-sm font-medium transition-colors">🔗 {name}</a>
                  ))
                })()}
              </div>
            )}
          </div>
        )}
        
        {(sop.solution?.level1 || sop.solution?.level2) && (
          <div className="mb-4">
            <strong className="text-green-700 dark:text-green-400 block mb-3 text-base">✅ Hướng xử lý:</strong>
            <div className="flex gap-2 mb-3 border-b border-gray-200 dark:border-gray-700">
              <button onClick={() => setActiveHxlTabs({...activeHxlTabs, [sop.id]: 'cs1'})} className={activeHxlLevel === 'cs1' ? 'px-4 py-2 font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400' : 'px-4 py-2 font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}>HXL CS1</button>
              {sop.solution?.level2 && (
                <button onClick={() => setActiveHxlTabs({...activeHxlTabs, [sop.id]: 'cs2'})} className={activeHxlLevel === 'cs2' ? 'px-4 py-2 font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400' : 'px-4 py-2 font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}>HXL CS2</button>
              )}
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-l-4 border-green-500">
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">{activeHxlLevel === 'cs1' ? sop.solution.level1 : sop.solution.level2}</p>
            </div>
          </div>
        )}

        {sop.notes && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-l-4 border-yellow-500">
            <strong className="text-yellow-700 dark:text-yellow-400 block mb-2">📝 Lưu ý:</strong>
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">{sop.notes}</p>
          </div>
        )}

        {(sop.templates && (sop.templates.email || sop.templates.chat)) || activeHxlLevel === 'cs2' ? (
          <div className="mb-4">
            {activeHxlLevel === 'cs1' && (sop.templates.email || sop.templates.chat) && (
              <>
                <strong className="text-gray-700 dark:text-gray-300 block mb-3 text-base">Gợi ý phản hồi dành cho CS1:</strong>
                {sop.templates.email && (
                  <details className="mb-3">
                    <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">📧 Template App/Mail</summary>
                    <div className="mt-2 p-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{sop.templates.email}</div>
                  </details>
                )}
                {sop.templates.chat && (
                  <details className="mb-3">
                    <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">💬 Template Call/Chat</summary>
                    <div className="mt-2 p-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{sop.templates.chat}</div>
                  </details>
                )}
              </>
            )}
            {activeHxlLevel === 'cs2' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-l-4 border-blue-500">
                <strong className="text-blue-700 dark:text-blue-400 block mb-2">💡 Soạn thảo phản hồi dành cho CS2:</strong>
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed mb-3">
                  Sau khi có kết quả từ BPLQ, CS có thể soạn thảo nhanh văn bản phản hồi với <a href={csWriteLabLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-semibold underline">CSWriteLab</a>
                </p>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
          {sop.link ? <a href={sop.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow transition-all">📄 Xem SOP gốc</a> : <div></div>}
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Relevance: {Math.round(sop.relevance_score * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

// --- MAIN PAGE COMPONENT ---

export default function Home() {
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('all')
  const [searchType, setSearchType] = useState('ai')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false) 
  const [backendSuggestion, setBackendSuggestion] = useState<any>(null)
  
  const [activeHxlTabs, setActiveHxlTabs] = useState<{[key: string]: 'cs1' | 'cs2'}>({})
  const [selectedSop, setSelectedSop] = useState<any | null>(null)
  const [activeSuggestionTab, setActiveSuggestionTab] = useState('All')
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const savedMode = localStorage.getItem('sopie_dark_mode')
    if (savedMode === 'true') setIsDarkMode(true)
  }, [])

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('sopie_dark_mode', String(newMode))
  }

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Vui lòng nhập câu hỏi')
      return
    }
    if (searchType === 'keyword' && query.trim().split(' ').length > 5) {
      setError('Bạn đang ở chế độ tra cứu bằng từ khóa. Xin vui lòng nhập từ khóa hoặc bật chế độ tra cứu AI')
      return
    }

    setLoading(true); setError(''); setResults([]); setSelectedSop(null); setActiveSuggestionTab('All'); 
    setHasSearched(false); setBackendSuggestion(null);

    const backendUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : 'https://sopie-search-tool.onrender.com';
    
    try {
      const response = await fetch(`${backendUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, domain: domain === 'all' ? null : domain, type: searchType === 'ai' ? 'semantic' : 'keyword', limit: 30 }),
      })
      const data = await response.json()
      if (data.success) {
        setResults(data.results)
        setHasSearched(true)
        if (data.suggestion) setBackendSuggestion(data.suggestion)
        
        const defaultTabs: {[key: string]: 'cs1' | 'cs2'} = {}
        data.results.forEach((r: any) => { defaultTabs[r.id] = 'cs1' })
        setActiveHxlTabs(defaultTabs)
      } else {
        setError('Lỗi kết nối API.')
      }
    } catch (err) {
      setError('Không thể kết nối backend.')
    } finally {
      setLoading(false)
    }
  }

  const highConfidenceResults = useMemo(() => results.filter(r => r.relevance_score >= 0.80), [results])
  const topDisplayResults = highConfidenceResults.slice(0, 5)
  const suggestionResults = useMemo(() => {
    const shownIds = new Set(topDisplayResults.map(r => r.id))
    return results.filter(r => !shownIds.has(r.id)).slice(0, 10)
  }, [results, topDisplayResults])

  const suggestionDomains = useMemo(() => {
    const domainCounts: {[key: string]: number} = {}
    suggestionResults.forEach(r => { if (r.domain) domainCounts[r.domain] = (domainCounts[r.domain] || 0) + 1 })
    return Object.entries(domainCounts).sort(([, countA], [, countB]) => countB - countA).map(([domain]) => domain)
  }, [suggestionResults])

  const filteredSuggestions = useMemo(() => {
    if (activeSuggestionTab === 'All') return suggestionResults
    return suggestionResults.filter(r => r.domain === activeSuggestionTab)
  }, [suggestionResults, activeSuggestionTab])

  const SuggestionBox = () => (
    <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-200 animate-fade-in shadow-sm">
        <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2">Chưa tìm thấy kết quả phù hợp. Bạn cần:</h3>
                    <ul className="list-disc list-inside text-sm space-y-1 ml-1 mb-4">
                        <li>Kiểm tra lại bộ lọc domain kiến thức</li>
                        <li>Thay đổi cách mô tả vấn đề và thử lại</li>
                        <li>Liên hệ QC để được hỗ trợ thêm</li>
                    </ul>
                    {backendSuggestion && backendSuggestion.found && (
                        <div className="pt-3 border-t border-red-200 dark:border-red-800 flex flex-wrap items-center gap-2">
                            <span className="font-medium">Hoặc bạn có thể tham khảo SOP tổng:</span>
                            <a 
                                href={backendSuggestion.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                🔗 {backendSuggestion.link_label}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  )

  const NoResultsUI = () => <SuggestionBox />

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <NotificationPopup />
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-300">
        {/* HEADER */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
              <div className="text-center md:text-left">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">FAQ Search Tool</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">powered by SOPie</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button onClick={toggleDarkMode} className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm" title="Toggle Dark Mode">{isDarkMode ? '🌞' : '🌙'}</button>
                <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                  <button onClick={() => setSearchType('ai')} className={`py-2 px-4 rounded-lg font-bold transition-all ${searchType === 'ai' ? 'bg-white dark:bg-gray-600 text-blue-600 shadow' : 'text-gray-500'}`}>🤖 AI Search</button>
                  <button onClick={() => setSearchType('keyword')} className={`py-2 px-4 rounded-lg font-bold transition-all ${searchType === 'keyword' ? 'bg-white dark:bg-gray-600 text-green-600 shadow' : 'text-gray-500'}`}>🔑 Key Search</button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex flex-wrap justify-between gap-3"> 
                  {LINKS.map((link, index) => (
                      <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow-md ${link.styleClass}`}>
                          <span className="text-lg">{link.icon}</span><span>{link.label}</span>
                      </a>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH BAR & RESULTS */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 transition-colors duration-300">
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <select value={domain} onChange={(e) => setDomain(e.target.value)} className="px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white md:min-w-[200px] font-medium focus:border-blue-500 focus:outline-none transition-colors">
                <option value="all">Tất cả</option>
                <option value="Account">Tài khoản</option>
                <option value="Payment">Thanh toán</option>
                <option value="Application">Ứng dụng</option>
                <option value="Merchant">Đối tác</option>
                <option value="Lending">DVTC</option>
                <option value="Travel">OTA</option>
              </select>
              <input type="text" placeholder={searchType === 'ai' ? 'Nhập câu hỏi của bạn...' : 'Nhập từ khóa ngắn gọn...'} value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" />
              <button onClick={handleSearch} disabled={loading} className={loading ? 'px-8 py-4 rounded-xl font-bold text-white bg-gray-400 cursor-not-allowed' : searchType === 'ai' ? 'px-8 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md' : 'px-8 py-4 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 shadow-md'}>{loading ? '🔄 ...' : '🔍 Tìm kiếm'}</button>
            </div>
            
            {searchType === 'keyword' && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 transition-colors">💡 Mẹo: Key Search hoạt động tốt nhất với từ khóa ngắn gọn (1-5 từ). Dùng AI Search cho câu hỏi dài.</p>}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-lg animate-fade-in">
                <div className="flex items-start gap-3"><div className="text-xl">⚠️</div><div><strong>{error}</strong>{error.includes('Không tìm thấy') && <ul className="list-disc list-inside mt-2 text-sm space-y-1"><li>Thử mô tả chi tiết hơn vấn đề</li><li>Kiểm tra lại domain filter</li><li>Liên hệ QC để được hỗ trợ thêm</li></ul>}</div></div>
              </div>
            )}
          </div>

          {!loading && hasSearched && (
            <div className="mt-8 animate-slide-up">
              {results.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tìm thấy {topDisplayResults.length} kết quả phù hợp</h2>
                    <span className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium transition-colors">{searchType === 'ai' ? '🤖 AI Search' : '🔑 Key Search'}</span>
                  </div>

                  {/* TOP RESULTS (>= 80%) */}
                  {topDisplayResults.length > 0 ? (
                    <div className="mb-12">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-yellow-400 inline-block pr-8">🏆 Top {topDisplayResults.length} Kết quả hàng đầu</h3>
                      <div className="space-y-4">
                        {topDisplayResults.map((r) => <SopSummaryCard key={r.id} r={r} isTopMatch={true} onClick={() => setSelectedSop(r)} />)}
                      </div>
                    </div>
                  ) : (
                    <SuggestionBox />
                  )}

                  {/* SUGGESTIONS */}
                  {suggestionResults.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600 inline-block pr-8">📑 Gợi ý thêm ({suggestionResults.length} SOPs)</h3>
                      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                        <button onClick={() => setActiveSuggestionTab('All')} className={`px-4 py-2 font-semibold rounded-lg transition-colors whitespace-nowrap ${activeSuggestionTab === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Tất cả ({suggestionResults.length})</button>
                        {suggestionDomains.map(domain => (
                          <button key={domain} onClick={() => setActiveSuggestionTab(domain)} className={`px-4 py-2 font-semibold rounded-lg whitespace-nowrap transition-colors ${activeSuggestionTab === domain ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{domain} ({suggestionResults.filter(r => r.domain === domain).length})</button>
                        ))}
                      </div>
                      <div className="space-y-4">
                        {filteredSuggestions.map(r => <SopSummaryCard key={r.id} r={r} isTopMatch={false} onClick={() => setSelectedSop(r)} />)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <NoResultsUI />
              )}
            </div>
          )}
        </div>

        <SopDetailModal sop={selectedSop} onClose={() => setSelectedSop(null)} activeHxlTabs={activeHxlTabs} setActiveHxlTabs={setActiveHxlTabs} />
      </div>
    </div>
  )
}