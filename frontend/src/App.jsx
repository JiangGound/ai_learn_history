import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// 根据 dynasty 字段判断国内/国外
function getCategory(character) {
  return character.dynasty ? '国内' : '国外'
}

const DYNASTIES = ['全部', '先秦', '秦汉', '三国', '两晋南北朝', '隋唐', '宋', '元', '明', '清', '近代']

// 历史人物头像映射（Wikimedia Commons 在大陆可能被屏蔽，默认全部用文字头像）
const AVATAR_MAP = {}

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
  const [dynastyFilter, setDynastyFilter] = useState('全部')
  const [initLoadingId, setInitLoadingId] = useState(null)
  // 语音相关
  const [recording, setRecording] = useState(false)
  const [playingIndex, setPlayingIndex] = useState(null)   // TTS 索引
  const [playingVoiceIdx, setPlayingVoiceIdx] = useState(null) // 语音消息索引
  // 通话模式
  const [callMode, setCallMode] = useState(false)
  const [callPhase, setCallPhase] = useState('idle') // 'greeting'|'listening'|'processing'|'speaking'
  const [callSeconds, setCallSeconds] = useState(0)
  const [callTranscript, setCallTranscript] = useState([])
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordStartRef = useRef(null)
  const handleVoiceSendRef = useRef(null)
  const callActiveRef = useRef(false)
  const callStreamRef = useRef(null)
  const callTimerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const callSessionRef = useRef({})
  const audioRef = useRef(null)
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

  const handleCharacterSelect = async (char) => {
    let character = char
    // 需要懒加载详细资料
    if (!character.background || character.background === '-') {
      setInitLoadingId(character._id)
      try {
        const res = await fetch(`${API_BASE}/api/characters/${character._id}/init`, { method: 'POST' })
        if (res.ok) {
          character = await res.json()
          setCharacters(prev => prev.map(c => c._id === character._id ? character : c))
        }
      } catch (e) {
        console.error('初始化人物失败', e)
      }
      setInitLoadingId(null)
    }
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

  // 渲染消息：将【神态描写】显示为斜体灰色，其余正常
  function renderContent(text) {
    const parts = text.split(/(【[^】]*】)/g)
    return parts.map((part, i) =>
      /^【/.test(part)
        ? <em key={i} className="not-italic text-amber-600/70 text-xs block mb-1">{part}</em>
        : <span key={i}>{part}</span>
    )
  }

  // 语音录入（按住录音，松开直接发送语音消息）
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      recordStartRef.current = Date.now()
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                     : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000))
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => handleVoiceSendRef.current?.(blob, reader.result, duration)
        reader.readAsDataURL(blob)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (e) {
      alert('无法访问麦克风，请检查浏览器权限')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  // 通话模式：始终持有最新状态（解决异步闭包问题）
  callSessionRef.current = { messages, conversationId, selectedCharacter }

  // 语音消息发送（异步，始终指向最新闭包）
  handleVoiceSendRef.current = async (blob, audioDataUrl, duration) => {
    if (!selectedCharacter || loading) return
    const priorMessages = messages
    const voiceMsg = { role: 'user', content: '正在识别语音…', type: 'voice', audioDataUrl, duration }
    setMessages(prev => [...prev, voiceMsg])
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('audio', blob, blob.type.includes('mp4') ? 'recording.mp4' : 'recording.webm')
      const asrRes = await fetch(`${API_BASE}/api/asr`, { method: 'POST', body: formData })
      const asrData = await asrRes.json()
      const asrText = asrData.text?.trim() || ''
      setMessages(prev => {
        const idx = [...prev].reverse().findIndex(m => m.type === 'voice')
        if (idx < 0) return prev
        const i = prev.length - 1 - idx
        return prev.map((m, j) => j === i ? { ...m, content: asrText || '[未能识别]' } : m)
      })
      if (!asrText) { setLoading(false); return }
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: selectedCharacter._id,
          message: asrText,
          conversationId,
          conversationHistory: priorMessages.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      setConversationId(data.conversationId)
      loadConversations()
    } catch (err) {
      setMessages(prev => {
        const idx = [...prev].reverse().findIndex(m => m.type === 'voice')
        if (idx < 0) return prev
        const i = prev.length - 1 - idx
        return prev.map((m, j) => j === i ? { ...m, content: '[语音发送失败]' } : m)
      })
    } finally {
      setLoading(false)
    }
  }

  // 播放语音消息
  const handlePlayVoice = (audioDataUrl, index) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (playingVoiceIdx === index) { setPlayingVoiceIdx(null); return }
    const audio = new Audio(audioDataUrl)
    audioRef.current = audio
    setPlayingVoiceIdx(index)
    setPlayingIndex(null)
    audio.onended = () => setPlayingVoiceIdx(null)
    audio.onerror = () => setPlayingVoiceIdx(null)
    audio.play()
  }

  // TTS 朗读助手回和
  const handleSpeak = async (text, index) => {
    window.speechSynthesis?.cancel()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlayingVoiceIdx(null)
    if (playingIndex === index) {
      setPlayingIndex(null)
      return
    }
    setPlayingIndex(index)
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, gender: selectedCharacter?.gender || 'male' })
      })
      const data = await res.json()
      if (data.audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`)
        audioRef.current = audio
        audio.onended = () => setPlayingIndex(null)
        audio.onerror = () => setPlayingIndex(null)
        audio.play()
      } else {
        setPlayingIndex(null)
      }
    } catch (e) {
      console.error('TTS 失败', e)
      setPlayingIndex(null)
    }
  }

  // ── 通话模式 ─────────────────────────────────────────

  const endCall = () => {
    callActiveRef.current = false
    clearInterval(callTimerRef.current)
    callStreamRef.current?.getTracks().forEach(t => t.stop())
    callStreamRef.current = null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    try { audioCtxRef.current?.close() } catch (_) {}
    audioCtxRef.current = null
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop() } catch (_) {}
    }
    setCallMode(false)
    setCallPhase('idle')
  }

  // 通话中 TTS 朗读，返回 Promise（说完才 resolve）
  const callSpeak = (text) => new Promise(async (resolve) => {
    if (!callActiveRef.current) return resolve()
    setCallPhase('speaking')
    const clean = text.replace(/【[^】]*】/g, '').trim()
    if (!clean) return resolve()
    try {
      const gender = callSessionRef.current.selectedCharacter?.gender || 'male'
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, gender })
      })
      const data = await res.json()
      if (data.audio && callActiveRef.current) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`)
        audioRef.current = audio
        audio.onended = () => { audioRef.current = null; resolve() }
        audio.onerror = () => { audioRef.current = null; resolve() }
        audio.play()
      } else resolve()
    } catch { resolve() }
  })

  // 通话中处理录音：ASR → Chat → TTS → 重新聆听
  const callProcess = async (blob) => {
    if (!callActiveRef.current) return
    setCallPhase('processing')
    const session = callSessionRef.current
    try {
      const formData = new FormData()
      formData.append('audio', blob, blob.type.includes('mp4') ? 'recording.mp4' : 'recording.webm')
      const asrRes = await fetch(`${API_BASE}/api/asr`, { method: 'POST', body: formData })
      const asrData = await asrRes.json()
      const userText = asrData.text?.trim() || ''
      if (!userText || !callActiveRef.current) {
        if (callActiveRef.current) callListen(callStreamRef.current)
        return
      }
      setCallTranscript(prev => [...prev, { role: 'user', text: userText }])
      setMessages(prev => [...prev, { role: 'user', content: userText }])
      const chatRes = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: session.selectedCharacter._id,
          message: userText,
          conversationId: session.conversationId,
          conversationHistory: session.messages.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const chatData = await chatRes.json()
      const aiText = chatData.response || ''
      if (!callActiveRef.current) return
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }])
      setConversationId(chatData.conversationId)
      setCallTranscript(prev => [...prev, { role: 'assistant', text: aiText }])
      loadConversations()
      await callSpeak(aiText)
      if (callActiveRef.current) callListen(callStreamRef.current)
    } catch {
      if (callActiveRef.current) callListen(callStreamRef.current)
    }
  }

  // 通话中开始聆听，静音检测自动触发
  const callListen = (stream) => {
    if (!callActiveRef.current || !stream) return
    setCallPhase('listening')
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    const chunks = []
    let stopped = false
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      if (stopped) return
      stopped = true
      if (!callActiveRef.current) return
      if (chunks.length === 0) { callListen(stream); return }
      callProcess(new Blob(chunks, { type: mimeType }))
    }
    recorder.start(100)

    // 静音检测
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const recordStart = Date.now()
      const MIN_MS = 1200   // 最短录音 1.2s
      const THRESHOLD = 12  // 音量阈值
      const SILENCE_MS = 2000 // 2s 静音触发
      let silenceStart = null
      let hasSpeech = false
      const check = () => {
        if (!callActiveRef.current || recorder.state === 'inactive') return
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        const elapsed = Date.now() - recordStart
        if (avg > THRESHOLD) { hasSpeech = true; silenceStart = null }
        else if (hasSpeech && elapsed > MIN_MS) {
          if (!silenceStart) silenceStart = Date.now()
          else if (Date.now() - silenceStart > SILENCE_MS) {
            try { recorder.stop() } catch (_) {}
            try { ctx.close() } catch (_) {}
            return
          }
        }
        requestAnimationFrame(check)
      }
      check()
    } catch (_) {}
  }

  const startCall = async () => {
    if (!selectedCharacter || callMode) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      callStreamRef.current = stream
      callActiveRef.current = true
      setCallMode(true)
      setCallPhase('greeting')
      setCallSeconds(0)
      setCallTranscript([])
      callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000)
      const greeting = `你好，我是${selectedCharacter.name}。${selectedCharacter.description}。很高兴与你通话，请说吧。`
      await callSpeak(greeting)
      if (callActiveRef.current) callListen(stream)
    } catch (e) {
      callActiveRef.current = false
      setCallMode(false)
      alert('无法访问麦克风，请检查浏览器权限')
    }
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
    const filtered = characters.filter(c => {
      if (categoryFilter !== '全部' && getCategory(c) !== categoryFilter) return false
      if (categoryFilter === '国内' && dynastyFilter !== '全部' && c.dynasty !== dynastyFilter) return false
      if (searchQuery && !c.name.includes(searchQuery) && !(c.description || '').includes(searchQuery)) return false
      return true
    })
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
            <div className="flex gap-3 mb-6 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-300">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索人物…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-amber-200 rounded-xl bg-white text-gray-700 placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['全部', '国内', '国外'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setDynastyFilter('全部') }}
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

            {/* 朝代子筛选（仅国内显示） */}
            {categoryFilter === '国内' && (
              <div className="flex gap-1.5 flex-wrap mb-4">
                {DYNASTIES.map(d => (
                  <button
                    key={d}
                    onClick={() => setDynastyFilter(d)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors border ${
                      dynastyFilter === d
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-amber-700 border-amber-200 hover:border-amber-500'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

          {/* 人物卡片网格 */}
          {filtered.length === 0 ? (
            <div className="text-center text-amber-300 py-20">没有匹配的人物</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(character => (
                <button
                  key={character._id}
                  onClick={() => handleCharacterSelect(character)}
                  disabled={initLoadingId !== null}
                  className="relative bg-white border border-amber-100 hover:border-amber-400 hover:shadow-md rounded-2xl p-4 flex flex-col items-center gap-3 text-center transition-all group disabled:opacity-70"
                >
                  {initLoadingId === character._id && (
                    <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-amber-500">加载中…</span>
                      </div>
                    </div>
                  )}
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
    <>
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
                <button
                  onClick={startCall}
                  disabled={loading}
                  title="语音通话"
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-200 text-white rounded-xl text-sm font-medium transition-colors shrink-0"
                >
                  <span>📞</span> 通话
                </button>
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
                    <div className="flex flex-col gap-1 max-w-[72%]">
                      {/* 语音消息气泡 */}
                      {message.type === 'voice' ? (
                        <>
                          <div
                            onClick={() => message.audioDataUrl && handlePlayVoice(message.audioDataUrl, index)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tr-none select-none ${
                              message.audioDataUrl ? 'cursor-pointer' : 'cursor-default'
                            } bg-amber-500 text-white`}
                          >
                            <span className="text-base">{playingVoiceIdx === index ? '⏹' : '🎙️'}</span>
                            <div className="flex gap-[3px] items-end h-4">
                              {[5,9,13,9,5,11,7,13,9,5].map((h, i) => (
                                <div key={i}
                                  className={`w-[3px] rounded-sm bg-white/80 transition-all ${
                                    playingVoiceIdx === index ? 'animate-pulse' : ''
                                  }`}
                                  style={{ height: h }}
                                />
                              ))}
                            </div>
                            {message.duration && (
                              <span className="text-xs opacity-70 ml-1">{message.duration}″</span>
                            )}
                          </div>
                          {message.content === '正在识别语音…' ? (
                            <div className="text-xs text-amber-400 animate-pulse text-right">{message.content}</div>
                          ) : (
                            <div className="text-xs text-gray-400 text-right">{message.content}</div>
                          )}
                        </>
                      ) : (
                        /* 文字消息气泡 */
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          message.role === 'user'
                            ? 'bg-amber-500 text-white rounded-tr-none'
                            : 'bg-amber-50 text-gray-800 border border-amber-100 rounded-tl-none'
                        }`}>
                          {message.role === 'assistant' ? renderContent(message.content) : message.content}
                        </div>
                      )}
                      {message.role === 'assistant' && (
                        <button
                          onClick={() => handleSpeak(message.content, index)}
                          className="self-start text-xs text-amber-400 hover:text-amber-600 flex items-center gap-1 transition-colors"
                          title={playingIndex === index ? '停止朗读' : '朗读'}
                        >
                          {playingIndex === index
                            ? <><span className="animate-pulse">■</span> 停止</>
                            : <>🔊 朗读</>}
                        </button>
                      )}
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
                  {/* 语音按钮：按住录音，松开发送语音消息 */}
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={e => { e.preventDefault(); startRecording() }}
                    onTouchEnd={e => { e.preventDefault(); stopRecording() }}
                    onMouseLeave={() => { if (recording) stopRecording() }}
                    disabled={loading}
                    title="按住录音，松开发送"
                    className={`px-3 py-2.5 rounded-xl border text-base transition-all ${
                      recording
                        ? 'bg-red-500 border-red-500 text-white scale-110'
                        : 'bg-white border-amber-200 hover:border-amber-400 text-amber-500'
                    } disabled:opacity-40 select-none`}
                  >
                    {recording ? <span className="animate-pulse">⏺</span> : '🎙️'}
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={recording ? '••• 正在录音，松开发送 •••' : `输入文字或按住🎙️录音…`}
                    disabled={loading || recording}
                    className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim() || recording}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    发送
                  </button>
                </div>
                <p className="text-xs text-amber-300 mt-1.5 text-right">按住🎙️发送语音 · Enter 发送文字</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>

      {/* ── 通话模式全屏遮罩 ── */}
      {callMode && selectedCharacter && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-gray-900 via-amber-950 to-gray-900 px-6 py-10">
          {/* 顶部：时长 */}
          <div className="w-full flex justify-center">
            <span className="text-white/50 text-sm tabular-nums">
              {String(Math.floor(callSeconds / 60)).padStart(2, '0')}:{String(callSeconds % 60).padStart(2, '0')}
            </span>
          </div>

          {/* 中间：头像 + 状态 */}
          <div className="flex flex-col items-center gap-6">
            <div className={`relative rounded-full ${
              callPhase === 'speaking' ? 'ring-4 ring-amber-400 ring-offset-4 ring-offset-gray-900' :
              callPhase === 'listening' ? 'ring-4 ring-green-400 ring-offset-4 ring-offset-gray-900' : ''
            } transition-all duration-300`}>
              <Avatar
                name={selectedCharacter.name}
                className={`w-28 h-28 text-4xl ${
                  callPhase === 'speaking' ? 'animate-pulse' : ''
                }`}
              />
              {callPhase === 'listening' && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse" />
              )}
            </div>
            <div className="text-center">
              <div className="text-white text-2xl font-bold">{selectedCharacter.name}</div>
              <div className={`text-sm mt-1.5 ${
                callPhase === 'speaking' ? 'text-amber-400' :
                callPhase === 'listening' ? 'text-green-400' :
                callPhase === 'processing' ? 'text-blue-300' : 'text-white/50'
              }`}>
                {callPhase === 'speaking' && '🔊 正在说话…'}
                {callPhase === 'listening' && '🎙 正在聆听…'}
                {callPhase === 'processing' && '💭 正在思考…'}
                {callPhase === 'greeting' && '📞 正在接通…'}
              </div>
            </div>

            {/* 通话记录预览（最近 4 条） */}
            {callTranscript.length > 0 && (
              <div className="w-full max-w-xs bg-white/5 rounded-2xl px-4 py-3 space-y-2 max-h-36 overflow-y-auto">
                {callTranscript.slice(-4).map((t, i) => (
                  <div key={i} className={`text-xs leading-snug ${
                    t.role === 'user' ? 'text-white/70 text-right' : 'text-amber-300/80 text-left'
                  }`}>
                    <span className="opacity-50 mr-1">{t.role === 'user' ? '你' : selectedCharacter.name}：</span>
                    {t.text.replace(/【[^】]*】/g, '').slice(0, 80)}{t.text.length > 80 ? '…' : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 底部：挂断按钮 */}
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white text-2xl flex items-center justify-center shadow-lg transition-all"
            title="挂断"
          >
            📵
          </button>
        </div>
      )}
    </>
  )
}

export default App
