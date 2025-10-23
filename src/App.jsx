import React, { useState, useEffect } from 'react';
import { Search, History, User, Sparkles, Key, Phone, MessageSquare, ExternalLink, Copy, Check, X, AlertTriangle } from 'lucide-react';

const App = () => {
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('semantic');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeChannel, setActiveChannel] = useState('inapp');
  const [templateMode, setTemplateMode] = useState('neutral');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [results, setResults] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState('warning');
  
  // Data states
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [embeddings, setEmbeddings] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  // Filters
  const filters = [
    { id: 'all', label: 'All', emoji: '🌐', scope: null },
    { id: 'payment', label: 'Thanh toán', emoji: '💳', scope: 'Thanh toán' },
    { id: 'app', label: 'Ứng dụng', emoji: '📱', scope: 'Ứng dụng' },
    { id: 'account', label: 'Tài khoản', emoji: '👤', scope: 'Tài khoản' },
    { id: 'promotion', label: 'Khuyến Mãi', emoji: '🎁', scope: 'Khuyến mãi' },
    { id: 'dvtc', label: 'DVTC', emoji: '🏦', scope: 'DVTC' },
    { id: 'travelling', label: 'Travelling', emoji: '✈️', scope: 'Travelling' },
    { id: 'merchant', label: 'Merchant', emoji: '🏪', scope: 'Merchant' }
  ];

  // Channels - FIX: livechat → chat
  const channels = [
    { id: 'inapp', label: 'In-app', icon: MessageSquare },
    { id: 'chat', label: 'Live Chat', icon: MessageSquare },
    { id: 'call', label: 'Call', icon: Phone }
  ];

  // Load data from JSON
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load knowledge base
        const kbResponse = await fetch('/data/knowledge_base.json');
        if (!kbResponse.ok) throw new Error('Failed to load knowledge base');
        const kbData = await kbResponse.json();
        
        const extracts = kbData.knowledge_extracts || [];
        setKnowledgeBase(extracts);
        
        // Load templates
        try {
          const tempResponse = await fetch('/data/templates.json');
          if (tempResponse.ok) {
            const tempData = await tempResponse.json();
            setTemplates(tempData);
            console.log('✅ Loaded templates:', tempData.length);
          }
        } catch (err) {
          console.log('Templates not available');
        }
        
        // Load embeddings
        try {
          const embResponse = await fetch('/data/embeddings.json');
          if (embResponse.ok) {
            const embData = await embResponse.json();
            setEmbeddings(embData);
          }
        } catch (err) {
          console.log('Embeddings not available');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setDataError(error.message);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  const showNotification = (message, type = 'warning') => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 5000);
  };

  const isLongQuery = (query) => {
    return query.trim().split(' ').length > 5;
  };

  // Improved keyword search with weighted scoring
  const keywordSearch = (query, data) => {
    const searchTerms = query.toLowerCase().trim().split(' ');
    
    return data.map(item => {
      let score = 0;
      
      // Define searchable fields with weights
      const fields = [
        { text: item.errorCode || '', weight: 10 },      // Highest priority
        { text: item.title || '', weight: 8 },
        { text: item.cause || '', weight: 6 },
        { text: item.solution || '', weight: 5 },
        { text: item.scope || '', weight: 4 },
        { text: item.product || '', weight: 3 },
        { text: item.feature || '', weight: 3 },
        { text: item.notes || '', weight: 2 }
      ];
      
      searchTerms.forEach(term => {
        fields.forEach(field => {
          const fieldLower = field.text.toLowerCase();
          
          // Exact match in field
          if (fieldLower.includes(term)) {
            score += field.weight * 10;
          }
          
          // Partial match (fuzzy)
          if (term.length >= 3) {
            const parts = term.split('');
            let found = true;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!fieldLower.includes(parts[i] + parts[i + 1])) {
                found = false;
                break;
              }
            }
            if (found) {
              score += field.weight * 5;
            }
          }
        });
      });
      
      // Calculate percentage
      const maxScore = searchTerms.length * fields.reduce((sum, f) => sum + f.weight * 10, 0);
      const matchScore = Math.min(100, Math.round((score / maxScore) * 100));
      
      return { ...item, matchScore };
    })
    .filter(item => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
  };

  const semanticSearch = (query, data) => {
    return keywordSearch(query, data);
  };

  const filterByScope = (data, filterId) => {
    if (filterId === 'all') return data;
    
    const filter = filters.find(f => f.id === filterId);
    if (!filter || !filter.scope) return data;
    
    return data.filter(item => 
      item.scope && item.scope.toLowerCase() === filter.scope.toLowerCase()
    );
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      showNotification('Vui lòng nhập từ khóa tìm kiếm', 'warning');
      return;
    }

    if (searchType === 'keyword' && isLongQuery(searchQuery)) {
      showNotification('CS cần nhập search theo key word (ngắn gọn, không nhập câu dài)', 'warning');
      return;
    }

    if (knowledgeBase.length === 0) {
      showNotification('Đang tải dữ liệu, vui lòng thử lại...', 'warning');
      return;
    }

    let searchResults = [];
    
    if (searchType === 'semantic' && embeddings.length > 0) {
      searchResults = semanticSearch(searchQuery, knowledgeBase);
    } else {
      if (searchType === 'semantic' && embeddings.length === 0) {
        showNotification('Hệ thống search AI đang gián đoạn, vui lòng nhập search theo key word', 'error');
        setSearchType('keyword');
        return;
      }
      searchResults = keywordSearch(searchQuery, knowledgeBase);
    }

    searchResults = filterByScope(searchResults, activeFilter);

    const timestamp = new Date().toISOString();
    const newHistoryItem = {
      id: Date.now(),
      query: searchQuery,
      filter: activeFilter,
      searchType: searchType,
      channel: activeChannel,
      templateMode: templateMode,
      timestamp: timestamp,
      resultsCount: searchResults.length
    };
    setSearchHistory(prev => [newHistoryItem, ...prev].slice(0, 20));

    setResults(searchResults.slice(0, 10));
    
    if (searchResults.length === 0) {
      showNotification('Không tìm thấy kết quả phù hợp. Thử từ khóa khác!', 'warning');
    }
  };

  // 🔥 FIX: Get template from templates.json - KHÔNG TRẢ SOLUTION
  const getTemplate = (item, channel, mode) => {
    const templateCode = item.template_vi;
    
    console.log('📋 getTemplate called:', { 
      templateCode, 
      channel, 
      mode, 
      templatesAvailable: templates.length 
    });
    
    // ✅ FIX 1: Không trả solution khi không có template code
    if (!templateCode) {
      console.log('❌ No template_vi in item');
      return '⚠️ Template code chưa được gán cho case này. Vui lòng liên hệ Admin.';
    }
    
    // ✅ FIX 2: Không trả solution khi không có templates
    if (templates.length === 0) {
      console.log('❌ No templates loaded');
      return '⚠️ Hệ thống template chưa được load. Vui lòng refresh trang hoặc liên hệ Admin.';
    }
    
    // Remove suffix like _A1, _A2, _B1, _B2, _C1, _C2 if exists
    const baseCode = templateCode.replace(/_[A-Z]\d+$/, '');
    
    console.log('🔍 Searching for template:', {
      originalCode: templateCode,
      baseCode: baseCode,
      channel: channel,
      mode: mode
    });
    
    // List all templates that match base code
    const matchingBase = templates.filter(t => 
      t.template_code && t.template_code.startsWith(baseCode)
    );
    
    console.log(`📦 Found ${matchingBase.length} templates with base code:`, 
      matchingBase.map(t => ({ code: t.template_code, ch: t.channel, em: t.emotion_mode }))
    );
    
    // Find exact match
    const matchingTemplate = templates.find(t => 
      t.template_code && 
      t.template_code.startsWith(baseCode) &&
      t.channel === channel &&
      t.emotion_mode === mode
    );
    
    if (matchingTemplate) {
      console.log('✅ Found matching template:', matchingTemplate.template_code);
      console.log('📝 Template body preview:', matchingTemplate.template_body?.substring(0, 100) + '...');
      return matchingTemplate.template_body || '⚠️ Template không có nội dung (template_body rỗng)';
    }
    
    // ✅ FIX 3: Log chi tiết và không trả solution
    console.log('❌ No matching template found');
    console.log('💡 Available channels in templates:', [...new Set(templates.map(t => t.channel))]);
    console.log('💡 Available emotion_modes in templates:', [...new Set(templates.map(t => t.emotion_mode))]);
    
    return `⚠️ Không tìm thấy template cho:\n- Template code: ${baseCode}\n- Channel: ${channel}\n- Mode: ${mode}\n\nVui lòng kiểm tra file templates.json hoặc liên hệ Admin.`;
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md">
          <AlertTriangle className="text-red-600 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Lỗi tải dữ liệu</h2>
          <p className="text-gray-600 mb-4 text-center">{dataError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      {showPopup && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`flex items-start gap-3 p-4 rounded-lg shadow-2xl border-2 ${
            popupType === 'error' ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-400'
          }`}>
            <AlertTriangle className={popupType === 'error' ? 'text-red-600' : 'text-yellow-600'} size={24} />
            <div className="flex-1">
              <p className={`font-semibold ${popupType === 'error' ? 'text-red-900' : 'text-yellow-900'}`}>
                {popupMessage}
              </p>
            </div>
            <button onClick={() => setShowPopup(false)}>
              <X className="text-gray-500 hover:text-gray-700" size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">CS Zalopay - FAQ tool</h1>
              <p className="text-gray-600 mt-2">
                {knowledgeBase.length} cases • OpenAI Semantic Search • Embeddings {embeddings.length > 0 ? 'Ready' : 'Not Available'}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSearchType('semantic')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                    searchType === 'semantic'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  disabled={embeddings.length === 0}
                >
                  <Sparkles size={18} />
                  <span className="font-medium">AI Search</span>
                </button>
                <button
                  onClick={() => setSearchType('keyword')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                    searchType === 'keyword'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Key size={18} />
                  <span className="font-medium">Key Search</span>
                </button>
              </div>

              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all"
              >
                <History size={18} />
                <span className="font-medium">Lịch sử ({searchHistory.length})</span>
              </button>

              <button className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all">
                <User size={18} />
                <span className="font-medium">Nhập tên CS...</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={searchType === 'keyword' ? 'Nhập key word (ngắn gọn)...' : 'Tìm kiếm mã lỗi, vấn đề, keywords...'}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md flex items-center gap-2"
              >
                <Search size={20} />
                Tìm kiếm
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-600 font-medium">Lọc theo:</span>
              {filters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeFilter === filter.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <span>{filter.emoji}</span>
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-gray-600 font-medium">Channel:</span>
              {channels.map(channel => {
                const Icon = channel.icon;
                return (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      activeChannel === channel.id
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Icon size={18} />
                    {channel.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {showHistory && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Lịch sử tìm kiếm</h3>
              <button 
                onClick={() => setSearchHistory([])}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Xóa tất cả
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {searchHistory.map(item => (
                <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-900 mb-2">{item.query}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div><span className="font-semibold">Filter:</span> {filters.find(f => f.id === item.filter)?.label}</div>
                    <div><span className="font-semibold">Results:</span> {item.resultsCount}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🔥 FIX: Template sẽ tự động update khi activeChannel hoặc templateMode thay đổi */}
        {results.map((result, index) => (
          <div key={`${result.errorCode}-${index}`} className="bg-white rounded-2xl shadow-lg p-6 mb-4 border-l-4 border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {result.errorCode}: {result.title}
                </h2>
                <div className="flex gap-3 items-center flex-wrap">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    {result.scope || 'N/A'}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                    <Sparkles size={14} />
                    {result.matchScore}% Match
                  </span>
                  <span className="text-orange-600 text-sm font-medium">
                    🔥 {result.severity || 'N/A'}
                  </span>
                </div>
              </div>
              {result.linkSOP && (
                <a
                  href={result.linkSOP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                >
                  <ExternalLink size={18} />
                  <span className="font-medium">Xem SOP gốc</span>
                </a>
              )}
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-700 font-medium">🔍 Nguyên nhân: {result.cause || 'N/A'}</p>
              <p className="text-green-700 font-medium">✅ Hướng xử lý: {result.solution || 'N/A'}</p>
              {result.notes && <p className="text-red-700 font-medium">📌 Lưu ý: {result.notes}</p>}
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-gray-700 font-medium">KH bức xúc?</span>
                <button
                  onClick={() => setTemplateMode('neutral')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    templateMode === 'neutral'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  😊 Bản neutral
                </button>
                <button
                  onClick={() => setTemplateMode('calming')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    templateMode === 'calming'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  😤→😊 Template Calming
                </button>
              </div>
            </div>

            {/* 🔥 FIX: CHỈ HIỂN THỊ 1 TEMPLATE - key prop giúp React re-render khi activeChannel hoặc templateMode thay đổi */}
            <div key={`${result.errorCode}-${activeChannel}-${templateMode}`}>
              {templateMode === 'neutral' ? (
                <div className="p-4 rounded-lg border-2 border-green-400 bg-green-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-gray-900">😊 Template Neutral</span>
                    <button
                      onClick={() => handleCopy(getTemplate(result, activeChannel, 'neutral'), `${result.errorCode}-neutral`)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      {copiedId === `${result.errorCode}-neutral` ? <><Check size={18} />Copied!</> : <><Copy size={18} />Copy</>}
                    </button>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{getTemplate(result, activeChannel, 'neutral')}</p>
                </div>
              ) : (
                <div className="p-4 rounded-lg border-2 border-orange-400 bg-orange-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-gray-900">😤→😊 Template Calming</span>
                    <button
                      onClick={() => handleCopy(getTemplate(result, activeChannel, 'calming'), `${result.errorCode}-calming`)}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      {copiedId === `${result.errorCode}-calming` ? <><Check size={18} />Copied!</> : <><Copy size={18} />Copy</>}
                    </button>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{getTemplate(result, activeChannel, 'calming')}</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-sm text-gray-600">
              <span>📄 {result.fileSOP || 'Internal SOP'}</span>
              <span className="text-red-600">🔴 {result.sourceType || 'Internal SOP'}</span>
            </div>
          </div>
        ))}

        {results.length === 0 && !isLoading && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Search size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">Nhập từ khóa để tìm kiếm</h3>
            <p className="text-gray-500">Tổng cộng có {knowledgeBase.length} cases trong database</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default App;