'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'

// --- HELPER FUNCTIONS & CONSTANTS ---

const formatDate = (dateString: string) => {
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch (e) {}
  return dateString;
};

const LINKS = [
  { label: 'SOPie Index', icon: '📚', url: 'https://sites.google.com/view/cs-faq-chung/quy-%C4%91%E1%BB%8Bnh-chung', styleClass: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60' },
  { label: 'Bảng tin SOP', icon: '📅', url: 'https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0', styleClass: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60' },
  { label: 'Theo dõi Issue', icon: '📋', url: 'https://docs.google.com/spreadsheets/d/1xUWGBiw9tBnZqrxjt4enL_oZ7LsU8QiWKhJOS5FbwrU/edit?gid=0#gid=0', styleClass: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:hover:bg-cyan-900/60' },
  { label: 'Báo lỗi SOP', icon: '🐞', url: 'https://forms.gle/Hbjuzu7RwdhscNfW9', styleClass: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60' },
  { label: 'Đề xuất SOP', icon: '✨', url: 'https://forms.gle/rXZvHgfuLHMYQ7Wn6', styleClass: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60' },
  { label: 'CSWriteLab', icon: '✍️', url: 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab', styleClass: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60' }
]

// --- NOTIFICATION SYSTEM (LEFT SIDE BUBBLES) ---

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const lastIdRef = useRef<number | null>(null);
  const isFirstLoad = useRef(true);

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0";

  useEffect(() => {
    const checkNewNoti = async () => {
      try {
        const backendUrl = 'https://sopie-search-tool.onrender.com';
        const res = await fetch(`${backendUrl}/api/get-latest-noti`);
        const data = await res.json();

        if (data.success && data.noti) {
          const newId = data.noti.id;
          const lastSeenId = localStorage.getItem('sopie_last_noti_id');

          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          const originalMsg = data.noti.message;
          const formattedMsg = originalMsg.replace("Vừa có tin cập nhật liên quan đến:", "Vừa có cập nhật mới liên quan đến sản phẩm/quy trình:");

          // Logic cho lần đầu load trang: Hiện tin mới nhất nếu chưa đọc
          if (isFirstLoad.current) {
            if (lastSeenId !== newId.toString()) {
              setNotifications([{ ...data.noti, message: formattedMsg, displayTime: timeStr }]);
            }
            lastIdRef.current = newId;
            isFirstLoad.current = false;
            return;
          }

          // Logic real-time khi đang online
          if (lastIdRef.current !== null && newId > lastIdRef.current) {
            setNotifications(prev => [{ ...data.noti, message: formattedMsg, displayTime: timeStr }, ...prev]);
            lastIdRef.current = newId;
          }
        }
      } catch (error) { console.error("Lỗi check noti:", error); }
    };

    checkNewNoti();
    const interval = setInterval(checkNewNoti, 25000); 
    return () => clearInterval(interval);
  }, []);

  const handleCloseNoti = (id: number) => {
    localStorage.setItem('sopie_last_noti_id', id.toString());
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed left-6 top-[280px] z-[100] flex flex-col gap-4 w-85 pointer-events-none">
      {notifications.map((n) => (
        <div 
          key={n.id} 
          className="pointer-events-auto animate-in slide-in-from-left-full duration-500 bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border-t-4 border-blue-500 overflow-hidden ring-1 ring-black/5"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">!*</span>
                <h3 className="font-bold text-blue-700 dark:text-blue-400 text-sm uppercase tracking-tight">Cập nhật tin mới</h3>
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mb-3 border border-blue-100 dark:border-blue-800/50">
              <p className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed font-medium">
                {n.message}
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-gray-400 font-medium italic">
                Lúc: {n.displayTime}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCloseNoti(n.id)}
                  className="px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                >
                  Bỏ qua
                </button>
                <a 
                  href={SHEET_URL}
                  target="_blank"
                  onClick={() => handleCloseNoti(n.id)}
                  className="px-3 py-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-95"
                >
                  Xem ngay
                </a>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- SOP SUMMARY CARD ---
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

// --- SOP DETAIL MODAL ---
const SopDetailModal = ({ sop, onClose, activeHxlTabs, setActiveHxlTabs }: { sop: any, onClose: () => void, activeHxlTabs: any, setActiveHxlTabs: any }) => {
  if (!sop) return null;
  const activeHxlLevel = activeHxlTabs[sop.id] || 'cs1';
  const csWriteLabLink = 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
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
          </div>
        )}
        {(sop.solution?.level1 || sop.solution?.level2) && (
          <div className="mb-4">
            <strong className="text-green-700 dark:text-green-400 block mb-3 text-base">✅ Hướng xử lý:</strong>
            <div className="flex gap-2 mb-3 border-b border-gray-200 dark:border-gray-700">
              <button onClick={() => setActiveHxlTabs({...activeHxlTabs, [sop.id]: 'cs1'})} className={activeHxlLevel === 'cs1' ? 'px-4 py-2 font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400' : 'px-4 py-2 font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700'}>HXL CS1</button>
              {sop.solution?.level2 && (
                <button onClick={() => setActiveHxlTabs({...activeHxlTabs, [sop.id]: 'cs2'})} className={activeHxlLevel === 'cs2' ? 'px-4 py-2 font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400' : 'px-4 py-2 font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700'}>HXL CS2</button>
              )}
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-l-4 border-green-500">
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">{activeHxlLevel === 'cs1' ? sop.solution.level1 : sop.solution.level2}</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
          {sop.link ? <a href={sop.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow transition-all">📄 Xem SOP gốc</a> : <div></div>}
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Match: {Math.round(sop.relevance_score * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

// --- MAIN PAGE ---

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
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const savedMode = localStorage.getItem('sopie_dark_mode')
    if (savedMode === 'true') setIsDarkMode(true)
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) { setError('Vui lòng nhập câu hỏi'); return; }
    setLoading(true); setError(''); setResults([]); setSelectedSop(null); setHasSearched(false);
    const backendUrl = 'https://sopie-search-tool.onrender.com';
    try {
      const response = await fetch(`${backendUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, domain: domain === 'all' ? null : domain, type: searchType === 'ai' ? 'semantic' : 'keyword', limit: 30 }),
      })
      const data = await response.json()
      if (data.success) {
        setResults(data.results); setHasSearched(true);
        if (data.suggestion) setBackendSuggestion(data.suggestion)
        const defaultTabs: any = {};
        data.results.forEach((r: any) => { defaultTabs[r.id] = 'cs1' });
        setActiveHxlTabs(defaultTabs);
      } else { setError('Lỗi kết nối API.'); }
    } catch (err) { setError('Không thể kết nối backend.'); } finally { setLoading(false) }
  }

  const topDisplayResults = useMemo(() => results.filter(r => r.relevance_score >= 0.80).slice(0, 5), [results])
  const suggestionResults = useMemo(() => {
    const shownIds = new Set(topDisplayResults.map(r => r.id))
    return results.filter(r => !shownIds.has(r.id)).slice(0, 10)
  }, [results, topDisplayResults])

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
                    {backendSuggestion?.found && (
                        <div className="pt-3 border-t border-red-200 dark:border-red-800 flex flex-wrap items-center gap-2">
                            <span className="font-medium">Hoặc bạn có thể tham khảo SOP tổng:</span>
                            <a href={backendSuggestion.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-md transition-all">🔗 {backendSuggestion.link_label}</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  )

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <NotificationSystem />
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-300">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
              <div className="text-center md:text-left">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">FAQ Search Tool</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">powered by SOPie</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400 shadow-sm transition-colors">{isDarkMode ? '🌞' : '🌙'}</button>
                <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                  <button onClick={() => setSearchType('ai')} className={`py-2 px-4 rounded-lg font-bold transition-all ${searchType === 'ai' ? 'bg-white dark:bg-gray-600 text-blue-600 shadow' : 'text-gray-500'}`}>🤖 AI Search</button>
                  <button onClick={() => setSearchType('keyword')} className={`py-2 px-4 rounded-lg font-bold transition-all ${searchType === 'keyword' ? 'bg-white dark:bg-gray-600 text-green-600 shadow' : 'text-gray-500'}`}>🔑 Key Search</button>
                </div>
              </div>
            </div>
            {/* QUICK BUTTONS GRID - PHÂN BỔ ĐỀU */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {LINKS.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-bold shadow-sm transition-all text-[13px] text-center ${link.styleClass}`}>
                  <span>{link.icon}</span><span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="flex flex-col md:flex-row gap-3">
              <select value={domain} onChange={(e) => setDomain(e.target.value)} className="px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none transition-colors">
                <option value="all">Tất cả</option><option value="Account">Tài khoản</option><option value="Payment">Thanh toán</option><option value="Application">Ứng dụng</option><option value="Merchant">Đối tác</option><option value="Lending">DVTC</option><option value="Travel">OTA</option>
              </select>
              <input type="text" placeholder={searchType === 'ai' ? 'Nhập câu hỏi của bạn...' : 'Nhập từ khóa ngắn gọn...'} value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:outline-none focus:border-blue-500 transition-colors" />
              <button onClick={handleSearch} disabled={loading} className={`px-8 py-4 rounded-xl font-bold text-white shadow-md ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{loading ? '🔄 ...' : '🔍 Tìm kiếm'}</button>
            </div>
          </div>

          {!loading && hasSearched && (
            <div className="mt-8 animate-slide-up">
              {results.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-6"><h2 className="text-2xl font-bold">Tìm thấy {topDisplayResults.length} kết quả phù hợp</h2></div>
                  <div className="space-y-4 mb-12">{topDisplayResults.map((r) => <SopSummaryCard key={r.id} r={r} isTopMatch={true} onClick={() => setSelectedSop(r)} />)}</div>
                  {suggestionResults.length > 0 && (<div><h3 className="text-xl font-semibold mb-4 pb-2 border-b border-gray-300 inline-block pr-8">📑 Gợi ý thêm</h3><div className="space-y-4">{suggestionResults.map(r => <SopSummaryCard key={r.id} r={r} isTopMatch={false} onClick={() => setSelectedSop(r)} />)}</div></div>)}
                </>
              ) : (<SuggestionBox />)}
            </div>
          )}
        </div>
        <SopDetailModal sop={selectedSop} onClose={() => setSelectedSop(null)} activeHxlTabs={activeHxlTabs} setActiveHxlTabs={setActiveHxlTabs} />
      </div>
    </div>
  )
}