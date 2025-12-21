'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'

// --- HELPER FUNCTIONS ---
const formatDate = (dateString: string) => {
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch (e) {}
  return dateString;
};

// 3. CHECKLIST: 6 QUICK BUTTONS TRẢI ĐỀU
const LINKS = [
  { label: 'SOPie Index', icon: '📚', url: 'https://sites.google.com/view/cs-faq-chung/quy-%C4%91%E1%BB%8Bnh-chung', styleClass: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300' },
  { label: 'Bảng tin SOP', icon: '📅', url: 'https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0', styleClass: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { label: 'Theo dõi Issue', icon: '📋', url: 'https://docs.google.com/spreadsheets/d/1xUWGBiw9tBnZqrxjt4enL_oZ7LsU8QiWKhJOS5FbwrU/edit?gid=0#gid=0', styleClass: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300' },
  { label: 'Báo lỗi SOP', icon: '🐞', url: 'https://forms.gle/Hbjuzu7RwdhscNfW9', styleClass: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300' },
  { label: 'Đề xuất SOP', icon: '✨', url: 'https://forms.gle/rXZvHgfuLHMYQ7Wn6', styleClass: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300' },
  { label: 'CSWriteLab AI', icon: '✍️', url: 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab', styleClass: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md scale-105 transition-all' }
]

// --- NOTIFICATION SYSTEM (BẢN TIN GIAO CA & TIN MỚI) ---
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
          
          if (isFirstLoad.current) {
            if (lastSeenId !== newId.toString()) {
              setNotifications([{ ...data.noti, displayTime: timeStr }]);
            }
            lastIdRef.current = newId;
            isFirstLoad.current = false;
            return;
          }
          if (lastIdRef.current !== null && newId > lastIdRef.current) {
            setNotifications(prev => [{ ...data.noti, displayTime: timeStr }, ...prev]);
            lastIdRef.current = newId;
          }
        }
      } catch (e) {}
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
        <div key={n.id} className="pointer-events-auto animate-in slide-in-from-left-full duration-500 bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border-t-4 border-blue-500 overflow-hidden ring-1 ring-black/5">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">!*</span>
                <h3 className="font-bold text-blue-700 dark:text-blue-400 text-sm uppercase tracking-tight">Cập nhật tin mới</h3>
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mb-3 border border-blue-100 dark:border-blue-800/50">
              <p className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-line font-medium font-sans italic leading-relaxed">"{n.message}"</p>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-gray-400 font-medium italic">Lúc: {n.displayTime}</span>
              <div className="flex gap-2">
                <button onClick={() => handleCloseNoti(n.id)} className="px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Bỏ qua</button>
                <a href={SHEET_URL} target="_blank" onClick={() => handleCloseNoti(n.id)} className="px-3 py-1.5 text-[11px] font-bold bg-blue-600 text-white rounded-lg shadow-sm">Xem ngay</a>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- SOP CARD & MODAL ---
const SopSummaryCard = ({ r, isTopMatch = false, onClick }: { r: any, isTopMatch?: boolean, onClick: () => void }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg p-6 transition-all cursor-pointer border-l-4 ${isTopMatch ? 'border-yellow-500 ring-2 ring-yellow-50' : 'border-blue-600'}`} onClick={onClick}>
    <div className="flex justify-between items-start mb-3">
      <h3 className={`font-bold text-gray-900 dark:text-white flex-1 pr-4 ${isTopMatch ? 'text-xl' : 'text-lg'}`}>{isTopMatch && '⭐ '} {r.title}</h3>
      <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{r.domain}</span>
    </div>
    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2 italic">{r.cause ? `Nguyên nhân: ${r.cause}` : (r.solution?.level1 || "Nhấp để xem chi tiết...")}</p>
    <div className="flex justify-between items-center text-sm">
      <span className="text-[11px] text-gray-400 italic">Cập nhật: {r.last_updated ? formatDate(r.last_updated) : 'N/A'}</span>
      <span className="font-bold text-blue-600">⚡ {Math.round(r.relevance_score * 100)}% Match</span>
    </div>
  </div>
);

const SopDetailModal = ({ sop, onClose, activeHxlTabs, setActiveHxlTabs }: { sop: any, onClose: () => void, activeHxlTabs: any, setActiveHxlTabs: any }) => {
  if (!sop) return null;
  const activeHxlLevel = activeHxlTabs[sop.id] || 'cs1';
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors">✕</button>
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold pr-6">{sop.title}</h3>
          <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full font-bold whitespace-nowrap">{sop.domain}</span>
        </div>
        {sop.cause && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-l-4 border-red-500 font-medium italic">⚠️ {sop.cause}</div>}
        <div className="mb-6">
          <div className="flex gap-2 mb-3 border-b border-gray-200">
            <button onClick={() => setActiveHxlTabs({...activeHxlTabs, [sop.id]: 'cs1'})} className={`px-4 py-2 transition-all ${activeHxlLevel === 'cs1' ? 'font-bold border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>CS1 (Cấp 1)</button>
            {sop.solution?.level2 && <button onClick={() => setActiveHxlTabs({...activeHxlTabs, [sop.id]: 'cs2'})} className={`px-4 py-2 transition-all ${activeHxlLevel === 'cs2' ? 'font-bold border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>CS2 (Cấp 2)</button>}
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border-l-4 border-green-500 whitespace-pre-line text-sm leading-relaxed">{activeHxlLevel === 'cs1' ? sop.solution.level1 : sop.solution.level2}</div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-4 pt-6 border-t border-gray-100">
          <a href="https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab" target="_blank" className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-center shadow-lg hover:scale-[1.01] transition-all">✍️ Soạn phản hồi với CSWriteLab AI</a>
          <div className="flex justify-between w-full items-center">
             {sop.link && <a href={sop.link} target="_blank" className="text-blue-600 font-bold text-sm underline hover:text-blue-800">📄 Xem bản SOP đầy đủ</a>}
             <span className="text-[11px] text-gray-400 italic">Độ tin cậy: {Math.round(sop.relevance_score * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
export default function Home() {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('all'); // 4. CHECKLIST: BỘ FILTER DOMAIN
  const [searchType, setSearchType] = useState('ai'); // 1. CHECKLIST: AI SEARCH BUTTON
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeHxlTabs, setActiveHxlTabs] = useState<any>({});
  const [selectedSop, setSelectedSop] = useState<any | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false); // 2. CHECKLIST: DARK MODE BUTTON
  const [backendSuggestion, setBackendSuggestion] = useState<any>(null);

  useEffect(() => { if (localStorage.getItem('sopie_dark_mode') === 'true') setIsDarkMode(true); }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults([]); setHasSearched(false); setBackendSuggestion(null);
    try {
      const response = await fetch('https://sopie-search-tool.onrender.com/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, domain: domain === 'all' ? null : domain, type: searchType === 'ai' ? 'semantic' : 'keyword', limit: 30 }),
      });
      const data = await response.json();
      if (data.success) {
        setResults(data.results); setHasSearched(true);
        if (data.suggestion) setBackendSuggestion(data.suggestion);
        const tabs: any = {}; data.results.forEach((r: any) => tabs[r.id] = 'cs1'); setActiveHxlTabs(tabs);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  // 6. CHECKLIST: USE CASE OUTPUT 2 (KHÔNG CÓ SOP TRÊN 80%)
  const SuggestionBox = () => (
    <div className="mb-8 p-8 bg-red-50 dark:bg-red-900/20 border-2 border-dashed border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 animate-in fade-in">
        <div className="flex items-start gap-4">
            <div className="text-3xl">⚠️</div>
            <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">Chưa có SOP có độ tương thích cao. Bạn vui lòng thử:</h3>
                <ul className="list-disc list-inside text-sm space-y-2 mb-6 font-medium">
                    <li>Thay đổi cách diễn đạt câu hỏi</li>
                    <li>Điều chỉnh lại bộ filter kiến thức</li>
                    {backendSuggestion?.found && (
                      <li>Tham khảo thêm quy trình tại: <a href={backendSuggestion.link} target="_blank" className="text-blue-600 underline font-bold">{backendSuggestion.link_label}</a></li>
                    )}
                </ul>
                <p className="text-sm font-bold border-t border-red-200 pt-4 font-sans italic">Hoặc bạn có thể liên hệ QC team để được hỗ trợ chi tiết.</p>
            </div>
        </div>
    </div>
  );

  // 5. CHECKLIST: USE CASE OUTPUT 1 (PHÂN LOẠI TOP MATCH 5 - GỢI Ý 10)
  const topMatches = useMemo(() => results.filter(r => r.relevance_score >= 0.8).slice(0, 5), [results]);
  const otherMatches = useMemo(() => results.filter(r => r.relevance_score < 0.8).slice(0, 10), [results]);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <NotificationSystem />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="bg-white dark:bg-gray-800 border-b shadow-sm sticky top-0 z-[100]">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center mb-6">
              <div><h1 className="text-2xl font-bold text-blue-600">SOPie Search Tool</h1><p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">powered by SOPie</p></div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsDarkMode(!isDarkMode); localStorage.setItem('sopie_dark_mode', String(!isDarkMode)); }} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl">{isDarkMode ? '🌞' : '🌙'}</button>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                  <button onClick={() => setSearchType('ai')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${searchType === 'ai' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>🤖 AI Search</button>
                  <button onClick={() => setSearchType('keyword')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${searchType === 'keyword' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>🔑 Key Search</button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {LINKS.map((link, i) => (
                <a key={i} href={link.url} target="_blank" className={`flex items-center justify-center gap-2 px-2 py-3 rounded-xl font-bold text-[11px] shadow-sm transition-all active:scale-95 ${link.styleClass}`}>
                  <span>{link.icon}</span><span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 mb-10 border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row gap-4">
              <select value={domain} onChange={(e) => setDomain(e.target.value)} className="px-5 py-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900 font-bold focus:border-blue-500 outline-none text-sm">
                <option value="all">Tất cả Domain</option>
                <option value="Account">Tài khoản</option>
                <option value="Payment">Thanh toán</option>
                <option value="Application">Ứng dụng</option>
                <option value="Merchant">Đối tác</option>
                <option value="Lending">DVTC</option>
                <option value="Travel">OTA</option>
              </select>
              <input type="text" placeholder="Bạn muốn tra cứu gì hôm nay?" value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 px-6 py-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900 outline-none focus:border-blue-500 font-medium transition-all" />
              <button onClick={handleSearch} disabled={loading} className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all disabled:opacity-50">{loading ? 'Đang tìm...' : '🔍 Tìm ngay'}</button>
            </div>
          </div>

          {hasSearched && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              {topMatches.length > 0 ? (
                <div className="space-y-6">
                  <div className="space-y-4">{topMatches.map(r => <SopSummaryCard key={r.id} r={r} isTopMatch={true} onClick={() => setSelectedSop(r)} />)}</div>
                  {otherMatches.length > 0 && (
                    <div className="pt-8 border-t border-gray-200 dark:border-gray-700 mt-10">
                      <h3 className="text-md font-bold mb-6 flex items-center gap-2 text-gray-500 uppercase tracking-widest px-2 font-sans italic">Gợi ý thêm (Tối đa 10 SOPs)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{otherMatches.map(r => <SopSummaryCard key={r.id} r={r} onClick={() => setSelectedSop(r)} />)}</div>
                    </div>
                  )}
                </div>
              ) : <SuggestionBox />}
            </div>
          )}
        </div>
        <SopDetailModal sop={selectedSop} onClose={() => setSelectedSop(null)} activeHxlTabs={activeHxlTabs} setActiveHxlTabs={setActiveHxlTabs} />
      </div>
    </div>
  );
}