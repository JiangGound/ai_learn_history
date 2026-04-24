import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// ── 登录页面 ─────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [phone, setPhone]       = useState('')
  const [code, setCode]         = useState('')
  const [sending, setSending]   = useState(false)
  const [verifying, setVerify]  = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [devCode, setDevCode]   = useState('')  // 开发模式下显示验证码
  const [error, setError]       = useState('')
  const timerRef = useRef(null)

  useEffect(() => () => clearInterval(timerRef.current), [])

  const startCountdown = () => {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0 } return c - 1 })
    }, 1000)
  }

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError('手机号格式不正确'); return }
    setSending(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '发送失败'); return }
      startCountdown()
      // 开发模式：显示返回的验证码
      if (data.devCode) setDevCode(`测试验证码：${data.devCode}`)
    } catch { setError('网络错误') }
    finally { setSending(false) }
  }

  const handleVerify = async () => {
    if (!code.trim()) { setError('请输入验证码'); return }
    setVerify(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '验证失败'); return }
      localStorage.setItem('token', data.token)
      onLogin(data.user, data.token)
    } catch { setError('网络错误') }
    finally { setVerify(false) }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-amber-100 px-8 py-10">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📜</div>
          <h1 className="text-2xl font-bold text-amber-800">历史人物 AI 对话</h1>
          <p className="text-sm text-amber-400 mt-1">登录后可保存对话记录</p>
        </div>

        <div className="space-y-4">
          {/* 手机号 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">手机号</label>
            <div className="flex gap-2">
              <input
                type="tel" maxLength={11} value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                placeholder="请输入手机号"
                className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={handleSendCode}
                disabled={sending || countdown > 0}
                className="shrink-0 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
              >
                {sending ? '发送中…' : countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
          </div>

          {/* 验证码 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">验证码</label>
            <input
              type="text" maxLength={6} value={code}
              onChange={e => { setCode(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="6 位验证码"
              className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {devCode && (
            <p className="text-xs text-center text-green-600 bg-green-50 rounded-lg py-1.5">{devCode}</p>
          )}
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <button
            onClick={handleVerify}
            disabled={verifying}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            {verifying ? '登录中…' : '登录 / 注册'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  // 登录状态
  const [token, setToken]   = useState(() => localStorage.getItem('token') || '')
  const [user, setUser]     = useState(null)
  const [authReady, setAuthReady] = useState(false)

  // 验证已保存的 token
  useEffect(() => {
    if (!token) { setAuthReady(true); return }
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { setUser(u); setAuthReady(true) })
      .catch(() => setAuthReady(true))
  }, [token])

  const authHeaders = useCallback(() =>
    token ? { Authorization: `Bearer ${token}` } : {}
  , [token])

  const handleLogin = (u, t) => { setUser(u); setToken(t) }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(''); setUser(null)
    setMessages([]); setConversationId(null); setConversations([])
  }

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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // 群聊
  const [groupSelectedChars, setGroupSelectedChars] = useState([])
  const [groupCharacters, setGroupCharacters] = useState([])
  const [groupMessages, setGroupMessages] = useState([])
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupSpeakerIdx, setGroupSpeakerIdx] = useState(null)
  const [groupInput, setGroupInput] = useState('')
  const [groupAutoRun, setGroupAutoRun] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  // 群通话
  const [groupCallMode, setGroupCallMode] = useState(false)
  const [groupCallPhase, setGroupCallPhase] = useState('idle') // 'greeting'|'listening'|'processing'|'speaking'
  const [groupCallSeconds, setGroupCallSeconds] = useState(0)
  const [groupCallTranscript, setGroupCallTranscript] = useState([])
  const [groupCallSpeaker, setGroupCallSpeaker] = useState(null)
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
  const callSpeakAbortRef = useRef(null)
  const groupAbortRef = useRef(false)
  const groupAutoRunRef = useRef(false)
  const groupCallActiveRef = useRef(false)
  const groupCallInterruptedRef = useRef(false)
  const groupConvIdRef = useRef(null)
  const groupCallStreamRef = useRef(null)
  const groupCallTimerRef = useRef(null)
  const groupCallAudioCtxRef = useRef(null)
  const groupCallSessionRef = useRef({})
  const messagesEndRef = useRef(null)

  const loadConversations = useCallback(() => {
    fetch(`${API_BASE}/api/conversations`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [authHeaders])

  useEffect(() => {
    fetch(`${API_BASE}/api/characters`)
      .then(res => res.json())
      .then(data => setCharacters(data))
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, groupMessages, groupLoading])

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
      setSidebarOpen(false)
    } catch (e) {
      console.error('加载会话失败', e)
    }
  }

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation()
    await fetch(`${API_BASE}/api/conversations/${convId}`, {
      method: 'DELETE', headers: authHeaders()
    })
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
  groupCallSessionRef.current = { groupMessages, groupCharacters }
  groupAutoRunRef.current = groupAutoRun

  // 群聊会话保存函数
  const saveGroupConversation = useCallback(async (msgs, chars) => {
    if (!chars.length || !msgs.length) return
    try {
      const firstUserMsg = msgs.find(m => m.role === 'user')
      const res = await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          conversationId: groupConvIdRef.current,
          characterIds: chars.map(c => c._id),
          characterNames: chars.map(c => c.name),
          messages: msgs.map(m => ({ role: m.role, content: m.content, speakerName: m.speakerName })),
          title: firstUserMsg?.content?.slice(0, 30) || chars.map(c => c.name).join(' · ')
        })
      })
      const data = await res.json()
      if (data.conversationId) groupConvIdRef.current = data.conversationId
      loadConversations()
    } catch (e) { console.error('保存群聊失败', e) }
  }, [authHeaders, loadConversations])

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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
      // 后端流式返回 audio/mpeg，用 blob URL 立即播放
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, gender: selectedCharacter?.gender || 'male' })
      })
      if (!res.ok) { setPlayingIndex(null); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setPlayingIndex(null) }
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; setPlayingIndex(null) }
      audio.play()
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
    // 停止所有正在播放的音频（含打断回调）
    if (callSpeakAbortRef.current) { callSpeakAbortRef.current(); callSpeakAbortRef.current = null }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    window.speechSynthesis?.cancel()
    try { audioCtxRef.current?.close() } catch (_) {}
    audioCtxRef.current = null
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop() } catch (_) {}
    }
    setCallMode(false)
    setCallPhase('idle')
  }

  // 打断通话中正在播放的 AI 语音，立即开始聆听
  const handleCallInterrupt = () => {
    if (callSpeakAbortRef.current) callSpeakAbortRef.current()
  }

  // 通话中 TTS 朗读，使用后端 Edge TTS（与普通朗读一致的自然音质）
  const callSpeak = (text) => new Promise(async (resolve) => {
    if (!callActiveRef.current) return resolve()
    setCallPhase('speaking')
    const clean = text.replace(/【[^】]*】/g, '').trim()
    if (!clean) return resolve()
    const gender = callSessionRef.current.selectedCharacter?.gender || 'male'
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, gender })
      })
      if (!res.ok || !callActiveRef.current) return resolve()
      const blob = await res.blob()
      if (!callActiveRef.current) return resolve()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      // 支持打断：将 resolve 暴露给 callSpeakAbortRef，点击打断时立即结束
      const cleanup = () => { URL.revokeObjectURL(url); audioRef.current = null; callSpeakAbortRef.current = null; resolve() }
      callSpeakAbortRef.current = () => { audio.pause(); cleanup() }
      audio.onended = cleanup
      audio.onerror = cleanup
      audio.play()
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
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          characterId: session.selectedCharacter._id,
          message: userText,
          conversationId: session.conversationId,
          conversationHistory: session.messages.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const chatData = await response.json()
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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

  // ── 群聊发送（依次获取每位人物的回复，支持自动轮转）──────────────
  const handleGroupSend = async (msgText, autoRound = false) => {
    if (groupLoading) return
    if (!autoRound && !msgText?.trim()) return
    groupAbortRef.current = false
    let history
    let newUserMsg = null
    if (!autoRound) {
      setGroupInput('')
      newUserMsg = { role: 'user', content: msgText }
      setGroupMessages(prev => [...prev, newUserMsg])
      history = [...groupMessages, newUserMsg]
    } else {
      history = [...groupMessages]
    }
    setGroupLoading(true)
    const chars = groupCharacters
    for (let i = 0; i < chars.length; i++) {
      if (groupAbortRef.current) break
      setGroupSpeakerIdx(i)
      try {
        const res = await fetch(`${API_BASE}/api/group-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            characterIds: chars.map(c => c._id),
            message: autoRound ? '' : msgText,
            conversationHistory: history.map(m => ({ role: m.role, content: m.content, speakerName: m.speakerName })),
            speakerIndex: i
          })
        })
        if (groupAbortRef.current) break
        const data = await res.json()
        if (groupAbortRef.current) break
        const aiMsg = {
          role: 'assistant', content: data.response,
          speakerId: data.speakerId, speakerName: data.speakerName, speakerGender: data.speakerGender
        }
        setGroupMessages(prev => [...prev, aiMsg])
        history.push(aiMsg)
      } catch { break }
    }
    setGroupLoading(false)
    setGroupSpeakerIdx(null)
    // 每轮结束后保存会话（只有用户发言时才保存，既避免过多保存）
    if (!autoRound && !groupAbortRef.current) {
      saveGroupConversation(history, chars)
    }
    // 自由讨论：上一轮结束后自动开启下一轮
    if (!groupAbortRef.current && groupAutoRunRef.current) {
      setTimeout(() => handleGroupSend('', true), 600)
    }
  }

  // ── 群通话─────────────────────────────────────────

  const endGroupCall = () => {
    groupCallActiveRef.current = false
    groupCallInterruptedRef.current = false
    clearInterval(groupCallTimerRef.current)
    groupCallStreamRef.current?.getTracks().forEach(t => t.stop())
    groupCallStreamRef.current = null
    if (callSpeakAbortRef.current) { callSpeakAbortRef.current(); callSpeakAbortRef.current = null }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    try { groupCallAudioCtxRef.current?.close() } catch (_) {}
    groupCallAudioCtxRef.current = null
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop() } catch (_) {}
    }
    setGroupCallMode(false)
    setGroupCallPhase('idle')
    setGroupCallSpeaker(null)
  }

  // 群通话 TTS，复用 callSpeakAbortRef 支持打断
  const groupCallSpeak = (text, gender) => new Promise(async (resolve) => {
    if (!groupCallActiveRef.current) return resolve()
    const clean = text.replace(/【[^】]*】/g, '').trim()
    if (!clean) return resolve()
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, gender })
      })
      if (!res.ok || !groupCallActiveRef.current) return resolve()
      const blob = await res.blob()
      if (!groupCallActiveRef.current) return resolve()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      const cleanup = () => { URL.revokeObjectURL(url); audioRef.current = null; callSpeakAbortRef.current = null; resolve() }
      callSpeakAbortRef.current = () => { audio.pause(); cleanup() }
      audio.onended = cleanup
      audio.onerror = cleanup
      audio.play()
    } catch { resolve() }
  })

  // 群通话：根据上一句内容判断「被点名」角色，优先让其发言
  const pickNextSpeaker = (chars, lastText, spokenIds) => {
    const remaining = chars.filter(c => !spokenIds.has(c._id.toString()))
    if (!remaining.length) return null
    if (lastText) {
      const mentioned = remaining.find(c => lastText.includes(c.name))
      if (mentioned) return mentioned
    }
    return remaining[0]
  }

  // 群通话：单次发言 + 朗读，返回 { interrupted } 标志
  const groupCallOneTurn = async (chars, speaker, userMsg, history) => {
    if (!groupCallActiveRef.current || groupCallInterruptedRef.current) return { interrupted: true }
    setGroupCallSpeaker(speaker)
    setGroupCallPhase('speaking')
    const speakerIndex = chars.findIndex(c => c._id.toString() === speaker._id.toString())
    try {
      const res = await fetch(`${API_BASE}/api/group-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterIds: chars.map(c => c._id),
          message: userMsg,
          conversationHistory: history.map(m => ({ role: m.role, content: m.content, speakerName: m.speakerName })),
          speakerIndex
        })
      })
      if (!res.ok || !groupCallActiveRef.current) return { interrupted: true }
      const data = await res.json()
      if (!groupCallActiveRef.current) return { interrupted: true }
      const aiMsg = { role: 'assistant', content: data.response, speakerName: data.speakerName, speakerGender: data.speakerGender }
      setGroupMessages(prev => [...prev, aiMsg])
      setGroupCallTranscript(prev => [...prev, { role: 'assistant', text: data.response, speakerName: data.speakerName }])
      history.push(aiMsg)
      await groupCallSpeak(data.response, data.speakerGender)
      const interrupted = groupCallInterruptedRef.current
      if (interrupted) groupCallInterruptedRef.current = false
      return { interrupted, responseText: data.response }
    } catch {
      return { interrupted: true }
    }
  }

  // 群通话：处理录音 → ASR → 各角色回复（含点名优先）→ 自由讨论 → 聆听
  const groupCallProcess = async (blob) => {
    if (!groupCallActiveRef.current) return
    setGroupCallPhase('processing')
    const session = groupCallSessionRef.current
    const chars = session.groupCharacters
    try {
      // ASR
      const formData = new FormData()
      formData.append('audio', blob, blob.type.includes('mp4') ? 'recording.mp4' : 'recording.webm')
      const asrRes = await fetch(`${API_BASE}/api/asr`, { method: 'POST', body: formData })
      const asrData = await asrRes.json()
      const userText = asrData.text?.trim() || ''
      if (!userText || !groupCallActiveRef.current) {
        if (groupCallActiveRef.current) groupCallListen(groupCallStreamRef.current)
        return
      }
      setGroupCallTranscript(prev => [...prev, { role: 'user', text: userText }])
      setGroupMessages(prev => [...prev, { role: 'user', content: userText }])
      const history = [...session.groupMessages, { role: 'user', content: userText }]

      // ── 阶段1：所有角色依次回复用户（含点名优先）───────────────────────────
      const spokenIds = new Set()
      let lastText = userText
      while (spokenIds.size < chars.length && groupCallActiveRef.current) {
        const speaker = pickNextSpeaker(chars, lastText, spokenIds)
        if (!speaker) break
        spokenIds.add(speaker._id.toString())
        const { interrupted, responseText } = await groupCallOneTurn(chars, speaker, userText, history)
        if (interrupted) {
          saveGroupConversation(history, chars)
          groupCallListen(groupCallStreamRef.current)
          return
        }
        lastText = responseText
      }
      // 第一阶段完成，保存一次
      saveGroupConversation(history, chars)

      // ── 阶段2：自由讨论（AI 互相持续对话，可被打断）──────────────────────────
      let freeIdx = 0
      let lastFreeText = lastText
      while (groupCallActiveRef.current) {
        if (groupCallInterruptedRef.current) {
          groupCallInterruptedRef.current = false
          groupCallListen(groupCallStreamRef.current)
          return
        }
        // 点名优先：下个发言者
        let nextChar = null
        const mentionedFull = chars.find(c => lastFreeText?.includes(c.name))
        if (mentionedFull) {
          nextChar = mentionedFull
          freeIdx = chars.findIndex(c => c._id.toString() === mentionedFull._id.toString())
        } else {
          nextChar = chars[freeIdx % chars.length]
        }
        freeIdx++
        const { interrupted, responseText } = await groupCallOneTurn(chars, nextChar, '', history)
        if (interrupted) { groupCallListen(groupCallStreamRef.current); return }
        lastFreeText = responseText
      }
    } catch {
      if (groupCallActiveRef.current) groupCallListen(groupCallStreamRef.current)
    }
  }

  // 群通话：聆听（静音检测）
  const groupCallListen = (stream) => {
    if (!groupCallActiveRef.current || !stream) return
    setGroupCallPhase('listening')
    setGroupCallSpeaker(null)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    const chunks = []
    let stopped = false
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      if (stopped) return
      stopped = true
      if (!groupCallActiveRef.current) return
      if (chunks.length === 0) { groupCallListen(stream); return }
      groupCallProcess(new Blob(chunks, { type: mimeType }))
    }
    recorder.start(100)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      groupCallAudioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const recordStart = Date.now()
      const MIN_MS = 1200; const THRESHOLD = 12; const SILENCE_MS = 2000
      let silenceStart = null; let hasSpeech = false
      const check = () => {
        if (!groupCallActiveRef.current || recorder.state === 'inactive') return
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

  const startGroupCall = async () => {
    if (!groupCharacters.length || groupCallMode) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      groupCallStreamRef.current = stream
      groupCallActiveRef.current = true
      setGroupCallMode(true)
      setGroupCallPhase('greeting')
      setGroupCallSeconds(0)
      setGroupCallTranscript([])
      groupConvIdRef.current = null
      groupCallTimerRef.current = setInterval(() => setGroupCallSeconds(s => s + 1), 1000)
      for (let i = 0; i < groupCharacters.length; i++) {
        if (!groupCallActiveRef.current) break
        const char = groupCharacters[i]
        setGroupCallSpeaker(char)
        const greeting = `你好，我是${char.name}，${char.description}。很高兴和大家一起对话。`
        await groupCallSpeak(greeting, char.gender)
      }
      if (groupCallActiveRef.current) groupCallListen(stream)
    } catch (e) {
      groupCallActiveRef.current = false
      setGroupCallMode(false)
      alert('无法访问麦克风，请检查浏览器权限')
    }
  }

  // ── 付款弹窗（共享，各页都可触发）──────────────────────
  const payModalEl = showPayModal && (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={() => setShowPayModal(false)}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl px-8 py-8 max-w-xs w-full text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-4xl mb-2">👑</div>
        <h2 className="text-xl font-bold text-amber-800 mb-1">解锁会员</h2>
        <p className="text-xs text-gray-400 mb-5">扫码转账后评论备注手机号，手动开通</p>
        <div className="bg-amber-50 rounded-2xl p-3 mb-4">
          <img
            src="/pay-qr.png"
            alt="收款码"
            className="w-full max-w-[180px] mx-auto rounded-xl block"
            onError={e => {
              e.target.replaceWith(
                Object.assign(document.createElement('div'), {
                  className: 'w-[180px] h-[180px] mx-auto rounded-xl bg-amber-100 border-2 border-dashed border-amber-300 flex flex-col items-center justify-center gap-2 text-center p-4',
                  innerHTML: '<div style="font-size:2rem">🖼️</div><p style="font-size:0.7rem;color:#b45309">收款码未上传<br/>请将图片放入<br/><b>frontend/public/pay-qr.png</b><br/>并推送到 GitHub</p>'
                })
              )
            }}
          />
          <p className="text-xs text-amber-400 mt-2">微信收款码</p>
        </div>
        <div className="space-y-1.5 text-xs text-gray-500 text-left bg-gray-50 rounded-xl p-3 mb-5">
          <p>✅ 群聊功能（多位历史人物同台）</p>
          <p>✅ 语音通话不限时长</p>
          <p>✅ 无限对话次数</p>
        </div>
        <button
          onClick={() => setShowPayModal(false)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >关闭</button>
      </div>
    </div>
  )

  // ── 登录门禁 ─────────────────────────────────────────
  if (!authReady) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-amber-400 text-sm animate-pulse">正在加载…</div>
      </div>
    )
  }
  if (!user) return <LoginPage onLogin={handleLogin} />

  // ── 群聊选人页 ─────────────────────────────────────────
  if (page === 'group-select') {
    return (
      <>
      <div className="h-screen bg-amber-50 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-amber-200 shadow-sm shrink-0">
          <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setPage('characters'); setGroupSelectedChars([]) }}
                className="text-amber-600 hover:text-amber-800 text-sm border border-amber-200 hover:border-amber-400 px-3 py-1.5 rounded-xl transition-colors shrink-0"
              >← 返回</button>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-amber-800">👥 创建群聊</h1>
                <p className="text-xs text-amber-400">选择 2-3 位历史人物同台对话</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (groupSelectedChars.length < 2) return
                setGroupCharacters(groupSelectedChars)
                setGroupMessages([])
                groupConvIdRef.current = null
                setPage('group-chat')
              }}
              disabled={groupSelectedChars.length < 2}
              className="shrink-0 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              开始群聊 ({groupSelectedChars.length}/3)
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto max-w-screen-xl mx-auto w-full px-4 md:px-6 py-4">
          <p className="text-xs text-amber-400 mb-4">点击人物卡片选择，最多 3 位</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {characters.map(character => {
              const selected = groupSelectedChars.some(c => c._id === character._id)
              const disabled = !selected && groupSelectedChars.length >= 3
              return (
                <button
                  key={character._id}
                  disabled={disabled}
                  onClick={() => {
                    if (selected) {
                      setGroupSelectedChars(prev => prev.filter(c => c._id !== character._id))
                    } else if (groupSelectedChars.length < 3) {
                      setGroupSelectedChars(prev => [...prev, character])
                    }
                  }}
                  className={`relative bg-white border rounded-2xl p-4 flex flex-col items-center gap-3 text-center transition-all ${
                    selected
                      ? 'border-amber-500 shadow-md ring-2 ring-amber-400 ring-offset-1'
                      : disabled
                      ? 'border-amber-100 opacity-40 cursor-not-allowed'
                      : 'border-amber-100 hover:border-amber-400 hover:shadow-md'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  )}
                  <Avatar name={character.name} className="w-14 h-14 text-2xl" />
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{character.name}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{character.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {payModalEl}
      </>
    )
  }

  // ── 群聊对话页 ─────────────────────────────────────────
  if (page === 'group-chat') {
    const speakingChar = groupSpeakerIdx !== null ? groupCharacters[groupSpeakerIdx] : null
    return (
      <>
      <div className="h-screen bg-amber-50 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-amber-200 shadow-sm shrink-0">
          <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => { setPage('characters'); setGroupCharacters([]); setGroupMessages([]) }}
                className="text-amber-600 hover:text-amber-800 text-sm border border-amber-200 px-3 py-1.5 rounded-xl transition-colors shrink-0"
              >← 退出</button>
              <div className="flex items-center -space-x-2 shrink-0">
                {groupCharacters.map((c, i) => (
                  <div key={c._id} style={{ zIndex: 10 - i }} className="relative">
                    <Avatar name={c.name} className="w-8 h-8 text-xs ring-2 ring-white" />
                  </div>
                ))}
              </div>
              <div className="min-w-0">
                <h1 className="text-sm md:text-base font-bold text-amber-800 truncate">
                  {groupCharacters.map(c => c.name).join(' · ')}
                </h1>
                <p className="text-xs text-amber-400">跨越时空的对话</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={startGroupCall}
                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                📞 群通话
              </button>
              <button
                onClick={() => setShowPayModal(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                👑 会员
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto max-w-screen-xl mx-auto w-full px-4 md:px-6 py-4 space-y-4">
          {groupMessages.length === 0 && (
            <div className="text-center text-amber-400 text-sm pt-16">
              <div className="text-5xl mb-3">👥</div>
              <p>发送消息，开启跨越时空的碰撞</p>
              <div className="mt-4 flex justify-center gap-2 flex-wrap">
                {groupCharacters.map(c => (
                  <span key={c._id} className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">{c.name}</span>
                ))}
              </div>
            </div>
          )}
          {groupMessages.map((msg, idx) => {
            if (msg.role === 'user') {
              return (
                <div key={idx} className="flex flex-row-reverse gap-3">
                  <div className="px-4 py-2.5 rounded-2xl rounded-tr-none text-sm leading-relaxed bg-amber-500 text-white max-w-[72%]">
                    {msg.content}
                  </div>
                </div>
              )
            }
            return (
              <div key={idx} className="flex gap-3">
                <Avatar name={msg.speakerName} className="w-8 h-8 text-xs mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1 max-w-[72%]">
                  <div className="text-xs text-amber-600 font-medium px-1">{msg.speakerName}</div>
                  <div className="px-4 py-2.5 rounded-2xl rounded-tl-none text-sm leading-relaxed bg-white border border-amber-100 text-gray-800">
                    {renderContent(msg.content)}
                  </div>
                </div>
              </div>
            )
          })}
          {groupLoading && speakingChar && (
            <div className="flex gap-3">
              <Avatar name={speakingChar.name} className="w-8 h-8 text-xs mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <div className="text-xs text-amber-600 font-medium px-1">{speakingChar.name}</div>
                <div className="bg-white border border-amber-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm text-amber-400">
                  <span className="animate-pulse">正在思考…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 max-w-screen-xl mx-auto w-full px-4 md:px-6 py-3 border-t border-amber-100 bg-amber-50">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => {
                const next = !groupAutoRun
                setGroupAutoRun(next)
                groupAutoRunRef.current = next
                if (next && !groupLoading && groupMessages.length > 0) {
                  handleGroupSend('', true)
                } else if (!next) {
                  groupAbortRef.current = true
                }
              }}
              className={`text-xs px-4 py-1.5 rounded-xl font-medium transition-colors border ${
                groupAutoRun
                  ? 'bg-purple-500 text-white border-purple-500'
                  : 'bg-white text-purple-600 border-purple-200 hover:border-purple-400'
              }`}
            >
              {groupAutoRun ? '⏸ 暂停讨论' : '▶ 自由讨论'}
            </button>
            {groupLoading && (
              <button
                onClick={() => { groupAbortRef.current = true; setGroupLoading(false); setGroupSpeakerIdx(null); setGroupAutoRun(false) }}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-4 py-1.5 rounded-xl transition-colors"
              >
                ⏸ 打断发言
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={groupInput}
              onChange={e => setGroupInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleGroupSend(groupInput)}
              placeholder="向历史人物们提问…"
              disabled={groupLoading}
              className="flex-1 bg-white border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
            />
            <button
              onClick={() => handleGroupSend(groupInput)}
              disabled={groupLoading || !groupInput.trim()}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      </div>
      {payModalEl}

      {/* ── 群通话全屏遮罩 ── */}
      {groupCallMode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-gray-900 via-purple-950 to-gray-900 px-6 py-10">
          <div className="w-full flex justify-center">
            <span className="text-white/50 text-sm tabular-nums">
              {String(Math.floor(groupCallSeconds / 60)).padStart(2, '0')}:{String(groupCallSeconds % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-end gap-4">
              {groupCharacters.map((c) => (
                <div key={c._id} className={`flex flex-col items-center gap-2 transition-all duration-300 ${
                  groupCallSpeaker?._id === c._id ? 'scale-110' : 'opacity-50 scale-95'
                }`}>
                  <div className={`rounded-full ${
                    groupCallSpeaker?._id === c._id && groupCallPhase === 'speaking'
                      ? 'ring-4 ring-purple-400 ring-offset-4 ring-offset-gray-900'
                      : groupCallPhase === 'listening' && !groupCallSpeaker
                      ? 'ring-4 ring-green-400 ring-offset-4 ring-offset-gray-900'
                      : ''
                  } transition-all`}>
                    <Avatar
                      name={c.name}
                      className={`w-20 h-20 text-3xl ${
                        groupCallSpeaker?._id === c._id && groupCallPhase === 'speaking' ? 'animate-pulse' : ''
                      }`}
                    />
                  </div>
                  <span className="text-xs text-white/70">{c.name}</span>
                </div>
              ))}
            </div>
            <div className={`text-sm ${
              groupCallPhase === 'speaking' ? 'text-purple-400' :
              groupCallPhase === 'listening' ? 'text-green-400' :
              groupCallPhase === 'processing' ? 'text-blue-300' : 'text-white/50'
            }`}>
              {groupCallPhase === 'speaking' && `🔊 ${groupCallSpeaker?.name ?? ''} 正在说话…`}
              {groupCallPhase === 'listening' && '🎙 正在聆听你的声音…'}
              {groupCallPhase === 'processing' && '💭 正在思考…'}
              {groupCallPhase === 'greeting' && '📞 正在接通…'}
            </div>
            {groupCallTranscript.length > 0 && (
              <div className="w-full max-w-sm bg-white/5 rounded-2xl px-4 py-3 space-y-2 max-h-36 overflow-y-auto">
                {groupCallTranscript.slice(-5).map((t, i) => (
                  <div key={i} className={`text-xs leading-snug ${
                    t.role === 'user' ? 'text-white/70 text-right' : 'text-purple-300/80 text-left'
                  }`}>
                    <span className="opacity-50 mr-1">{t.role === 'user' ? '你' : t.speakerName}：</span>
                    {t.text?.replace(/【[^】]*】/g, '').slice(0, 60)}{(t.text?.length ?? 0) > 60 ? '…' : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-8">
            {groupCallPhase === 'speaking' && (
              <button
                onClick={() => {
                  groupCallInterruptedRef.current = true
                  if (callSpeakAbortRef.current) callSpeakAbortRef.current()
                }}
                className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-2xl flex items-center justify-center shadow-lg transition-all"
                title="打断，立即聆听"
              >
                ✋
              </button>
            )}
            <button
              onClick={endGroupCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white text-2xl flex items-center justify-center shadow-lg transition-all"
              title="挂断"
            >
              📵
            </button>
          </div>
        </div>
      )}
      </>
    )
  }

  // ── 人物选择页 ─────────────────────────────────────────
  if (page === 'characters') {
    const filtered = characters.filter(c => {
      if (categoryFilter !== '全部' && getCategory(c) !== categoryFilter) return false
      if (categoryFilter === '国内' && dynastyFilter !== '全部' && c.dynasty !== dynastyFilter) return false
      if (searchQuery && !c.name.includes(searchQuery) && !(c.description || '').includes(searchQuery)) return false
      return true
    })
    return (
      <>
      <div className="min-h-screen bg-amber-50 flex flex-col">
        <header className="bg-white border-b border-amber-200 shadow-sm">
          <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-amber-800">📜 历史人物 AI 对话</h1>
              <p className="text-xs md:text-sm text-amber-400 mt-0.5">穿越时空，与历史对话</p>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              {conversations.length > 0 && (
                <button
                  onClick={() => setPage('chat')}
                  className="text-xs md:text-sm text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 px-3 md:px-4 py-1.5 md:py-2 rounded-xl transition-colors"
                >
                  💭 历史会话 ({conversations.length})
                </button>
              )}
              <button
                onClick={() => { setGroupSelectedChars([]); setPage('group-select') }}
                className="text-xs md:text-sm bg-purple-500 hover:bg-purple-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-xl font-medium transition-colors"
              >
                👥 群聊
              </button>
              <button
                onClick={() => setShowPayModal(true)}
                className="text-xs md:text-sm bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-xl font-medium transition-all"
              >
                👑 会员
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="text-xs md:text-sm truncate max-w-[100px] md:max-w-none">👤 {user?.nickname || user?.phone}</span>
                <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-400 transition-colors">退出</button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-screen-xl mx-auto w-full px-4 md:px-6 py-4 md:py-6 flex-1">
            {/* 群聊入口横幅 */}
            <div
              onClick={() => { setGroupSelectedChars([]); setPage('group-select') }}
              className="w-full mb-5 cursor-pointer bg-gradient-to-r from-purple-50 to-amber-50 border border-purple-200 hover:border-purple-400 rounded-2xl px-5 py-3.5 flex items-center gap-4 transition-all hover:shadow-md"
            >
              <span className="text-3xl">👥</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-purple-800 text-sm">群聊模式 · 跨越时空的碰撞</div>
                <div className="text-xs text-purple-400 mt-0.5 truncate">选 2-3 个历史人物同台对话，互相辩论</div>
              </div>
              <span className="text-purple-400 text-sm shrink-0">→</span>
            </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
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
      {payModalEl}
      </>
    )
  }

  // ── 对话页 ──────────────────────────────────────────────
  return (
    <>
    <div className="h-screen bg-amber-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-amber-200 shadow-sm shrink-0">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(s => !s)}
              className="md:hidden text-amber-600 hover:text-amber-800 p-1.5 rounded-xl hover:bg-amber-50 transition-colors text-lg leading-none"
              title="菜单"
            >☰</button>
            <h1 className="text-lg md:text-xl font-bold text-amber-800">📜 历史人物 AI 对话</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="text-xs md:text-sm truncate max-w-[80px] md:max-w-none">👤 {user?.nickname || user?.phone}</span>
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-400 transition-colors shrink-0">退出</button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto w-full px-4 md:px-6 py-4 md:py-5 flex gap-0 md:gap-5 flex-1 min-h-0">
        {/* 移动端侧栏遮罩 */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        {/* 左侧菜单栏 */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 flex flex-col gap-3 bg-amber-50 border-r border-amber-200 px-4 py-4 overflow-y-auto transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:inset-auto md:z-auto md:w-56 md:shrink-0 md:bg-transparent md:border-0 md:px-0 md:py-0 md:overflow-visible md:translate-x-0 md:transition-none`}>
          {/* 返回按钮 */}
          <button
            onClick={() => { setPage('characters'); setSidebarOpen(false) }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-amber-700 hover:text-amber-900 text-sm font-medium transition-colors"
          >
            ← 选择人物
          </button>

          {/* 新对话按钮 */}
          {selectedCharacter && (
            <button
              onClick={() => { handleNewConversation(); setSidebarOpen(false) }}
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
                  <Avatar name={conv.characterName?.[0] || '?'} className="w-7 h-7 text-xs mt-0.5 shrink-0" />
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
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {!selectedCharacter ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
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
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm flex flex-col flex-1 min-h-0">
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
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
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

          {/* 底部：操作按钮 */}
          <div className="flex items-center gap-8">
            {callPhase === 'speaking' && (
              <button
                onClick={handleCallInterrupt}
                className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-2xl flex items-center justify-center shadow-lg transition-all"
                title="打断"
              >
                ✋
              </button>
            )}
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white text-2xl flex items-center justify-center shadow-lg transition-all"
              title="挂断"
            >
              📵
            </button>
          </div>
        </div>
      )}

      {payModalEl}
    </>
  )
}

export default App
