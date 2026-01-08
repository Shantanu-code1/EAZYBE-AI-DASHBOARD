import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, MessageSquare, Plus, Settings, Menu, Moon, Sun, BookOpen, Edit2, Trash2, Check, X, RefreshCw, Zap, Globe, MessageCircle, Sparkles, ExternalLink, Database } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  metadata?: {
    primary_source?: string
    confidence?: number
    web_results_count?: number
    chat_results_count?: number
    elapsed_ms?: number
    reasoning?: string
    rationale?: string
    sources?: string
    retrieved_context_count?: number
    source_urls?: string[]
  }
  webResults?: WebResult[]
  chatResults?: ChatResult[]
}

interface WebResult {
  id: string
  score: number
  distance?: number
  text: string
  source_url?: string
  collection: string
}

interface ChatResult {
  id: string
  score: number
  distance?: number
  text: string
  collection: string
  authors?: string[]
  conversationId?: string
  messageCount?: number
  startTime?: number
  endTime?: number
}

interface Chat {
  id: string
  title: string
  messages: Message[]
}

interface Prompt {
  id: string
  name: string
  content: string
  category: string
  prompt_name?: string
  description?: string
  is_cached?: boolean
  cache_expires_at?: string
}

interface StreamingState {
  status: string
  stage: string
  webResults: WebResult[]
  chatResults: ChatResult[]
  webResultsReceived: boolean
  chatResultsReceived: boolean
  isLoading: boolean
}

// Helper function to format message content
const formatMessage = (content: string) => {
  // Split by [Chat with ...]: to create sections
  const sections = content.split(/(\[Chat with \d+\]:)/g)
  
  return sections.map((section, idx) => {
    if (section.match(/\[Chat with \d+\]:/)) {
      return (
        <div key={idx} className="font-semibold text-blue-400 mt-4 mb-2">
          {section}
        </div>
      )
    } else if (section.trim()) {
      // Split by lines and format each message
      const lines = section.split('\n').filter(line => line.trim())
      return (
        <div key={idx} className="space-y-2">
          {lines.map((line, lineIdx) => {
            if (line.trim() === '---') {
              return <div key={lineIdx} className="border-t border-gray-600 my-3"></div>
            }
            // Check if line contains a phone number at the start (message sender)
            const match = line.match(/^(\d+):\s*(.*)/)
            if (match) {
              return (
                <div key={lineIdx} className="text-sm">
                  <span className="text-gray-400 mr-2">{match[1]}:</span>
                  <span className="break-words">{match[2]}</span>
                </div>
              )
            }
            return <div key={lineIdx} className="text-sm break-words">{line}</div>
          })}
        </div>
      )
    }
    return null
  }).filter(Boolean)
}

