import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, Plus, Menu, Moon, Sun, BookOpen, ExternalLink, Database, Zap, Globe, MessageCircle, RefreshCw, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  routingDecision?: string
  webResults?: any[]
  chatResults?: any[]
}

interface Chat {
  id: string
  title: string
  messages: Message[]
}

interface ResponseData {
  final_response: string
  agent_responses: Array<{
    agent_used: string
    response: string
    data: {
      web_results_count: number
      chat_results_count: number
      retrieved_context_count: number
      primary_source: string
    }
    sources: string[]
    processing_time_ms: number
    success: boolean
    error: string | null
  }>
  total_processing_time_ms: number
  conversation_id: string
  success: boolean
  error: string | null
}

function MasterAgentV2() {
  const router = useRouter()
  const [input, setInput] = useState('How my employees are working')
  const [uid, setUid] = useState('902')
  const [conversationId] = useState('1')
  const [chats, setChats] = useState<Chat[]>([{
    id: '1',
    title: 'New Chat',
    messages: []
  }])
  const [currentChatId, setCurrentChatId] = useState('1')
  
  const [showSidebar, setShowSidebar] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [streamingState, setStreamingState] = useState({
    status: '',
    stage: '',
    routingDecision: '',
    webResults: [] as any[],
    chatResults: [] as any[],
    isLoading: false
  })
  const [darkMode, setDarkMode] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  // Start with default to avoid hydration mismatch
  const [apiUrl, setApiUrl] = useState('http://localhost:8000')
  const [mounted, setMounted] = useState(false)
  
  // Load from localStorage after hydration
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apiUrl')
      if (saved) {
        setApiUrl(saved)
      }
    }
  }, [])
  
  const apiUrlOptions = [
    'http://dko04c08848wsc8ckskgwwss.5.161.63.64.sslip.io',
    'http://localhost:8000',
    'https://6ac428957655.ngrok-free.app'
  ]
  
  // Helper function to get headers with ngrok support
  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // Add ngrok-skip-browser-warning header for ngrok URLs
    if (apiUrl.includes('ngrok-free.app') || apiUrl.includes('ngrok.io') || apiUrl.includes('ngrok.app')) {
      headers['ngrok-skip-browser-warning'] = 'true'
    }
    
    return headers
  }
  
  // Listen for apiUrl changes from Settings
  useEffect(() => {
    const handleApiUrlChange = (e: Event) => {
      const customEvent = e as CustomEvent
      setApiUrl(customEvent.detail)
    }
    
    window.addEventListener('apiUrlChanged', handleApiUrlChange as EventListener)
    return () => window.removeEventListener('apiUrlChanged', handleApiUrlChange as EventListener)
  }, [])
  
  // Save apiUrl changes to localStorage and notify other pages
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      localStorage.setItem('apiUrl', apiUrl)
      window.dispatchEvent(new CustomEvent('apiUrlChanged', { detail: apiUrl }))
    }
  }, [apiUrl, mounted])

  const currentChat = chats.find(chat => chat.id === currentChatId) || chats[0]
  const messages = currentChat.messages
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingState])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing || !uid.trim()) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    // Update current chat with user message
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === currentChatId 
          ? { 
              ...chat, 
              messages: [...chat.messages, userMessage],
              title: chat.messages.length === 0 ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : chat.title
            }
          : chat
      )
    )

    const queryText = input
    setInput('')
    setIsProcessing(true)
    setApiError(null)

    // Route to streaming or non-streaming handler
    if (useStreaming) {
      await handleStreamingQuery(queryText)
      setIsProcessing(false)
      return
    }

    try {
      const response = await fetch(`${apiUrl}/master-agent-v2/query`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          query: queryText,
          uid: uid,
          conversation_id: conversationId
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data: ResponseData = await response.json()
      
      // Extract the final response
      let aiContent = data.final_response || ''
      
      const aiMessage: Message = {
        role: 'assistant',
        content: aiContent,
        timestamp: new Date()
      }
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, messages: [...chat.messages, aiMessage] }
            : chat
        )
      )
    } catch (error) {
      console.error('API Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setApiError(errorMessage)
      
      const errorAiMessage: Message = {
        role: 'assistant',
        content: `⚠️ Error connecting to the API:\n\n${errorMessage}\n\nPlease check:\n- Your internet connection\n- The API endpoint is accessible\n- Your UID is correct\n- The API service is running`,
        timestamp: new Date()
      }
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, messages: [...chat.messages, errorAiMessage] }
            : chat
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStreamingQuery = async (queryText: string) => {
    let accumulatedAnswer = ''
    let tempMessageIndex = messages.length + 1
    let capturedRoutingDecision = ''
    let capturedWebResults: any[] = []
    let capturedChatResults: any[] = []
    
    // Reset streaming state
    setStreamingState({
      status: '',
      stage: '',
      routingDecision: '',
      webResults: [],
      chatResults: [],
      isLoading: true
    })
    
    // Create placeholder message for streaming
    const placeholderMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }
    
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: [...chat.messages, placeholderMessage] }
          : chat
      )
    )

    try {
      const response = await fetch(`${apiUrl}/master-agent-v2/query/stream`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          query: queryText,
          uid: uid,
          conversation_id: conversationId
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body reader available')

      let buffer = ''
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim()
            
            if (data === '[DONE]') {
              // Update final message with complete content and results
              setChats(prevChats => 
                prevChats.map(chat => 
                  chat.id === currentChatId 
                    ? {
                        ...chat,
                        messages: chat.messages.map((msg, idx) => 
                          idx === tempMessageIndex
                            ? { 
                                ...msg, 
                                content: accumulatedAnswer, 
                                isStreaming: false,
                                routingDecision: capturedRoutingDecision,
                                webResults: capturedWebResults,
                                chatResults: capturedChatResults
                              }
                            : msg
                        )
                      }
                    : chat
                )
              )
              
              // Reset streaming state
              setStreamingState(prev => ({
                ...prev,
                isLoading: false
              }))
              
              return
            }

            try {
              const event = JSON.parse(data)
              
              switch (event.type) {
                case 'status':
                  setStreamingState(prev => ({
                    ...prev,
                    status: event.message,
                    stage: event.stage
                  }))
                  break
                  
                case 'routing_decision':
                  capturedRoutingDecision = event.agent_name
                  setStreamingState(prev => ({
                    ...prev,
                    routingDecision: event.agent_name
                  }))
                  break
                  
                case 'web_results':
                  capturedWebResults = event.results || []
                  setStreamingState(prev => ({
                    ...prev,
                    webResults: event.results || []
                  }))
                  break
                  
                case 'chat_results':
                  capturedChatResults = event.results || []
                  setStreamingState(prev => ({
                    ...prev,
                    chatResults: event.results || []
                  }))
                  break
                  
                case 'response':
                case 'answer_chunk':
                  accumulatedAnswer += event.content
                  // Update streaming message in real-time
                  setChats(prevChats => 
                    prevChats.map(chat => 
                      chat.id === currentChatId 
                        ? {
                            ...chat,
                            messages: chat.messages.map((msg, idx) => 
                              idx === tempMessageIndex
                                ? { ...msg, content: accumulatedAnswer }
                                : msg
                            )
                          }
                        : chat
                    )
                  )
                  break
                  
                case 'complete':
                  console.log('✅ Complete')
                  // If there's a full answer in the complete event, use it
                  if (event.answer) {
                    accumulatedAnswer = event.answer
                  }
                  setStreamingState(prev => ({
                    ...prev,
                    isLoading: false
                  }))
                  break
                  
                case 'error':
                  throw new Error(event.message)
              }
            } catch (e) {
              if (data && data !== '[DONE]') {
                console.warn('Failed to parse SSE event:', e)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setApiError(errorMessage)
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === currentChatId 
            ? {
                ...chat,
                messages: chat.messages.map((msg, idx) => 
                  idx === tempMessageIndex
                    ? {
                        ...msg,
                        content: `⚠️ Error: ${errorMessage}`,
                        isStreaming: false
                      }
                    : msg
                )
              }
            : chat
        )
      )
    }
  }

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: []
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChat.id)
  }

  const deleteChat = (chatId: string) => {
    if (chats.length === 1) return
    setChats(prev => prev.filter(chat => chat.id !== chatId))
    if (currentChatId === chatId) {
      setCurrentChatId(chats.find(chat => chat.id !== chatId)?.id || chats[0].id)
    }
  }

  const textClass = darkMode ? 'text-gray-100' : 'text-gray-800'
  const borderClass = darkMode ? 'border-gray-700' : 'border-gray-200'
  const hoverBgClass = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
  const inputBgClass = darkMode ? 'bg-gray-700' : 'bg-white'
  const sidebarBgClass = darkMode ? 'bg-gray-900' : 'bg-gray-50'
  const mainBgClass = darkMode ? 'bg-gray-800' : 'bg-white'

  return (
    <div className={`flex h-screen ${darkMode ? 'dark bg-gray-800' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-64' : 'w-0'} ${sidebarBgClass} transition-all duration-300 overflow-hidden flex flex-col border-r ${borderClass}`}>
        <div className="p-3 border-b border-gray-700">
          <button
            onClick={createNewChat}
            className={`w-full flex items-center gap-3 px-3 py-2.5 ${hoverBgClass} ${textClass} rounded-lg transition-colors border ${borderClass}`}
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">New chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={`group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                currentChatId === chat.id 
                  ? darkMode ? 'bg-gray-700' : 'bg-gray-200'
                  : hoverBgClass
              }`}
            >
              <MessageSquare className={`w-4 h-4 ${textClass} flex-shrink-0`} />
              <span className={`flex-1 text-sm ${textClass} truncate`}>
                {chat.title}
              </span>
              {chats.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(chat.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className={`p-3 border-t ${borderClass}`}>
          <div className="mb-2 space-y-2">
            <button
              onClick={() => router.push('/')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'} text-white rounded-lg transition-colors mb-2`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm">Knowledge Base</span>
            </button>
            <div className={`h-px ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-green-600' : 'bg-green-500'} text-white rounded-lg opacity-75 cursor-default mb-2`}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm">Master Agent V2</span>
            </button>
            <button
              onClick={() => router.push('/master-agent-v3')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-teal-600 hover:bg-teal-700' : 'bg-teal-500 hover:bg-teal-600'} text-white rounded-lg transition-colors mb-2`}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm">Master Agent V3</span>
            </button>
            <button
              onClick={() => router.push('/bigquery')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg transition-colors mb-2`}
            >
              <Database className="w-4 h-4" />
              <span className="text-sm">BigQuery</span>
            </button>
            <button
              onClick={() => router.push('/hubspot')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-500 hover:bg-orange-600'} text-white rounded-lg transition-colors mb-2`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">HubSpot Agent</span>
            </button>
            <div className={`h-px ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 ${hoverBgClass} ${textClass} rounded-lg transition-colors mb-2`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="text-sm">{darkMode ? 'Light' : 'Dark'} mode</span>
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 ${hoverBgClass} ${textClass} rounded-lg transition-colors ${showSettings ? (darkMode ? 'bg-gray-700' : 'bg-gray-200') : ''}`}
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className={`${mainBgClass} border-b ${borderClass} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`${textClass} ${hoverBgClass} p-2 rounded-lg`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className={`text-lg font-semibold ${textClass}`}>
              Master Agent V2
            </h1>
          </div>
          
          {/* Streaming Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseStreaming(!useStreaming)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                useStreaming 
                  ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                  : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">
                {useStreaming ? 'Streaming' : 'Standard'}
              </span>
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className={`${mainBgClass} flex-1 overflow-y-auto p-6`}>
            <div className="max-w-4xl mx-auto">
              <h3 className={`text-lg font-semibold ${textClass} mb-2`}>Settings</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-3`}>
                Configure your Master Agent V2 preferences.
              </p>

              {/* Streaming Settings */}
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 mb-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`text-sm font-medium ${textClass} flex items-center gap-2`}>
                      <Zap className="w-4 h-4" />
                      Response Streaming
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {useStreaming ? 'Answers appear word-by-word in real-time (faster UX)' : 'Complete answers appear after processing (traditional)'}
                    </p>
                  </div>
                  <button
                    onClick={() => setUseStreaming(!useStreaming)}
                    className={`px-4 py-2 ${useStreaming ? (darkMode ? 'bg-blue-600' : 'bg-blue-500') : (darkMode ? 'bg-gray-600' : 'bg-gray-300')} text-white rounded-lg font-medium transition-colors`}
                  >
                    {useStreaming ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-600'} space-y-1`}>
                  <p>• Streaming: ~600ms to first word, typewriter effect with live results</p>
                  <p>• Standard: 6-8s wait, complete answer at once</p>
                </div>
              </div>

              {/* API URL Configuration */}
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 mb-4`}>
                <div className="mb-3">
                  <p className={`text-sm font-medium ${textClass} mb-2`}>API Server Configuration</p>
                  <div className="space-y-2">
                    <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      API Server URL
                    </label>
                    <select
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className={`w-full ${inputBgClass} border ${borderClass} rounded-lg px-3 py-2 text-sm ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      {apiUrlOptions.map((url) => (
                        <option key={url} value={url}>
                          {url}
                        </option>
                      ))}
                    </select>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Selected URL will be used for all API calls
                    </p>
                  </div>
                </div>
              </div>

              {/* Theme Settings */}
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 mb-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${textClass}`}>Theme</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Currently using {darkMode ? 'dark' : 'light'} mode
                    </p>
                  </div>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`px-4 py-2 ${hoverBgClass} ${textClass} rounded-lg border ${borderClass}`}
                  >
                    Toggle
                  </button>
                </div>
              </div>

              {/* About */}
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4`}>
                <p className={`text-sm font-medium ${textClass} mb-1`}>About</p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Master Agent V2 - Routes queries to appropriate agents
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area - Only show when settings is closed */}
        {!showSettings && (
          <div className={`flex-1 overflow-y-auto ${mainBgClass}`}>
            {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} mb-4`}>
                  <MessageSquare className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </div>
                <h2 className={`text-2xl font-semibold ${textClass} mb-2`}>
                  Master Agent V2
                </h2>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                  Ask about your employees or anything else
                </p>
                {useStreaming && (
                  <div className={`inline-block px-3 py-1 rounded-full text-xs ${darkMode ? 'bg-blue-900/30 text-blue-400 border border-blue-700' : 'bg-blue-100 text-blue-700 border border-blue-300'} mb-2`}>
                    <Zap className="w-3 h-3 inline mr-1" />
                    Streaming Mode Active
                  </div>
                )}
                <br />
                {uid.trim() && (
                  <div className={`inline-block px-3 py-1 rounded-full text-xs ${darkMode ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-green-100 text-green-700 border border-green-300'}`}>
                    ✓ User ID: {uid} | Conversation ID: {conversationId}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-4 py-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`mb-8`}
                >
                  <div className="flex gap-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user' 
                        ? darkMode ? 'bg-blue-600' : 'bg-blue-500'
                        : darkMode ? 'bg-green-600' : 'bg-green-500'
                    }`}>
                      <span className="text-white text-sm font-semibold">
                        {message.role === 'user' ? 'U' : 'AI'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${textClass} mb-1 flex items-center gap-2`}>
                        {message.role === 'user' ? 'You' : 'Assistant'}
                        {message.isStreaming && (
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        )}
                      </div>
                      
                      {/* Status and Routing Decision */}
                      {(message.isStreaming || message.routingDecision) && (
                        <div className={`mb-3 p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          {(message.routingDecision || (message.isStreaming && streamingState.routingDecision)) && (
                            <div className="text-xs mb-1">
                              <span className={`font-medium ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                                🎯 Agent: {message.routingDecision || streamingState.routingDecision}
                              </span>
                            </div>
                          )}
                          {message.isStreaming && streamingState.status && (
                            <div className="text-xs flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                                {streamingState.status}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Web Results */}
                      {((message.isStreaming && streamingState.webResults.length > 0) || message.webResults) && (
                        <div className={`mb-3 p-3 rounded border ${darkMode ? 'bg-blue-900/10 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                            <h4 className={`font-semibold text-xs ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                              Web Results ({(message.webResults || streamingState.webResults).length})
                            </h4>
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {(message.webResults || streamingState.webResults).slice(0, 3).map((result, idx) => (
                              <div key={idx} className={`text-xs p-2 rounded ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                    Score: {result.score?.toFixed(3)}
                                  </span>
                                  {result.source_url && (
                                    <a href={result.source_url} target="_blank" rel="noopener noreferrer" className={`text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'} underline`}>
                                      Source →
                                    </a>
                                  )}
                                </div>
                                <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'} line-clamp-2`}>
                                  {result.text?.substring(0, 150)}...
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Chat Results */}
                      {((message.isStreaming && streamingState.chatResults.length > 0) || message.chatResults) && (
                        <div className={`mb-3 p-3 rounded border ${darkMode ? 'bg-green-900/10 border-green-800' : 'bg-green-50 border-green-200'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className={`w-4 h-4 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                            <h4 className={`font-semibold text-xs ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                              Chat Results ({(message.chatResults || streamingState.chatResults).length})
                            </h4>
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {(message.chatResults || streamingState.chatResults).slice(0, 3).map((result, idx) => (
                              <div key={idx} className={`text-xs p-2 rounded ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                                    Score: {result.score?.toFixed(3)}
                                  </span>
                                  {result.messageCount && (
                                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      💬 {result.messageCount} messages
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'} line-clamp-2`}>
                                  {result.text?.substring(0, 150)}...
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className={`${textClass} whitespace-pre-wrap leading-7 break-words`}>
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-0.5 h-5 bg-blue-400 ml-1 animate-pulse"></span>
                        )}
                      </div>
                      
                      <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isProcessing && messages.length > 0 && (
                <div className="mb-8">
                  <div className="flex gap-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-green-600' : 'bg-green-500'}`}>
                      <span className="text-white text-sm font-semibold">AI</span>
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${textClass} mb-1`}>Assistant</div>
                      <div className="flex gap-1">
                        <div className={`w-2 h-2 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                        <div className={`w-2 h-2 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                        <div className={`w-2 h-2 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
          </div>
        )}

        {/* Input Area */}
        <div className={`${mainBgClass} border-t ${borderClass} p-4`}>
          <div className="max-w-3xl mx-auto">
            {/* UID Input */}
            <div className="mb-3 flex items-center gap-2">
              <label className={`text-sm font-medium ${textClass} whitespace-nowrap`}>
                User ID:
              </label>
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="Enter UID (e.g., 902)"
                className={`flex-1 ${inputBgClass} border ${borderClass} rounded-lg px-3 py-2 text-sm ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {apiError && (
                <div className="flex items-center gap-1 text-red-500 text-xs">
                  <span className="font-semibold">⚠️</span>
                  <span>API Error</span>
                </div>
              )}
            </div>

            {/* Query Input */}
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder="Message AI... (e.g., How my employees are working?)"
                disabled={isProcessing || !uid.trim()}
                className={`w-full ${inputBgClass} border ${borderClass} rounded-2xl pl-4 pr-12 py-3 ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50`}
                rows={1}
                style={{ minHeight: '52px', maxHeight: '200px' }}
              />
              <button
                type="submit"
                disabled={isProcessing || !input.trim() || !uid.trim()}
                className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${
                  isProcessing || !input.trim() || !uid.trim()
                    ? darkMode ? 'text-gray-600' : 'text-gray-400'
                    : darkMode ? 'bg-white text-gray-900 hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-700'
                } disabled:cursor-not-allowed`}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <p className={`text-xs text-center mt-3 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`} suppressHydrationWarning>
              {uid.trim() ? 
                `Server: ${mounted ? apiUrl : 'http://localhost:8000'} • UID: ${uid} • Conv ID: ${conversationId} • ${useStreaming ? 'Streaming ⚡' : 'Standard'}` : 
                'Please enter a User ID to continue'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MasterAgentV2

