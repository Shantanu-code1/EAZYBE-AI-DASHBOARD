import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, Plus, Menu, Moon, Sun, BookOpen, ExternalLink, Database, MessageCircle, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    raw_data?: any
    api_call_details?: {
      endpoint_path?: string
      http_method?: string
      reasoning?: string
      request_body?: any
    }
    error?: string | null
    execution_time?: number
  }
}

interface Chat {
  id: string
  title: string
  messages: Message[]
}

interface ResponseData {
  answer: string
  raw_data?: any
  api_call_details?: {
    endpoint_path?: string
    http_method?: string
    reasoning?: string
    request_body?: any
  }
  error?: string | null
  execution_time: number
}

function HubSpotAgent() {
  const router = useRouter()
  const [input, setInput] = useState('What is the last ticket created by Shivam sharma?')
  const [orgId, setOrgId] = useState('902')
  const [chats, setChats] = useState<Chat[]>([{
    id: '1',
    title: 'New Chat',
    messages: []
  }])
  const [currentChatId, setCurrentChatId] = useState('1')
  
  const [showSidebar, setShowSidebar] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
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
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing || !orgId.trim()) return

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

    try {
      const response = await fetch(`${apiUrl}/v3/hubspot/query`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          query: queryText,
          org_id: orgId
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data: ResponseData = await response.json()
      
      // Extract the answer
      let aiContent = data.answer || ''
      
      const aiMessage: Message = {
        role: 'assistant',
        content: aiContent,
        timestamp: new Date(),
        metadata: {
          raw_data: data.raw_data,
          api_call_details: data.api_call_details,
          error: data.error,
          execution_time: data.execution_time
        }
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
        content: `⚠️ Error connecting to the API:\n\n${errorMessage}\n\nPlease check:\n- Your internet connection\n- The API endpoint is accessible\n- Your Org ID is correct\n- The API service is running`,
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
              onClick={() => router.push('/master-agent-v2')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white rounded-lg transition-colors mb-2`}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm">Master Agent V2</span>
            </button>
            <button
              onClick={() => router.push('/bigquery')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg transition-colors mb-2`}
            >
              <Database className="w-4 h-4" />
              <span className="text-sm">BigQuery</span>
            </button>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-orange-600' : 'bg-orange-500'} text-white rounded-lg opacity-75 cursor-default`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">HubSpot Agent</span>
            </button>
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
            <h1 className={`text-lg font-semibold ${textClass} flex items-center gap-2`}>
              <MessageCircle className="w-5 h-5" />
              HubSpot Agent
            </h1>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className={`${mainBgClass} flex-1 overflow-y-auto p-6`}>
            <div className="max-w-4xl mx-auto">
              <h3 className={`text-lg font-semibold ${textClass} mb-2`}>Settings</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-3`}>
                Configure your HubSpot Agent preferences.
              </p>

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
                  HubSpot Agent - Ask about your tickets, deals, and contacts
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
                  <MessageCircle className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </div>
                <h2 className={`text-2xl font-semibold ${textClass} mb-2`}>
                  HubSpot Agent
                </h2>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                  Ask about your tickets, deals, and contacts
                </p>
                {orgId.trim() && (
                  <div className={`inline-block px-3 py-1 rounded-full text-xs ${darkMode ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-green-100 text-green-700 border border-green-300'}`}>
                    ✓ Org ID: {orgId}
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
                      <div className={`text-sm font-semibold ${textClass} mb-1`}>
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </div>
                      
                      {message.role === 'assistant' && (
                        <>
                          {/* Answer Section */}
                          <div className={`${darkMode ? 'bg-gray-700/30' : 'bg-gray-100'} rounded-lg p-4 mb-3`}>
                            <div className={`${textClass} whitespace-pre-wrap leading-7 break-words`}>
                              {message.content}
                            </div>
                          </div>

                          {/* Metadata Section */}
                          {message.metadata && (
                            <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-2 space-y-2`}>
                              <div className="flex gap-3 flex-wrap">
                                {message.metadata.execution_time !== undefined && (
                                  <span className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                    ⏱️ {message.metadata.execution_time.toFixed(3)}s
                                  </span>
                                )}
                                {message.metadata.error && (
                                  <span className={`px-2 py-1 rounded ${darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'}`}>
                                    ⚠️ Error
                                  </span>
                                )}
                              </div>
                              
                              {/* API Call Details */}
                              {message.metadata.api_call_details && (
                                <div className={`mt-2 ${darkMode ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3`}>
                                  <div className={`font-medium text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                    🔗 API Call Details
                                  </div>
                                  <div className="space-y-1">
                                    {message.metadata.api_call_details.endpoint_path && (
                                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        <span className="font-medium">Endpoint:</span> {message.metadata.api_call_details.endpoint_path}
                                      </div>
                                    )}
                                    {message.metadata.api_call_details.http_method && (
                                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        <span className="font-medium">Method:</span> {message.metadata.api_call_details.http_method}
                                      </div>
                                    )}
                                    {message.metadata.api_call_details.reasoning && (
                                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>
                                        <span className="font-medium">Reasoning:</span> {message.metadata.api_call_details.reasoning}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Raw Data */}
                              {message.metadata.raw_data && (
                                <div className={`mt-2 ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-100 border border-gray-200'} rounded-lg p-3`}>
                                  <div className={`font-medium text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2 flex items-center justify-between`}>
                                    📦 Raw Data
                                  </div>
                                  <pre className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} overflow-x-auto`}>
                                    {JSON.stringify(message.metadata.raw_data, null, 2).substring(0, 500)}
                                    {JSON.stringify(message.metadata.raw_data, null, 2).length > 500 && '...'}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {message.role === 'user' && (
                        <div className={`${textClass} whitespace-pre-wrap leading-7 break-words`}>
                          {message.content}
                        </div>
                      )}
                      
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
            {/* Org ID Input */}
            <div className="mb-3 flex items-center gap-2">
              <label className={`text-sm font-medium ${textClass} whitespace-nowrap`}>
                Org ID:
              </label>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Enter Org ID (e.g., 902)"
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
                placeholder="Ask about tickets, deals, contacts (e.g., What is the last ticket created by Shivam sharma?)"
                disabled={isProcessing || !orgId.trim()}
                className={`w-full ${inputBgClass} border ${borderClass} rounded-2xl pl-4 pr-12 py-3 ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50`}
                rows={1}
                style={{ minHeight: '52px', maxHeight: '200px' }}
              />
              <button
                type="submit"
                disabled={isProcessing || !input.trim() || !orgId.trim()}
                className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${
                  isProcessing || !input.trim() || !orgId.trim()
                    ? darkMode ? 'text-gray-600' : 'text-gray-400'
                    : darkMode ? 'bg-white text-gray-900 hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-700'
                } disabled:cursor-not-allowed`}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <p className={`text-xs text-center mt-3 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`} suppressHydrationWarning>
              {orgId.trim() ? 
                `Server: ${mounted ? apiUrl : 'http://localhost:8000'} • Org ID: ${orgId}` : 
                'Please enter an Org ID to continue'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HubSpotAgent

