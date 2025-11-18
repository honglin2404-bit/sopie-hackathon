'use client'

import { useState, useMemo } from 'react'

export default function Home() {
  console.log("VERCEL BUILD MOI NHAT DA CHAY!");

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
      setError('Vui long nhap cau hoi')
      return
    }

    if (searchType === 'keyword' && query.trim().split(' ').length > 5) {
      setError('Ban dang o che do tra cuu bang tu khoa. Xin vui long nhap tu khoa hoac bat che do tra cuu AI')
      return
    }

    setLoading(true)
    setError('')
    setResults([])
    setSelectedSop(null) 
    setActiveSuggestionTab('All') 

    // === FIX BACKEND URL - LOGIC MOI ===
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const backendUrl = isLocalhost 
      ? 'http://localhost:5000' 
      : 'https://sopie-search-tool.onrender.com';

    console.log("=== BACKEND CONNECTION DEBUG ===");
    console.log("Current hostname:", typeof window !== 'undefined' ? window.location.hostname : 'SSR');
    console.log("Is localhost:", isLocalhost);
    console.log("Backend URL:", backendUrl);
    console.log("================================");
    // ===================================

    try {
      console.log("Fetching:", `${backendUrl}/api/search`);
      
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

      console.log("Response status:", response.status);
      console.log("Response OK:", response.ok);

      const data = await response.json()
      console.log("Response data:", data);

      if (data.success) {
        if (data.results.length === 0) {
          setError('Khong tim thay SOP phu hop. Vui long thu lai voi tu khoa chi tiet hon hoac kiem tra lai domain filter.')
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
        setError('Khong tim thay ket qua')
      }
    } catch (err) {
      console.error("=== ERROR DETAILS ===");
      console.error("Error:", err);
      setError('Khong the ket noi backend. Vui long kiem tra server.')
    } finally {
      setLoading(false)
    }
  }

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
          
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-2xl font-bold text-gray-900 flex-1 pr-4">{r.title}</h3>
            <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold whitespace-nowrap">
              {r.domain}
            </span>
          </div>

          {r.cause && (
            <div className="mb-4 p-4 bg-red-50 rounded-xl border-l-4 border-red-500">
              <strong className="text-red-700 block mb-2">Nguyen nhan:</strong>
              <p className="text-gray-800 leading-relaxed">{r.cause}</p>
            </div>
          )}
          
          {r.check_tools && r.check_tools.guideline && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
              <strong className="text-blue-700 block mb-2">Check Tool:</strong>
              <p className="text-gray-800 mb-2">{r.check_tools.guideline}</p>
              {r.check_tools.name && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Tool: {r.check_tools.name}</span>
                  {r.check_tools.url && (
                    <a href={r.check_tools.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      Link
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {(r.solution?.level1 || r.solution?.level2) && (
            <div className="mb-4">
              <strong className="text-green-700 block mb-3 text-base">Huong xu ly:</strong>
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

          {r.notes && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-xl border-l-4 border-yellow-500">
              <strong className="text-yellow-700 block mb-2">Luu y:</strong>
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">{r.notes}</p>
            </div>
          )}

          {r.templates && r.templates.email && (
            <details className="mb-3">
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-blue-600 p-3 bg-gray-50 rounded-lg">
                Template Email/App
              </summary>
              <div className="mt-2 p-4 bg-white border-2 border-gray-200 rounded-lg text-sm text-gray-800 whitespace-pre-line">
                {r.templates.email}
              </div>
            </details>
          )}
          {r.templates && r.templates.chat && (
            <details className="mb-3">
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-blue-600 p-3 bg-gray-50 rounded-lg">
                Template Call/Chat
              </summary>
              <div className="mt-2 p-4 bg-white border-2 border-gray-200 rounded-lg text-sm text-gray-800 whitespace-pre-line">
                {r.templates.chat}
              </div>
            </details>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
            {r.link ? (
              <a
                href={r.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow transition-all"
              >
                Xem SOP goc
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
          {isTopMatch && 'Top '} {r.title}
        </h3>
        <span className={`px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${isTopMatch ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-700'}`}>
          {r.domain}
        </span>
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {r.cause ? `Nguyen nhan: ${r.cause}` : (r.solution?.level1 ? r.solution.level1 : "Nhap de xem chi tiet...")}
      </p>

      <div className="flex justify-between items-center text-sm">
        <span className="text-xs text-gray-400 font-medium">
          Cap nhat: 17/11/2024
        </span>
        <span className={`font-semibold ${isTopMatch ? 'text-yellow-700' : 'text-blue-600'}`}>
          {Math.round(r.relevance_score * 100)}% Match
        </span>
      </div>
    </div>
  )
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b py-6">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">FAQ Search Tool</h1>
            <p className="text-sm text-gray-500">powered by SOPie</p>
          </div>
          <div className="flex gap-3">
            {searchType === 'ai' ? (
              <button onClick={() => setSearchType('ai')} className="py-3 px-6 rounded-xl font-bold text-white bg-blue-600 shadow-md">
                AI Search
              </button>
            ) : (
              <button onClick={() => setSearchType('ai')} className="py-3 px-6 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                AI Search
              </button>
            )}
            {searchType === 'keyword' ? (
              <button onClick={() => setSearchType('keyword')} className="py-3 px-6 rounded-xl font-bold text-white bg-green-500 shadow-md">
                Key Search
              </button>
            ) : (
              <button onClick={() => setSearchType('keyword')} className="py-3 px-6 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Key Search
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex gap-3 mb-4">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="px-5 py-4 border-2 border-gray-300 rounded-xl bg-white min-w-[200px] font-medium"
            >
              <option value="all">Tat ca</option>
              <option value="Account">Tai khoan</option>
              <option value="General">Thanh toan</option>
              <option value="Lending">Ung dung</option>
              <option value="Merchant">Merchant</option>
              <option value="Promotion">Khuyen Mai</option>
              <option value="Travelling">DVTC</option>
            </select>
            <input
              type="text"
              placeholder={searchType === 'ai' ? 'Nhap cau hoi cua ban...' : 'Nhap tu khoa ngan gon...'}
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
              {loading ? 'Dang tim...' : 'Tim kiem'}
            </button>
          </div>
          {searchType === 'keyword' && (
            <p className="text-sm text-gray-500 mb-3">
              Meo: Key Search hoat dong tot nhat voi tu khoa ngan gon (1-5 tu). Dung AI Search cho cau hoi dai.
            </p>
          )}
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              <strong>Loi: </strong>{error}
              {error.includes('Khong tim thay') && (
                <ul className="list-disc list-inside mt-2 text-sm">
                  <li>Thu mo ta chi tiet hon van de</li>
                  <li>Kiem tra lai domain filter</li>
                  <li>Lien he Shift Lead neu can ho tro</li>
                </ul>
              )}
            </div>
          )}
        </div>

        {!loading && results.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Tim thay {results.length} ket qua</h2>
              <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {searchType === 'ai' ? 'AI Search' : 'Key Search'}
              </span>
            </div>

            <div className="mb-12">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-yellow-400">
                Top {top5Results.length} Ket qua hang dau
              </h3>
              <div className="space-y-4">
                {top5Results.map((r, index) => (
                  <SopSummaryCard key={r.id} r={r} isTopMatch={true} />
                ))}
              </div>
            </div>

            {moreSuggestions.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
                  Goi y them ({moreSuggestions.length} SOPs)
                </h3>
                
                <div className="flex gap-2 mb-4 overflow-x-auto">
                  <button
                    onClick={() => setActiveSuggestionTab('All')}
                    className={`px-4 py-2 font-semibold rounded-lg ${activeSuggestionTab === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    Tat ca ({moreSuggestions.length})
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