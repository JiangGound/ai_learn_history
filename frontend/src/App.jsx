import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// 历史人物分类映射
const CATEGORY_MAP = {
  '孔子': '国内', '李白': '国内', '诸葛亮': '国内', '武则天': '国内',
  '苏轼': '国内', '岳飞': '国内', '秦始皇': '国内', '曹操': '国内',
  '屈原': '国内', '王阳明': '国内', '郑和': '国内', '张衡': '国内',
  '牛顿': '国外', '爱因斯坦': '国外', '达芬奇': '国外', '莎士比亚': '国外',
  '拿破仑': '国外', '苏格拉底': '国外', '亚里士多德': '国外', '柏拉图': '国外',
  '伽利略': '国外', '马克思': '国外', '林肯': '国外', '丘吉尔': '国外',
}

function getCategory(name) {
  return CATEGORY_MAP[name] || '国外'
}

// 历史人物头像映射（Wikimedia Commons）
const AVATAR_MAP = {
  '孔子': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Konfuzius-1770.jpg/180px-Konfuzius-1770.jpg',
  '李白': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Li_Bai_in_a_landscape.jpg/180px-Li_Bai_in_a_landscape.jpg',
  '诸葛亮': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Zhuge_Liang.jpg/180px-Zhuge_Liang.jpg',
  '牛顿': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/GodfreyKneller-IsaacNewton-1689.jpg/180px-GodfreyKneller-IsaacNewton-1689.jpg',
  '武则天': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/EmpressWuZetian.jpg/180px-EmpressWuZetian.jpg',
  '爱因斯坦': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/180px-Albert_Einstein_Head.jpg',
}