// Web Results Display Component
function WebResultsBox({ results, darkMode, wasReceived }: { results: WebResult[], darkMode: boolean, wasReceived?: boolean }) {
  console.log('🔍 WebResultsBox render:', { resultsLength: results.length, wasReceived })
  
  // Show the box even if no results, but only if we received an event
  if (!wasReceived) return null

  return (
    <div className={`rounded-lg border ${darkMode ? 'bg-blue-900/10 border-blue-800' : 'bg-blue-50 border-blue-200'} p-4 h-full flex flex-col`}>
      <div className="flex items-center gap-2 mb-3">
        <Globe className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
        <h4 className={`font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>
          Web Content Results ({results.length})
        </h4>
      </div>
      {results.length === 0 ? (
        <div className={`flex items-center justify-center p-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <div className="text-center">
            <Globe className={`w-8 h-8 mx-auto mb-2 opacity-50 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <p className="text-sm">Nothing found in Web Content</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-96">
          {results.map((result, idx) => (
            <div 
              key={result.id || idx} 
              className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                    Score: {result.score != null ? result.score.toFixed(3) : 'N/A'}
                  </span>
                  {result.distance != null && (
                    <span className={`text-xs font-medium px-2 py-1 rounded ${darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                      Distance: {result.distance.toFixed(3)}
                    </span>
                  )}
                </div>
                {result.source_url && (
                  <a 
                    href={result.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`text-xs ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} underline`}
                  >
                    View Source →
                  </a>
                )}
              </div>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>
                {result.text && result.text.length > 200 ? `${result.text.substring(0, 200)}...` : (result.text || 'No content available')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Chat Results Display Component
function ChatResultsBox({ results, darkMode, wasReceived }: { results: ChatResult[], darkMode: boolean, wasReceived?: boolean }) {
  console.log('🔍 ChatResultsBox render:', { resultsLength: results.length, wasReceived })
  
  // Show the box even if no results, but only if we received an event
  if (!wasReceived) return null

  return (
    <div className={`rounded-lg border ${darkMode ? 'bg-green-900/10 border-green-800' : 'bg-green-50 border-green-200'} p-4 h-full flex flex-col`}>
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
        <h4 className={`font-semibold ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
          Chat History Results ({results.length})
        </h4>
      </div>
      {results.length === 0 ? (
        <div className={`flex items-center justify-center p-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <div className="text-center">
            <MessageCircle className={`w-8 h-8 mx-auto mb-2 opacity-50 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
            <p className="text-sm">Nothing found in Chat History</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto max-h-96">
          {results.map((result, idx) => (
            <div 
              key={result.id || idx} 
              className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                      Score: {result.score != null ? result.score.toFixed(3) : 'N/A'}
                    </span>
                    {result.distance != null && (
                      <span className={`text-xs font-medium px-2 py-1 rounded ${darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                        Distance: {result.distance.toFixed(3)}
                      </span>
                    )}
                    {result.messageCount && (
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        💬 {result.messageCount} messages
                      </span>
                    )}
                  </div>
                  {result.authors && result.authors.length > 0 && (
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
                      👥 {result.authors.join(', ')}
                    </div>
                  )}
                  {result.startTime && (
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      🕒 {new Date(result.startTime).toLocaleString()}
                      {result.endTime && ` - ${new Date(result.endTime).toLocaleString()}`}
                    </div>
                  )}
                  {result.conversationId && (
                    <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-1`}>
                      ID: {result.conversationId}
                    </div>
                  )}
                </div>
              </div>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>
                {result.text && result.text.length > 200 ? `${result.text.substring(0, 200)}...` : (result.text || 'No content available')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Status Indicator Component
function StatusIndicator({ status, stage, darkMode }: { status: string, stage: string, darkMode: boolean }) {
  if (!status) return null

  const getStageIcon = () => {
    switch (stage) {
      case 'web_search':
        return <Globe className="w-4 h-4 animate-pulse" />
      case 'chat_search':
        return <MessageCircle className="w-4 h-4 animate-pulse" />
      case 'generating_answer':
        return <Sparkles className="w-4 h-4 animate-pulse" />
      default:
        return <RefreshCw className="w-4 h-4 animate-spin" />
    }
  }

  return (
    <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-purple-900/20 border border-purple-800' : 'bg-purple-50 border border-purple-200'}`}>
      <div className="flex items-center gap-2">
        {getStageIcon()}
        <span className={`text-sm font-medium ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
          {status}
        </span>
      </div>
    </div>
  )
}

function Dashboard() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [uid, setUid] = useState('902')
  const [chats, setChats] = useState<Chat[]>([{
    id: '1',
    title: 'New Chat',
    messages: []
  }])
  const [currentChatId, setCurrentChatId] = useState('1')
  
  // Streaming settings
  const [useStreaming, setUseStreaming] = useState(true)
  const [streamingAnswer, setStreamingAnswer] = useState('')
  const [streamingState, setStreamingState] = useState<StreamingState>({
    status: '',
    stage: '',
    webResults: [],
    chatResults: [],
    webResultsReceived: false,
    chatResultsReceived: false,
    isLoading: false
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // API Configuration
  const apiUrlOptions = [
    'http://dko04c08848wsc8ckskgwwss.5.161.63.64.sslip.io',
    'http://localhost:8000',
    'https://6ac428957655.ngrok-free.app'
  ]
  
  // Get API URL from localStorage or use default (safe for SSR)
  // Start with default to avoid hydration mismatch
  const [apiUrl, setApiUrl] = useState('http://localhost:8000')
  const [mounted, setMounted] = useState(false)
  
  const [promptApiUrl, setPromptApiUrl] = useState('http://localhost:8000')
  const [useBackendPrompts, setUseBackendPrompts] = useState(true)
  
  // Load from localStorage after hydration (client-side only)
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apiUrl')
      if (saved) {
        setApiUrl(saved)
        setPromptApiUrl(saved)
      }
    }
  }, [])
  
  // Update apiUrl and save to localStorage, notify other pages
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      localStorage.setItem('apiUrl', apiUrl)
      setPromptApiUrl(apiUrl) // Sync promptApiUrl with apiUrl
      
      // Dispatch custom event to notify other pages
      window.dispatchEvent(new CustomEvent('apiUrlChanged', { detail: apiUrl }))
    }
  }, [apiUrl, mounted])
  
  // Helper function to get API URL dynamically
  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('apiUrl') || 'http://localhost:8000'
    }
    return 'http://localhost:8000'
  }
  
  // Helper function to check if URL is ngrok and get headers
  const getHeaders = (url: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // Add ngrok-skip-browser-warning header for ngrok URLs
    if (url.includes('ngrok-free.app') || url.includes('ngrok.io') || url.includes('ngrok.app')) {
      headers['ngrok-skip-browser-warning'] = 'true'
    }
    
    return headers
  }
  
  // Prompt Management
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [showPrompts, setShowPrompts] = useState(false)
  const [newPromptName, setNewPromptName] = useState('')
  const [newPromptContent, setNewPromptContent] = useState('')
  const [newPromptCategory, setNewPromptCategory] = useState('General')
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  
  const [showSettings, setShowSettings] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const currentChat = chats.find(chat => chat.id === currentChatId) || chats[0]
  const messages = currentChat.messages

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingAnswer, streamingState])

  // Fetch prompts from backend on mount and when backend setting changes
  useEffect(() => {
    if (useBackendPrompts) {
      fetchPromptsFromBackend()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useBackendPrompts])

  // Fetch all prompts from backend
  const fetchPromptsFromBackend = async (limit = 100, skip = 0) => {
    setIsLoadingPrompts(true)
    setPromptError(null)
    try {
      const response = await fetch(`${promptApiUrl}/system-prompts/prompts?limit=${limit}&skip=${skip}`, {
        headers: getHeaders(promptApiUrl)
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch prompts: ${response.status}`)
      }
      const data = await response.json()
      
      // Transform backend prompts to our format
      const backendPrompts: Prompt[] = data.prompts ? data.prompts.map((p: any) => {
        // Map prompt names to readable names
        const displayNames: Record<string, string> = {
          'MASTER_AGENT_SELECTION_PROMPT_KB': 'Master Agent Selection',
          'HUBSPOT_AGENT_V3': 'HubSpot Agent V3',
          'HUBSPOT_SEARCH_PROMPT': 'HubSpot Search Prompt',
          'HUBSPOT_CREATE_UPDATE_PROMPT': 'HubSpot Create/Update Prompt',
          'BIGQUERY_SCHEMA': 'BigQuery Schema',
          'BIGQUERY_SQL_GENERATOR': 'BigQuery SQL Generator',
          'BIGQUERY_INTERPRETER': 'BigQuery Interpreter',
          'RAG_SINGLE_PROMPT': 'RAG Single Prompt',
          'TEAMINBOX-LABELS': 'TeamInbox Labels',
          'EAZYBE_AI_LABEL_PROMPT': 'EazyBe AI Label Prompt',
          'SYNTHESIZER_USER_PROMPT_TEMPLATE': 'Synthesizer User Prompt Template',
          'SYNTHESIZER_SYSTEM_PROMPT': 'Synthesizer System Prompt',
          'MASTERAGENT_V3_SYSTEM_PROMPT': 'Master Agent V3 System Prompt',
          'SALES_AGENT_PROMPT': 'Sales Agent Prompt',
          'SALES_AGENT_USER_PROMPT': 'Sales Agent User Prompt'
        }
        
        // Map prompt names to use cases
        const useCases: Record<string, string> = {
          'MASTER_AGENT_SELECTION_PROMPT_KB': 'Routes queries to the correct agent',
          'HUBSPOT_AGENT_V3': 'HubSpot API routing',
          'HUBSPOT_SEARCH_PROMPT': 'Search request body extraction',
          'HUBSPOT_CREATE_UPDATE_PROMPT': 'Create/update request body extraction',
          'BIGQUERY_SCHEMA': 'BigQuery schema',
          'BIGQUERY_SQL_GENERATOR': 'SQL generation guidelines',
          'BIGQUERY_INTERPRETER': 'Result formatting and interpretation',
          'RAG_SINGLE_PROMPT': 'Knowledge base queries',
          'TEAMINBOX-LABELS': 'Manages and categorizes TeamInbox conversation labels',
          'EAZYBE_AI_LABEL_PROMPT': 'EazyBe AI label management and categorization',
          'SYNTHESIZER_USER_PROMPT_TEMPLATE': 'Template for synthesizer user prompts',
          'SYNTHESIZER_SYSTEM_PROMPT': 'System prompt for response synthesis',
          'MASTERAGENT_V3_SYSTEM_PROMPT': 'System prompt for Master Agent V3 routing and planning',
          'SALES_AGENT_PROMPT': 'Sales agent interactions and sales-related queries',
          'SALES_AGENT_USER_PROMPT': 'User prompt template for sales agent interactions'
        }
        
        return {
          id: p.prompt_name,
          name: displayNames[p.prompt_name] || p.prompt_name,
          content: useCases[p.prompt_name] || p.description || 'No description available',
          category: 'Backend',
          prompt_name: p.prompt_name,
          description: p.description || useCases[p.prompt_name] || 'No description available',
          is_cached: p.is_cached,
          cache_expires_at: p.cache_expires_at
        }
      }) : []
      
      // Filter to only show specific prompts
      const allowedPrompts = [
        'MASTER_AGENT_SELECTION_PROMPT_KB',
        'HUBSPOT_AGENT_V3',
        'HUBSPOT_SEARCH_PROMPT',
        'HUBSPOT_CREATE_UPDATE_PROMPT',
        'BIGQUERY_SCHEMA',
        'BIGQUERY_SQL_GENERATOR',
        'BIGQUERY_INTERPRETER',
        'RAG_SINGLE_PROMPT',
        'TEAMINBOX-LABELS',
        'EAZYBE_AI_LABEL_PROMPT',
        'SYNTHESIZER_USER_PROMPT_TEMPLATE',
        'SYNTHESIZER_SYSTEM_PROMPT',
        'MASTERAGENT_V3_SYSTEM_PROMPT',
        'SALES_AGENT_PROMPT',
        'SALES_AGENT_USER_PROMPT'
      ]
      const filteredPrompts = backendPrompts.filter(p => 
        allowedPrompts.includes(p.prompt_name || p.id)
      )
      
      if (filteredPrompts.length > 0) {
        setPrompts(filteredPrompts)
        if (!selectedPromptId || !filteredPrompts.find(p => p.id === selectedPromptId)) {
          setSelectedPromptId(filteredPrompts[0].id)
        }
      } else {
        setPromptError('No matching prompts found in backend')
      }
    } catch (error) {
      console.error('Error fetching prompts:', error)
      setPromptError(error instanceof Error ? error.message : 'Failed to fetch prompts')
    } finally {
      setIsLoadingPrompts(false)
    }
  }

  // Create prompt in backend
  const createPromptInBackend = async (promptName: string, description: string) => {
    try {
      const response = await fetch(`${promptApiUrl}/system-prompts/prompts`, {
        method: 'POST',
        headers: getHeaders(promptApiUrl),
        body: JSON.stringify({
          prompt_name: promptName,
          description: description
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create prompt: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error creating prompt:', error)
      throw error
    }
  }

  // Update prompt in backend
  const updatePromptInBackend = async (promptName: string, description: string) => {
    try {
      const response = await fetch(`${promptApiUrl}/system-prompts/prompts/${promptName}`, {
        method: 'PUT',
        headers: getHeaders(promptApiUrl),
        body: JSON.stringify({
          description: description
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update prompt: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error updating prompt:', error)
      throw error
    }
  }

  // Delete prompt from backend
  const deletePromptFromBackend = async (promptName: string) => {
    try {
      const response = await fetch(`${promptApiUrl}/system-prompts/prompts/${promptName}`, {
        method: 'DELETE',
        headers: getHeaders(promptApiUrl)
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete prompt: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error deleting prompt:', error)
      throw error
    }
  }

  // ENHANCED STREAMING HANDLER WITH 3 SEPARATE BOXES
  const handleStreamingQuery = async (queryText: string) => {
    setStreamingAnswer('')
    setStreamingState({
      status: '',
      stage: '',
      webResults: [],
      chatResults: [],
      webResultsReceived: false,
      chatResultsReceived: false,
      isLoading: true
    })
    
    let accumulatedAnswer = ''
    let messageMetadata: any = {}
    let capturedWebResults: WebResult[] = []
    let capturedChatResults: ChatResult[] = []
    
    // Create a temporary message index for the streaming message
    const tempMessageIndex = messages.length + 1
    
    try {
      const response = await fetch(`${getApiUrl()}/query/smart/stream`, {
        method: 'POST',
        headers: getHeaders(getApiUrl()),
        body: JSON.stringify({
          query: queryText,
          uid: uid
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body reader available')
      }

      // Add a placeholder message for streaming
      const placeholderMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        webResults: [],
        chatResults: []
      }
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, messages: [...chat.messages, placeholderMessage] }
            : chat
        )
      )

      let buffer = '' // Buffer for incomplete lines
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // Split by double newlines or single newlines, but keep complete SSE messages
        const lines = buffer.split('\n')
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim()
            
            if (data === '[DONE]') {
              console.log('✅ Stream completed!')
              console.log('📦 Final captured data:')
              console.log('  - Web Results:', capturedWebResults.length)
              console.log('  - Chat Results:', capturedChatResults.length)
              console.log('  - Answer length:', accumulatedAnswer.length)
              
              // Update final message with complete content and metadata
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
                                metadata: messageMetadata,
                                webResults: capturedWebResults,
                                chatResults: capturedChatResults
                              }
                            : msg
                        )
                      }
                    : chat
                )
              )
              
              console.log('✅ Message updated with all 3 components')
              
              // Reset streaming state
              setStreamingAnswer('')
              setStreamingState({
                status: '',
                stage: '',
                webResults: [],
                chatResults: [],
                webResultsReceived: false,
                chatResultsReceived: false,
                isLoading: false
              })
              return
            }

            try {
              const event = JSON.parse(data)

              switch (event.type) {
                case 'status':
                  console.log('📊 Status:', event)
                  setStreamingState(prev => ({
                    ...prev,
                    status: event.message,
                    stage: event.stage
                  }))
                  break

                case 'web_results':
                  console.log('🌐 Web Results received:', event.results?.length, 'results')
                  capturedWebResults = event.results || []
                  setStreamingState(prev => ({
                    ...prev,
                    webResults: capturedWebResults,
                    webResultsReceived: true
                  }))
                  console.log('✅ Web Results captured:', capturedWebResults.length)
                  break

                case 'chat_results':
                  console.log('💬 Chat Results received:', event.results?.length, 'results')
                  capturedChatResults = event.results || []
                  setStreamingState(prev => ({
                    ...prev,
                    chatResults: capturedChatResults,
                    chatResultsReceived: true
                  }))
                  console.log('✅ Chat Results captured:', capturedChatResults.length)
                  break

                case 'metadata':
                  console.log('📊 Metadata:', event)
                  messageMetadata = {
                    primary_source: event.primary_source,
                    confidence: event.confidence,
                    web_results_count: event.web_results_count,
                    chat_results_count: event.chat_results_count,
                    reasoning: event.reasoning,
                    rationale: event.rationale,
                    sources: event.sources,
                    retrieved_context_count: event.retrieved_context_count,
                    source_urls: event.source_urls
                  }
                  break

                case 'answer_chunk':
                  // Append chunk to accumulated answer
                  accumulatedAnswer += event.content
                  setStreamingAnswer(accumulatedAnswer)
                  console.log('📝 Answer chunk received, total length:', accumulatedAnswer.length)
                  
                  // Update the placeholder message in real-time
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
                  console.log('📦 Complete:', event)
                  messageMetadata = {
                    primary_source: event.primary_source,
                    confidence: event.confidence,
                    web_results_count: event.web_results_count,
                    chat_results_count: event.chat_results_count,
                    elapsed_ms: event.elapsed_ms,
                    reasoning: event.reasoning,
                    rationale: event.rationale,
                    sources: event.sources,
                    retrieved_context_count: event.retrieved_context_count,
                    source_urls: event.source_urls
                  }
                  // Ensure we have the complete answer
                  if (event.answer) {
                    accumulatedAnswer = event.answer
                  }
                  break

                case 'error':
                  throw new Error(event.message)
              }
            } catch (e) {
              // Skip non-JSON lines or incomplete data
              if (data && data !== '[DONE]') {
                console.warn('Failed to parse SSE event:', e)
                console.warn('Problematic data (first 200 chars):', data.substring(0, 200))
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setApiError(errorMessage)
      
      // Update placeholder with error message
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
      
      setStreamingAnswer('')
      setStreamingState({
        status: '',
        stage: '',
        webResults: [],
        chatResults: [],
        webResultsReceived: false,
        chatResultsReceived: false,
        isLoading: false
      })
    }
  }

  // NON-STREAMING HANDLER (Original)
  const handleNonStreamingQuery = async (queryText: string) => {
    try {
      const response = await fetch(`${getApiUrl()}/query/smart`, {
        method: 'POST',
        headers: getHeaders(getApiUrl()),
        body: JSON.stringify({
          query: queryText,
          uid: uid
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Extract the answer from the API response
      let aiContent = ''
      if (data.answer) {
        aiContent = data.answer
      } else if (typeof data === 'string') {
        aiContent = data
      } else {
        aiContent = data.response || data.result || JSON.stringify(data, null, 2)
      }
      
      const aiMessage: Message = {
        role: 'assistant',
        content: aiContent,
        timestamp: new Date(),
        metadata: {
          primary_source: data.primary_source,
          confidence: data.confidence,
          web_results_count: data.web_results_count,
          chat_results_count: data.chat_results_count
        },
        webResults: data.web_results || [],
        chatResults: data.chat_results || []
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
    }
  }

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
    } else {
      await handleNonStreamingQuery(queryText)
    }
    
    setIsProcessing(false)
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

  const addPrompt = async () => {
    if (!newPromptName.trim() || !newPromptContent.trim()) return
    
    if (useBackendPrompts) {
      try {
        setIsLoadingPrompts(true)
        await createPromptInBackend(newPromptName, newPromptContent)
        await fetchPromptsFromBackend()
        setSelectedPromptId(newPromptName)
      } catch (error) {
        setPromptError('Failed to create prompt in backend')
      } finally {
        setIsLoadingPrompts(false)
      }
    } else {
      const newPrompt: Prompt = {
        id: Date.now().toString(),
        name: newPromptName,
        content: newPromptContent,
        category: newPromptCategory
      }
      
      setPrompts(prev => [...prev, newPrompt])
      setSelectedPromptId(newPrompt.id)
    }
    
    setNewPromptName('')
    setNewPromptContent('')
    setNewPromptCategory('General')
    setShowAddPrompt(false)
  }

  const updatePrompt = async (id: string, updates: Partial<Prompt>) => {
    if (useBackendPrompts) {
      try {
        setIsLoadingPrompts(true)
        const prompt = prompts.find(p => p.id === id)
        if (prompt) {
          await updatePromptInBackend(
            prompt.prompt_name || prompt.id,
            updates.description || updates.content || prompt.description || prompt.content
          )
          await fetchPromptsFromBackend()
        }
      } catch (error) {
        setPromptError('Failed to update prompt in backend')
      } finally {
        setIsLoadingPrompts(false)
      }
    } else {
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    }
    setShowEditModal(false)
    setEditingPrompt(null)
  }

  const openEditModal = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingPrompt(null)
  }

  const saveEditedPrompt = async () => {
    if (editingPrompt) {
      await updatePrompt(editingPrompt.id, {
        content: editingPrompt.content,
        description: editingPrompt.description
      })
    }
  }

  const deletePrompt = async (id: string) => {
    if (prompts.length === 1) return
    
    if (useBackendPrompts) {
      try {
        setIsLoadingPrompts(true)
        const prompt = prompts.find(p => p.id === id)
        if (prompt) {
          await deletePromptFromBackend(prompt.prompt_name || prompt.id)
          await fetchPromptsFromBackend()
          if (selectedPromptId === id) {
            const remainingPrompts = prompts.filter(p => p.id !== id)
            if (remainingPrompts.length > 0) {
              setSelectedPromptId(remainingPrompts[0].id)
            }
          }
        }
      } catch (error) {
        setPromptError('Failed to delete prompt from backend')
      } finally {
        setIsLoadingPrompts(false)
      }
    } else {
      setPrompts(prev => prev.filter(p => p.id !== id))
      if (selectedPromptId === id) {
        setSelectedPromptId(prompts.find(p => p.id !== id)?.id || prompts[0].id)
      }
    }
  }

  const categories = Array.from(new Set(prompts.map(p => p.category)))

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
            onClick={() => {
              setShowPrompts(!showPrompts)
              setShowSettings(false)
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 ${hoverBgClass} ${textClass} rounded-lg transition-colors mb-2 ${showPrompts ? (darkMode ? 'bg-gray-700' : 'bg-gray-200') : ''}`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">Prompts</span>
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 ${hoverBgClass} ${textClass} rounded-lg transition-colors mb-2`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="text-sm">{darkMode ? 'Light' : 'Dark'} mode</span>
          </button>
          <button
            onClick={() => {
              setShowSettings(!showSettings)
              setShowPrompts(false)
            }}
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
              {currentChat.title}
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

        {/* Prompts Panel */}
        {showPrompts && (
          <div className={`${mainBgClass} flex-1 overflow-y-auto p-6`}>
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-lg font-semibold ${textClass} flex items-center gap-2`}>
                    Prompt Library
                    {useBackendPrompts && (
                      <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                        Backend Connected
                      </span>
                    )}
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {useBackendPrompts ? `${prompts.length} prompts loaded from backend` : 'Select or create custom prompts for different tasks'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {useBackendPrompts && (
                    <button
                      onClick={() => fetchPromptsFromBackend()}
                      disabled={isLoadingPrompts}
                      className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} ${textClass} rounded-lg flex items-center gap-2 disabled:opacity-50`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingPrompts ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddPrompt(!showAddPrompt)}
                    className={`px-4 py-2 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg flex items-center gap-2`}
                  >
                    <Plus className="w-4 h-4" />
                    Add Prompt
                  </button>
                </div>
              </div>

              {/* Error Display */}
              {promptError && (
                <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-red-900/30 border border-red-700 text-red-400' : 'bg-red-100 border border-red-300 text-red-700'}`}>
                  ⚠️ {promptError}
                </div>
              )}

              {/* Prompt Guide */}
              <div className={`${darkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4 mb-6`}>
                <h4 className={`font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-700'} mb-3 flex items-center gap-2`}>
                  <BookOpen className="w-5 h-5" />
                  Prompt Guide
                </h4>
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">Master Agent Selection</div>
                    <div className="text-xs">Routes queries to the correct agent</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">HubSpot Agent V3</div>
                    <div className="text-xs">HubSpot API routing</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">HubSpot Search Prompt</div>
                    <div className="text-xs">Search request body extraction</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">HubSpot Create/Update Prompt</div>
                    <div className="text-xs">Create/update request body extraction</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">BigQuery Schema</div>
                    <div className="text-xs">BigQuery schema</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">BigQuery SQL Generator</div>
                    <div className="text-xs">SQL generation guidelines</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">BigQuery Interpreter</div>
                    <div className="text-xs">Result formatting and interpretation</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">RAG Single Prompt</div>
                    <div className="text-xs">Knowledge base queries</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">TeamInbox Labels</div>
                    <div className="text-xs">Manages and categorizes TeamInbox conversation labels</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">EazyBe AI Label Prompt</div>
                    <div className="text-xs">EazyBe AI label management and categorization</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">Synthesizer User Prompt Template</div>
                    <div className="text-xs">Template for synthesizer user prompts</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">Synthesizer System Prompt</div>
                    <div className="text-xs">System prompt for response synthesis</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">Master Agent V3 System Prompt</div>
                    <div className="text-xs">System prompt for Master Agent V3 routing and planning</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">Sales Agent Prompt</div>
                    <div className="text-xs">Sales agent interactions and sales-related queries</div>
                  </div>
                  <div className={`p-2 rounded ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                    <div className="font-medium text-xs mb-1">Sales Agent User Prompt</div>
                    <div className="text-xs">User prompt template for sales agent interactions</div>
                  </div>
                </div>
              </div>

              {/* Add New Prompt Form */}
              {showAddPrompt && (
                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 mb-4`}>
                  <input
                    type="text"
                    placeholder="Prompt Name"
                    value={newPromptName}
                    onChange={(e) => setNewPromptName(e.target.value)}
                    className={`w-full ${inputBgClass} border ${borderClass} rounded-lg p-2 ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2`}
                  />
                  <select
                    value={newPromptCategory}
                    onChange={(e) => setNewPromptCategory(e.target.value)}
                    className={`w-full ${inputBgClass} border ${borderClass} rounded-lg p-2 ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2`}
                  >
                    <option value="General">General</option>
                    <option value="Coding">Coding</option>
                    <option value="Writing">Writing</option>
                    <option value="Business">Business</option>
                    <option value="Education">Education</option>
                    <option value="Custom">Custom</option>
                  </select>
                  <textarea
                    placeholder="Prompt Content"
                    value={newPromptContent}
                    onChange={(e) => setNewPromptContent(e.target.value)}
                    className={`w-full ${inputBgClass} border ${borderClass} rounded-lg p-2 ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2`}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addPrompt}
                      className={`flex-1 px-4 py-2 ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white rounded-lg flex items-center justify-center gap-2`}
                    >
                      <Check className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPrompt(false)
                        setNewPromptName('')
                        setNewPromptContent('')
                        setNewPromptCategory('General')
                      }}
                      className={`flex-1 px-4 py-2 ${hoverBgClass} ${textClass} rounded-lg border ${borderClass} flex items-center justify-center gap-2`}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Prompts by Category */}
              {categories.map(category => (
                <div key={category} className="mb-4">
                  <h4 className={`text-sm font-semibold ${textClass} mb-2 uppercase tracking-wide`}>
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {prompts.filter(p => p.category === category).map(prompt => (
                      <div
                        key={prompt.id}
                        className={`${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg p-3 cursor-pointer transition-colors border ${
                          selectedPromptId === prompt.id 
                            ? darkMode ? 'border-blue-500' : 'border-blue-400'
                            : 'border-transparent'
                        }`}
                        onClick={() => setSelectedPromptId(prompt.id)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className={`text-sm font-medium ${textClass} flex items-center gap-2`}>
                            {prompt.name}
                            {selectedPromptId === prompt.id && (
                              <span className={`text-xs px-2 py-0.5 rounded ${darkMode ? 'bg-blue-700' : 'bg-blue-200'} ${textClass}`}>
                                Active
                              </span>
                            )}
                            {prompt.is_cached && (
                              <span className={`text-xs px-2 py-0.5 rounded ${darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                                Cached
                              </span>
                            )}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditModal(prompt)
                              }}
                              className={`p-1 ${hoverBgClass} rounded`}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {prompts.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deletePrompt(prompt.id)
                                }}
                                className={`p-1 hover:bg-red-500/20 rounded text-red-500`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} line-clamp-2`}>
                          {prompt.content || 'No description available'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className={`${mainBgClass} flex-1 overflow-y-auto p-6`}>
            <div className="max-w-4xl mx-auto">
              <h3 className={`text-lg font-semibold ${textClass} mb-2`}>Settings</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-3`}>
                Configure your AI dashboard preferences.
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

              {/* Backend Prompts Configuration */}
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 mb-4`}>
                <div className="mb-3">
                  <p className={`text-sm font-medium ${textClass} mb-2`}>Backend Prompt Management</p>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="useBackend"
                      checked={useBackendPrompts}
                      onChange={(e) => setUseBackendPrompts(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="useBackend" className={`text-sm ${textClass}`}>
                      Use backend API for prompts
                    </label>
                  </div>
                  {useBackendPrompts && (
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
                        Selected URL will be used for all API calls across all pages
                      </p>
                    </div>
                  )}
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
                  AI Dashboard v2.0 - Enhanced streaming with live web & chat results display! 🚀
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area - Only show when prompts panel is closed */}
        {!showPrompts && !showSettings && (
          <>
            <div className={`flex-1 overflow-y-auto ${mainBgClass}`}>
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} mb-4`}>
                      <MessageSquare className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                    </div>
                    <h2 className={`text-2xl font-semibold ${textClass} mb-2`}>
                      How can I help you today?
                    </h2>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                      Connected to EazyBe Knowledge Base
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
                        ✓ User ID: {uid}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-7xl mx-auto px-4 py-6">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`mb-8 ${message.role === 'user' ? '' : ''}`}
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
                          
                          {/* SHOW USER MESSAGE CONTENT */}
                          {message.role === 'user' && (
                            <div className={`${textClass} whitespace-pre-wrap leading-7 break-words overflow-wrap-anywhere`}>
                              {message.content}
                            </div>
                          )}
                          
                          {/* SHOW STATUS DURING STREAMING */}
                          {message.isStreaming && streamingState.isLoading && (
                            <StatusIndicator 
                              status={streamingState.status} 
                              stage={streamingState.stage}
                              darkMode={darkMode}
                            />
                          )}
                          
                          {/* SHOW ALL 3 COMPONENTS INDEPENDENTLY - WEB, CHAT, ANSWER */}
                          {message.role === 'assistant' && (
                            <>
                              {/* Grid container for Web & Chat Results side-by-side */}
                              {(() => {
                                const shouldShow = (message.isStreaming && (streamingState.webResultsReceived || streamingState.chatResultsReceived)) ||
                                  (!message.isStreaming && (message.webResults || message.chatResults))
                                console.log('🔍 Should show results grid:', {
                                  isStreaming: message.isStreaming,
                                  webResultsReceived: streamingState.webResultsReceived,
                                  chatResultsReceived: streamingState.chatResultsReceived,
                                  webResultsLength: message.webResults?.length || 0,
                                  chatResultsLength: message.chatResults?.length || 0,
                                  shouldShow
                                })
                                return shouldShow
                              })() && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                                  {/* WEB RESULTS BOX - Shows independently */}
                                  {message.isStreaming ? (
                                    <WebResultsBox 
                                      results={streamingState.webResults} 
                                      darkMode={darkMode} 
                                      wasReceived={streamingState.webResultsReceived}
                                    />
                                  ) : (
                                    <WebResultsBox 
                                      results={message.webResults || []} 
                                      darkMode={darkMode} 
                                      wasReceived={!!message.webResults}
                                    />
                                  )}
                                  
                                  {/* CHAT RESULTS BOX - Shows independently */}
                                  {message.isStreaming ? (
                                    <ChatResultsBox 
                                      results={streamingState.chatResults} 
                                      darkMode={darkMode} 
                                      wasReceived={streamingState.chatResultsReceived}
                                    />
                                  ) : (
                                    <ChatResultsBox 
                                      results={message.chatResults || []} 
                                      darkMode={darkMode} 
                                      wasReceived={!!message.chatResults}
                                    />
                                  )}
                                </div>
                              )}
                              
                              {/* ANSWER BOX - Shows independently */}
                              {message.content && (
                                <div className={`${darkMode ? 'bg-gray-700/30' : 'bg-gray-100'} rounded-lg p-4 mb-3`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className={`w-4 h-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                                    <h4 className={`font-semibold text-sm ${darkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                                      AI Answer
                                    </h4>
                                  </div>
                                  <div className={`${textClass} whitespace-pre-wrap leading-7 break-words overflow-wrap-anywhere`}>
                                    {formatMessage(message.content)}
                                    {message.isStreaming && (
                                      <span className="inline-block w-0.5 h-5 bg-blue-400 ml-1 animate-pulse"></span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          
                          {message.metadata && (
                            <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-2 space-y-2`}>
                              {/* Primary metadata badges */}
                              <div className="flex gap-3 flex-wrap">
                                {message.metadata.primary_source && (
                                  <span className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                    Source: {message.metadata.primary_source}
                                  </span>
                                )}
                                {message.metadata.confidence !== undefined && (
                                  <span className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                    Confidence: {(message.metadata.confidence * 100).toFixed(0)}%
                                  </span>
                                )}
                                {message.metadata.elapsed_ms && (
                                  <span className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                    {message.metadata.elapsed_ms.toFixed(0)}ms
                                  </span>
                                )}
                                {message.metadata.retrieved_context_count && (
                                  <span className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                    Context: {message.metadata.retrieved_context_count}
                                  </span>
                                )}
                              </div>
                              
                              {/* Reasoning and rationale */}
                              {message.metadata.reasoning && (
                                <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3`}>
                                  <div className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                                    🤔 Reasoning:
                                  </div>
                                  <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                                    {message.metadata.reasoning}
                                  </div>
                                </div>
                              )}
                              
                              {message.metadata.rationale && (
                                <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3`}>
                                  <div className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                                    📋 Rationale:
                                  </div>
                                  <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                                    {message.metadata.rationale}
                                  </div>
                                </div>
                              )}
                              
                              {/* Sources */}
                              {message.metadata.sources && (
                                <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3`}>
                                  <div className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                                    📚 Sources:
                                  </div>
                                  <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                                    {message.metadata.sources}
                                  </div>
                                </div>
                              )}
                              
                              {/* Source URLs */}
                              {message.metadata.source_urls && message.metadata.source_urls.length > 0 && (
                                <div className={`${darkMode ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3`}>
                                  <div className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                    🔗 Source URLs:
                                  </div>
                                  <div className="space-y-1">
                                    {message.metadata.source_urls.map((url, idx) => (
                                      <a 
                                        key={idx}
                                        href={url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className={`text-xs ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} underline block truncate`}
                                      >
                                        {url}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isProcessing && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
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
                    placeholder="Message AI... (e.g., How to connect hubspot?)"
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
                    `Server: ${mounted ? apiUrl : 'http://localhost:8000'} • UID: ${uid} • ${useStreaming ? 'Streaming ⚡' : 'Standard'}` : 
                    'Please enter a User ID to continue'}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Edit Prompt Modal */}
        {showEditModal && editingPrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeEditModal}>
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
              <div className={`sticky top-0 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-b ${borderClass} p-6 z-10`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-2xl font-semibold ${textClass}`}>Edit Prompt</h2>
                  <button onClick={closeEditModal} className={`${hoverBgClass} rounded-lg p-2`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${textClass} mb-2`}>
                    Prompt Name
                  </label>
                  <input
                    type="text"
                    value={editingPrompt.name}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                    className={`w-full ${inputBgClass} border ${borderClass} rounded-lg p-3 ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Enter prompt name"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textClass} mb-2`}>
                    Prompt Name (Key)
                  </label>
                  <input
                    type="text"
                    value={editingPrompt.prompt_name || editingPrompt.id}
                    disabled
                    className={`w-full ${inputBgClass} border ${borderClass} rounded-lg p-3 ${textClass} opacity-60 cursor-not-allowed`}
                  />
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                    This is the unique identifier for this prompt
                  </p>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textClass} mb-2`}>
                    Description
                  </label>
                  <textarea
                    value={editingPrompt.description || editingPrompt.content || ''}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                    className={`w-full ${inputBgClass} border ${borderClass} rounded-lg p-3 ${textClass} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                    rows={10}
                    placeholder="Enter prompt description..."
                  />
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>
                    {(editingPrompt.description || editingPrompt.content)?.length || 0} characters
                  </p>
                </div>

                {editingPrompt.is_cached && (
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                        Cached
                      </span>
                      <span className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                        This prompt is cached
                      </span>
                    </div>
                    {editingPrompt.cache_expires_at && (
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Expires: {new Date(editingPrompt.cache_expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className={`sticky bottom-0 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-t ${borderClass} p-6 flex justify-end gap-3`}>
                <button
                  onClick={closeEditModal}
                  className={`px-4 py-2 ${hoverBgClass} ${textClass} rounded-lg border ${borderClass}`}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditedPrompt}
                  disabled={isLoadingPrompts}
                  className={`px-4 py-2 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg disabled:opacity-50 flex items-center gap-2`}
                >
                  {isLoadingPrompts ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
