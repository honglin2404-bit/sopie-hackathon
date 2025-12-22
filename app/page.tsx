'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'

// --- NOTIFICATION SYSTEM COMPONENT (UPDATED) ---
// Logic: Tự động lọc tin Summary để treo đến 14:35 ngày hôm sau
const NotificationSystem = ({ darkMode }: { darkMode: boolean }) => {
  const [activeNotis, setActiveNotis] = useState<any[]>([]);
  // Lưu ID dạng string để tránh lỗi so sánh
  const [closedNotiIds, setClosedNotiIds] = useState<string[]>([]);
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0";

  useEffect(() => {
    try {
      const savedClosed = localStorage.getItem('sopie_closed_notis');
      if (savedClosed) {
        const parsed = JSON.parse(savedClosed);
        setClosedNotiIds(parsed.map((id: any) => String(id)));
      }
    } catch (e) {
      console.error("Lỗi load history:", e);
    }
  }, []);

  useEffect(() => {
    const checkNewNoti = async () => {
      try {
        const backendUrl = 'https://sopie-search-tool.onrender.com';
        // Gọi API lấy 20 tin gần nhất để đảm bảo tin Summary không bị trôi
        const res = await fetch(`${backendUrl}/api/get-latest-noti`);
        const data = await res.json();
        
        if (data.success && data.notis && Array.isArray(data.notis)) {
          const validNotis: any[] = [];
          const now = new Date();

          data.notis.forEach((noti: any) => {
            const notiIdStr = String(noti.id);
            // Nếu user đã tắt tin này rồi thì bỏ qua
            if (closedNotiIds.includes(notiIdStr)) return;

            const createdTime = new Date(noti.created_at);
            const timeStr = `${createdTime.getHours().toString().padStart(2, '0')}:${createdTime.getMinutes().toString().padStart(2, '0')}`;
            const dateStr = `${createdTime.getDate()}/${createdTime.getMonth() + 1}`;

            // --- LOGIC 1: TIN REALTIME (5 PHÚT) ---
            if (noti.type === 'realtime' || !noti.type) {
              const diffMinutes = (now.getTime() - createdTime.getTime()) / (1000 * 60);
              if (diffMinutes <= 5) { 
                validNotis.push({ ...noti, displayLabel: '⚡ TIN NÓNG', displayTime: timeStr });
              }
            }

            // --- LOGIC 2: TIN SUMMARY (TREO ĐẾN 14:35 HÔM SAU) ---
            else if (noti.type === 'summary') {
              // Regex tìm ngày trong nội dung tin: "ngày DD/MM/YYYY"
              const dateMatch = noti.message.match(/ngày (\d{1,2})\/(\d{1,2})\/(\d{4})/);
              if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1; 
                const year = parseInt(dateMatch[3]);
                
                // Ngày của bản tin
                const reportDate = new Date(year, month, day);
                
                // Hạn chót: Ngày hôm sau lúc 14:35
                const expiryDate = new Date(reportDate);
                expiryDate.setDate(expiryDate.getDate() + 1); 
                expiryDate.setHours(14, 35, 0, 0); 

                // Nếu hiện tại chưa đến hạn chót -> Hiển thị
                if (now < expiryDate) {
                  validNotis.push({ ...noti, displayLabel: '📅 BẢN TIN NGÀY', displayTime: dateStr });
                }
              }
            }
          });

          // Sắp xếp tin mới nhất lên đầu
          validNotis.sort((a, b) => b.id - a.id);
          setActiveNotis(validNotis);
        }
      } catch (e) {
        console.error("Noti Error:", e);
      }
    };

    checkNewNoti(); 
    const interval = setInterval(checkNewNoti, 30000); 
    return () => clearInterval(interval);
  }, [closedNotiIds]); 

  const handleCloseNoti = (e: React.MouseEvent, id: number | string) => {
    e.stopPropagation(); // Chặn click nhầm
    const idStr = String(id);
    
    if (!closedNotiIds.includes(idStr)) {
      const newClosed = [...closedNotiIds, idStr];
      setClosedNotiIds(newClosed);
      localStorage.setItem('sopie_closed_notis', JSON.stringify(newClosed));
      setActiveNotis(prev => prev.filter(n => String(n.id) !== idStr));
    }
  };

  if (activeNotis.length === 0) return null;

  return (
    // Position fixed, né Search Bar (top 360px), z-index cao nhất
    <div className="fixed left-6 top-[360px] z-[9999] flex flex-col gap-4 w-80 pointer-events-none font-sans">
      {activeNotis.map((n) => (
        <div key={n.id} className="pointer-events-auto animate-in slide-in-from-left-full duration-500 bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border-t-4 border-blue-500 overflow-hidden ring-1 ring-black/5 text-gray-900 dark:text-white transition-colors">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{n.type === 'summary' ? '📋' : '🔥'}</span>
                <h3 className="font-bold text-blue-700 dark:text-blue-400 text-sm uppercase">
                   {n.displayLabel}
                </h3>
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              </div>
              <button onClick={(e) => handleCloseNoti(e, n.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer">✕</button>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mb-3 border border-blue-100 dark:border-blue-800/50">
              <p className="text-xs whitespace-pre-line leading-relaxed italic font-medium">
                {n.message.replace(/"/g, '')}
              </p>
            </div>
            <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-400 font-medium italic">
                    {n.type === 'summary' ? `Ngày: ${n.displayTime}` : `Lúc: ${n.displayTime}`}
                </span>
                <div className="flex gap-2">
                    <button onClick={(e) => handleCloseNoti(e, n.id)} className="px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 cursor-pointer">Đã đọc</button>
                    <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" onClick={(e) => handleCloseNoti(e, n.id)} className="px-3 py-1.5 text-[11px] font-bold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-all cursor-pointer">Xem chi tiết</a>
                </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- HELPER FUNCTIONS ---
const formatDate = (dateString: string) => {
  try {
    const parts = dateString.split('-'); // YYYY-MM-DD
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch (e) { console.error("Lỗi format ngày:", e); }
  return dateString;
};

const LINKS = [
  { label: 'SOPie Index', icon: '📚', url: 'https://sites.google.com/view/cs-faq-chung/quy-%C4%91%E1%BB%8Bnh-chung', styleClass: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300' },
  { label: 'Bảng tin SOP', icon: '📅', url: 'https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0', styleClass: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { label: 'Theo dõi Issue', icon: '📋', url: 'https://docs.google.com/spreadsheets/d/1xUWGBiw9tBnZqrxjt4enL_oZ7LsU8QiWKhJOS5FbwrU/edit?gid=0#gid=0', styleClass: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300' },
  { label: 'Báo lỗi SOP', icon: '🐞', url: 'https://forms.gle/Hbjuzu7RwdhscNfW9', styleClass: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300' },
  { label: 'Đề xuất SOP', icon: '✨', url: 'https://forms.gle/rXZvHgfuLHMYQ7Wn6', styleClass: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300' },
  { label: 'CSWriteLab', icon: '✍️', url: 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab', styleClass: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300' }
]

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('all')
  const [searchType, setSearchType] = useState('ai')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Bổ sung state để quản lý Suggestion
  const [hasSearched, setHasSearched] = useState(false);
  const [backendSuggestion, setBackendSuggestion] = useState<any>(null);

  const [activeHxlTabs, setActiveHxlTabs] = useState<{[key: string]: 'cs1' | 'cs2'}>({})
  const [selectedSop, setSelectedSop] = useState<any | null>(null)
  const [activeSuggestionTab, setActiveSuggestionTab] = useState('All')

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('sopie_dark_mode') === 'true';
    setDarkMode(savedMode);
  }, []);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('sopie_dark_mode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Vui lòng nhập câu hỏi')
      return
    }

    if (searchType === 'keyword' && query.trim().split(' ').length > 5) {
      setError('Bạn đang ở chế độ tra cứu bằng từ khóa. Xin vui lòng nhập từ khóa hoặc bật chế độ tra cứu AI')
      return
    }

    setLoading(true); setError(''); setResults([]); setHasSearched(false); setBackendSuggestion(null); setSelectedSop(null); setActiveSuggestionTab('All'); 

    const backendUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : 'https://sopie-search-tool.onrender.com';
    
    try {
      const response = await fetch(`${backendUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          domain: domain === 'all' ? null : domain,
          type: searchType === 'ai' ? 'semantic' : 'keyword',
          limit: 10
        }),
      })

      const data = await response.json()
      if (data.success) {
        setHasSearched(true);
        if (data.suggestion) setBackendSuggestion(data.suggestion);

        if (data.results.length === 0 && !data.suggestion) {
          setError('Không tìm thấy SOP phù hợp. Vui lòng thử lại với từ khóa chi tiết hơn hoặc kiểm tra lại domain filter.')
        } else {
          setError('') 
        }
        
        const sortedResults = (data.results || []).sort((a: any, b: any) => b.relevance_score - a.relevance_score);
        setResults(sortedResults)

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
  }

  // --- LOGIC PHÂN LOẠI HIỂN THỊ ---
  const { top5Results, moreSuggestions } = useMemo(() => {
    // Logic: Luôn trả về 5 top và phần còn lại, bất kể điểm số (để hiện phần Gợi ý)
    const top = results.filter(r => r.relevance_score >= 0.8).slice(0, 5);
    const topIds = new Set(top.map(r => r.id));
    const suggestions = results.filter(r => !topIds.has(r.id));
    return { top5Results: top, moreSuggestions: suggestions };
  }, [results]);
  
  const SopDetailModal = () => {
    if (!selectedSop) return null
    const r = selectedSop
    const activeHxlLevel = activeHxlTabs[r.id] || 'cs1';
    const csWriteLabLink = 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab';

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm" onClick={() => setSelectedSop(null)}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative transition-colors duration-300 border border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSelectedSop(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex-1 pr-4">{r.title}</h3>
            <span className="px-4 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold whitespace-nowrap">{r.domain}</span>
          </div>

          {r.cause && (<div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-l-4 border-red-500"><strong className="text-red-700 dark:text-red-400 block mb-2">⚠️ Nguyên nhân:</strong><p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{r.cause}</p></div>)}

          {r.check_tools && r.check_tools.guideline && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-l-4 border-blue-500">
              <strong className="text-blue-700 dark:text-blue-400 block mb-2">🔧 Hướng dẫn kiểm tra tool:</strong>
              <p className="text-gray-800 dark:text-gray-200 mb-3 whitespace-pre-wrap break-words leading-relaxed">{r.check_tools.guideline}</p>
              {r.check_tools.name && r.check_tools.url && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {(() => {
                    const names = r.check_tools.name.split(',').map((n: string) => n.trim()).filter(Boolean)
                    const urls = r.check_tools.url.split(',').map((u: string) => u.trim()).filter(Boolean)
                    return names.map((name: string, index: number) => {
                      const url = urls[index] || urls[0]
                      return (<a key={index} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-lg text-sm font-medium transition-colors border border-blue-200 dark:border-blue-700">🔗 {name}</a>)
                    })
                  })()}
                </div>
              )}
            </div>
          )}
          
          {(r.solution?.level1 || r.solution?.level2) && (
            <div className="mb-4">
              <strong className="text-green-700 dark:text-green-400 block mb-3 text-base">✅ Hướng xử lý:</strong>
              <div className="flex gap-2 mb-3 border-b border-gray-200 dark:border-gray-700">
                <button onClick={() => setActiveHxlTabs({...activeHxlTabs, [r.id]: 'cs1'})} className={activeHxlLevel === 'cs1' ? 'px-4 py-2 font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'px-4 py-2 font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}>HXL CS1</button>
                {r.solution?.level2 && (<button onClick={() => setActiveHxlTabs({...activeHxlTabs, [r.id]: 'cs2'})} className={activeHxlLevel === 'cs2' ? 'px-4 py-2 font-semibold text-green-700 dark:text-green-400 border-b-2 border-green-600' : 'px-4 py-2 font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}>HXL CS2</button>)}
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-l-4 border-green-500">
                {activeHxlLevel === 'cs1' && r.solution?.level1 && (<p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">{r.solution.level1}</p>)}
                {activeHxlLevel === 'cs2' && r.solution?.level2 && (<p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">{r.solution.level2}</p>)}
              </div>
            </div>
          )}

          {r.notes && (<div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-l-4 border-yellow-500"><strong className="text-yellow-700 dark:text-yellow-400 block mb-2">📝 Lưu ý:</strong><p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">{r.notes}</p></div>)}

          {(r.templates && (r.templates.email || r.templates.chat)) || activeHxlLevel === 'cs2' ? (
            <div className="mb-4">
              {activeHxlLevel === 'cs1' && (r.templates.email || r.templates.chat) && (
                <>
                  <strong className="text-gray-700 dark:text-gray-300 block mb-3 text-base font-bold">Gợi ý phản hồi dành cho CS1:</strong>
                  {r.templates.email && (<details className="mb-3 group"><summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg list-none flex justify-between items-center transition-all"><span>📧 Template App/Mail</span><span className="transition-transform group-open:rotate-180">▼</span></summary><div className="mt-2 p-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{r.templates.email}</div></details>)}
                  {r.templates.chat && (<details className="mb-3 group"><summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg list-none flex justify-between items-center transition-all"><span>💬 Template Call/Chat</span><span className="transition-transform group-open:rotate-180">▼</span></summary><div className="mt-2 p-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{r.templates.chat}</div></details>)}
                </>
              )}
              {activeHxlLevel === 'cs2' && (<div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border-l-4 border-blue-500"><strong className="text-blue-700 dark:text-blue-400 block mb-2">💡 Gợi ý sau khi có kết quả BPLQ:</strong><p className="text-gray-800 dark:text-gray-200 leading-relaxed mb-3">Sau khi có kết quả từ BPLQ, CS có thể soạn thảo nhanh văn bản phản hồi với <a href={csWriteLabLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors">CSWriteLab ✍️</a></p></div>)}
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
            {r.link ? (<a href={r.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow transition-all">📄 Xem SOP gốc</a>) : (<div></div>)}
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Relevance: {Math.round(r.relevance_score * 100)}%</span>
          </div>
        </div>
      </div>
    )
  }

  const suggestionDomains = useMemo(() => {
    const domainCounts: {[key: string]: number} = {}
    moreSuggestions.forEach(r => { if (r.domain) { domainCounts[r.domain] = (domainCounts[r.domain] || 0) + 1 } })
    return Object.entries(domainCounts).sort(([, countA], [, countB]) => countB - countA).map(([domain]) => domain)
  }, [moreSuggestions])

  const filteredSuggestions = useMemo(() => {
    if (activeSuggestionTab === 'All') return moreSuggestions;
    return moreSuggestions.filter(r => r.domain === activeSuggestionTab)
  }, [moreSuggestions, activeSuggestionTab])

  const SopSummaryCard = ({ r, isTopMatch = false }: { r: any, isTopMatch?: boolean }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg p-6 transition-all cursor-pointer border-l-4 ${isTopMatch ? 'border-yellow-500' : 'border-blue-600'} transition-colors duration-300`} onClick={() => setSelectedSop(r)}>
      <div className="flex justify-between items-start mb-3">
        <h3 className={`font-bold text-gray-900 dark:text-white flex-1 pr-4 ${isTopMatch ? 'text-xl' : 'text-lg'}`}>{isTopMatch && '⭐ '} {r.title}</h3>
        <span className={`px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${isTopMatch ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'}`}>{r.domain}</span>
      </div>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{r.cause ? `Nguyên nhân: ${r.cause}` : (r.solution?.level1 ? r.solution.level1 : "Nhấp để xem chi tiết...")}</p>
      <div className="flex justify-between items-center text-sm">
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Cập nhật: {r.last_updated ? formatDate(r.last_updated) : 'N/A'}</span>
        <span className={`font-semibold ${isTopMatch ? 'text-yellow-700 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'}`}>⚡ {Math.round(r.relevance_score * 100)}% Match</span>
      </div>
    </div>
  )
  
  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <NotificationSystem darkMode={darkMode} />
      
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 py-6 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div className="text-center md:text-left"><h1 className="text-3xl font-bold text-gray-900 dark:text-white">FAQ Search Tool</h1><p className="text-sm text-gray-500 dark:text-gray-400">powered by SOPie</p></div>
            <div className="flex items-center gap-3">
              <button onClick={() => setDarkMode(!darkMode)} className={`flex items-center justify-center p-3 rounded-xl shadow-md transition-all duration-300 hover:scale-110 ${darkMode ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800 text-yellow-400'}`} title={darkMode ? "Bật chế độ sáng" : "Bật chế độ tối"}><span className="text-xl">{darkMode ? '☀️' : '🌙'}</span></button>
              <button onClick={() => setSearchType('ai')} className={`py-3 px-6 rounded-xl font-bold transition-all shadow-md ${searchType === 'ai' ? 'text-white bg-blue-600 hover:scale-105' : 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>🤖 AI Search</button>
              <button onClick={() => setSearchType('keyword')} className={`py-3 px-6 rounded-xl font-bold transition-all shadow-md ${searchType === 'keyword' ? 'text-white bg-green-500 hover:scale-105' : 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>🔑 Key Search</button>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 text-center md:text-left">Quick Buttons</p>
            <div className="flex items-center overflow-x-auto pb-2 md:pb-0 scrollbar-hide"><div className="flex flex-nowrap justify-between gap-3 w-full min-w-max md:min-w-0">{LINKS.map((link, index) => (<a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs md:text-sm transition-all shadow-sm hover:shadow-md whitespace-nowrap ${link.styleClass}`}><span className="text-base md:text-lg">{link.icon}</span><span>{link.label}</span></a>))}</div></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 transition-colors duration-300 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white md:min-w-[200px] font-medium focus:border-blue-500 focus:outline-none transition-colors"><option value="all">Tất cả</option><option value="Account">Tài khoản</option><option value="Payment">Thanh toán</option><option value="Application">Ứng dụng</option><option value="Merchant">Đối tác</option><option value="Lending">DVTC</option><option value="Travel">OTA</option></select>
            <input type="text" placeholder={searchType === 'ai' ? 'Nhập câu hỏi của bạn...' : 'Nhập từ khóa ngắn gọn...'} value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 px-5 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400"/>
            <button onClick={handleSearch} disabled={loading} className={loading ? 'px-8 py-4 rounded-xl font-bold text-white bg-gray-400 cursor-not-allowed' : searchType === 'ai' ? 'px-8 py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md' : 'px-8 py-4 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 shadow-md'}>{loading ? '🔄 Đang tìm...' : '🔍 Tìm kiếm'}</button>
          </div>
          
          {searchType === 'keyword' && (<p className="text-sm text-gray-500 dark:text-gray-400 mb-3">💡 Mẹo: Key Search hoạt động tốt nhất với từ khóa ngắn gọn (1-5 từ). Dùng AI Search cho câu hỏi dài.</p>)}

          {hasSearched && !loading && results.length === 0 && (
            <div className="mt-6 p-6 bg-amber-50 dark:bg-amber-900/20 border-l-8 border-amber-500 rounded-xl text-amber-900 dark:text-amber-200 animate-fade-in transition-all">
              <div className="flex items-start gap-4"><div className="text-2xl mt-1">💡</div><div className="space-y-3"><p className="font-bold text-base">Chưa có kết quả có độ tương thích cao, bạn vui lòng thử:</p><ul className="list-disc list-inside text-sm space-y-2 font-medium opacity-90"><li>Mô tả lại vấn đề một cách chi tiết hơn</li><li>Điều chỉnh lại bộ lọc kiến thức</li>{backendSuggestion?.link && (<li className="list-none pt-2 flex items-center gap-2"><span>Tham khảo thêm tại:</span><a href={backendSuggestion.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-black shadow-sm hover:scale-105 transition-all">🔗 {backendSuggestion.link_label || 'Link gợi ý'}</a></li>)}</ul><p className="text-sm font-bold pt-2 border-t border-amber-200 dark:border-amber-800/50">Hoặc bạn có thể liên hệ trực tiếp QC để được hỗ trợ nhanh chóng.</p></div></div>
            </div>
          )}

          {error && (<div className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-lg animate-fade-in transition-colors"><div className="flex items-start gap-3"><div className="text-xl">⚠️</div><div><strong>{error}</strong>{error.includes('Không tìm thấy') && (<ul className="list-disc list-inside mt-2 text-sm space-y-1"><li>Thử mô tả chi tiết hơn vấn đề</li><li>Kiểm tra lại domain filter</li><li>Liên hệ QC để được hỗ trợ nhanh chóng</li></ul>)}</div></div></div>)}
        </div>

        {!loading && results.length > 0 && (
          <div className="mt-8 animate-slide-up">
            <div className="flex items-center justify-between mb-6"><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tìm thấy {results.length} kết quả</h2><span className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium border border-gray-200 dark:border-gray-700">{searchType === 'ai' ? '🤖 AI Search' : '🔑 Key Search'}</span></div>
            {top5Results.length > 0 && (<div className="mb-12"><h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-yellow-400 inline-block pr-8">🏆 Top {top5Results.length} Kết quả hàng đầu</h3><div className="space-y-4">{top5Results.map((r) => (<SopSummaryCard key={r.id} r={r} isTopMatch={true} />))}</div></div>)}
            {moreSuggestions.length > 0 && (<div><h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-300 dark:border-gray-700 inline-block pr-8">📑 Gợi ý thêm ({moreSuggestions.length} SOPs)</h3><div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide"><button onClick={() => setActiveSuggestionTab('All')} className={`px-4 py-2 font-semibold rounded-lg transition-colors ${activeSuggestionTab === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Tất cả ({moreSuggestions.length})</button>{suggestionDomains.map(domain => (<button key={domain} onClick={() => setActiveSuggestionTab(domain)} className={`px-4 py-2 font-semibold rounded-lg whitespace-nowrap transition-colors ${activeSuggestionTab === domain ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{domain} ({moreSuggestions.filter(r => r.domain === domain).length})</button>))}</div><div className="space-y-4">{filteredSuggestions.map(r => (<SopSummaryCard key={r.id} r={r} isTopMatch={false} />))}</div></div>)}
          </div>
        )}
      </div>
      <SopDetailModal />
    </div>
  )
}