function Avatar({ name, className = '' }) {
  const [imgError, setImgError] = useState(false)
  const url = AVATAR_MAP[name]
  if (!url || imgError) {
    return (
      <div className={`rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center font-bold text-amber-700 shrink-0 ${className}`}>
        {name[0]}
      </div>
    )
  }
  return (
    <img src={url} alt={name}
      className={`rounded-full object-cover border-2 border-amber-300 shrink-0 ${className}`}
      onError={() => setImgError(true)}
    />
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function App() {
  const [page, setPage] = useState('characters') // 'characters' | 'chat'
  const [characters, setCharacters] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const messagesEndRef = useRef(null)

  const loadConversations = useCallback(() => {
    fetch(`${API_BASE}/api/conversations`)
      .then(res => res.json())
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/api/characters`)
      .then(res => res.json())
      .then(data => setCharacters(data))
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleCharacterSelect = (character) => {
    setSelectedCharacter(character)
    setMessages([])
    setConversationId(null)
    setPage('chat')
  }

  const handleLoadConversation = async (conv) => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conv._id}`)
      const data = await res.json()
      const char = characters.find(c => c._id === data.characterId)
      if (char) setSelectedCharacter(char)
      setMessages(data.messages)
      setConversationId(data._id)
      setPage('chat')
    } catch (e) {
      console.error('加载会话失败', e)
    }
  }

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation()
    await fetch(`${API_BASE}/api/conversations/${convId}`, { method: 'DELETE' })
    if (conversationId === convId) {
      setMessages([])
      setConversationId(null)
    }
    loadConversations()
  }

  const handleNewConversation = () => {
    setMessages([])
    setConversationId(null)
  }

  const handleSend = async () => {
    if (!input.trim() || !selectedCharacter || loading) return
    const userMessage = input
    const priorMessages = messages
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: selectedCharacter._id,
          message: userMessage,
          conversationId,
          conversationHistory: priorMessages
        })
      })
      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      setConversationId(data.conversationId)
      loadConversations()
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误，请稍后再试。' }])
    } finally {
      setLoading(false)
    }
  }

  // ── 人物选择页 ──────────────────────────────────────────
  if (page === 'characters') {
    const filtered = characters.filter(c =>
      (categoryFilter === '全部' || getCategory(c.name) === categoryFilter) &&
      (searchQuery === '' || c.name.includes(searchQuery) || c.description.includes(searchQuery))
    )
    return (
      <div className="min-h-screen bg-amber-50 flex flex-col">
        <header className="bg-white border-b border-amber-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-amber-800">📜 历史人物 AI 对话</h1>
              <p className="text-sm text-amber-400 mt-0.5">穿越时空，与历史对话</p>
            </div>
            {conversations.length > 0 && (
              <button
                onClick={() => setPage('chat')}
                className="text-sm text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 px-4 py-2 rounded-xl transition-colors"
              >
                💭 历史会话 ({conversations.length})
              </button>
            )}
          </div>
        </header>

        <div className="max-w-5xl mx-auto w-full px-6 py-6 flex-1">
          {/* 搜索和筛选 */}
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-300">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索人物…"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-amber-200 rounded-xl bg-white text-gray-700 placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div className="flex gap-1.5">
              {['全部', '国内', '国外'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors border ${
                    categoryFilter === cat
                      ? 'bg-amber-400 text-white border-amber-400'
                      : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 人物卡片网格 */}
          {filtered.length === 0 ? (
            <div className="text-center text-amber-300 py-20">没有匹配的人物</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(character => (
                <button
                  key={character._id}
                  onClick={() => handleCharacterSelect(character)}
                  className="bg-white border border-amber-100 hover:border-amber-400 hover:shadow-md rounded-2xl p-4 flex flex-col items-center gap-3 text-center transition-all group"
                >
                  <Avatar name={character.name} className="w-16 h-16 text-2xl group-hover:scale-105 transition-transform" />
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{character.name}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{character.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 对话页 ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      <header className="bg-white border-b border-amber-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <h1 className="text-xl font-bold text-amber-800">📜 历史人物 AI 对话</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-6 py-5 flex gap-5 flex-1">
        {/* 左侧菜单栏 */}
        <aside className="w-56 shrink-0 flex flex-col gap-3">
          {/* 返回按钮 */}
          <button
            onClick={() => setPage('characters')}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-amber-700 hover:text-amber-900 text-sm font-medium transition-colors"
          >
            ← 选择人物
          </button>

          {/* 新对话按钮 */}
          {selectedCharacter && (
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
            >
              ✏️ 新对话
            </button>
          )}

          {/* 历史会话 */}
          <div className="text-xs font-semibold text-amber-500 px-1 mt-1">历史会话</div>
          <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
            {conversations.length === 0 ? (
              <div className="text-center text-amber-300 text-xs py-6">
                <div className="text-2xl mb-1">💭</div>
                暂无历史会话
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv._id}
                  onClick={() => handleLoadConversation(conv)}
                  className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                    conversationId === conv._id
                      ? 'bg-amber-100 border-amber-400 shadow-sm'
                      : 'bg-white border-amber-100 hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <Avatar name={conv.characterName} className="w-7 h-7 text-xs mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-gray-800 truncate">{conv.title}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{conv.characterName} · {formatDate(conv.updatedAt)}</div>
                  </div>
                  <button
                    onClick={e => handleDeleteConversation(e, conv._id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base leading-none shrink-0 mt-0.5"
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* 主聊天区域 */}
        <main className="flex-1 min-w-0">
          {!selectedCharacter ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-24">
              <div className="text-6xl mb-5">🏛️</div>
              <h2 className="text-xl font-semibold text-amber-800">请先选择一位历史人物</h2>
              <button
                onClick={() => setPage('characters')}
                className="mt-4 text-sm text-amber-600 hover:text-amber-800 border border-amber-300 hover:border-amber-500 px-5 py-2.5 rounded-xl transition-colors"
              >
                ← 返回人物选择
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
              {/* 对话头部 */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-amber-100">
                <Avatar name={selectedCharacter.name} className="w-12 h-12 text-xl" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-800 text-base">{selectedCharacter.name}</h2>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{selectedCharacter.description}</p>
                </div>
              </div>

              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-amber-400 text-sm pt-10">
                    💬 向 {selectedCharacter.name} 打个招呼吧
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {message.role === 'assistant' && (
                      <Avatar name={selectedCharacter.name} className="w-8 h-8 text-xs mt-0.5 shrink-0" />
                    )}
                    <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-amber-500 text-white rounded-tr-none'
                        : 'bg-amber-50 text-gray-800 border border-amber-100 rounded-tl-none'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 items-center">
                    <Avatar name={selectedCharacter.name} className="w-8 h-8 text-xs shrink-0" />
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm text-amber-400">
                      <span className="animate-pulse">正在思考…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 输入框 */}
              <div className="px-5 py-4 border-t border-amber-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={`问问 ${selectedCharacter.name}…`}
                    disabled={loading}
                    className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    发送
                  </button>
                </div>
                <p className="text-xs text-amber-300 mt-1.5 text-right">Enter 发送</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
