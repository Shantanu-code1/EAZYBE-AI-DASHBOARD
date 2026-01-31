'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, MessageSquare, Menu, Moon, Sun, BookOpen, ExternalLink, Database, MessageCircle, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const EAZYBE_STORAGE_KEY = 'eazybe_verify_otp_response'

function getOrgIdAndWorkspaceId(): { org_id: string; workspace_id: string } {
  if (typeof window === 'undefined') return { org_id: '', workspace_id: '' }
  try {
    const raw = localStorage.getItem(EAZYBE_STORAGE_KEY)
    if (!raw) return { org_id: '', workspace_id: '' }
    const data = JSON.parse(raw)
    const org_id = String(data?.data?.user_mapping?.org_id ?? '')
    const workspace_id = String(data?.data?.user_mapping?.organization?.workspace_id ?? '')
    return { org_id, workspace_id }
  } catch {
    return { org_id: '', workspace_id: '' }
  }
}

export default function NewAgent() {
  const router = useRouter()
  const [query, setQuery] = useState('compare performance of rep Mohit and Chandan')
  const [stream, setStream] = useState<boolean>(true)
  const [orgId, setOrgId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingSteps, setStreamingSteps] = useState<Array<{ type: string; message?: string; data: Record<string, unknown>; ts: number }>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { org_id, workspace_id } = getOrgIdAndWorkspaceId()
    setOrgId(org_id)
    setWorkspaceId(workspace_id)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const textClass = darkMode ? 'text-gray-100' : 'text-gray-800'
  const borderClass = darkMode ? 'border-gray-700' : 'border-gray-200'
  const hoverBgClass = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
  const inputBgClass = darkMode ? 'bg-gray-700' : 'bg-white'
  const sidebarBgClass = darkMode ? 'bg-gray-900' : 'bg-gray-50'
  const mainBgClass = darkMode ? 'bg-gray-800' : 'bg-white'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !orgId || !workspaceId || isProcessing) return

    const userMessage: Message = { role: 'user', content: query.trim(), timestamp: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setQuery('')
    setIsProcessing(true)
    setApiError(null)
    setStreamingSteps([])

    try {
      const res = await fetch('/api/new-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          org_id: orgId,
          workspace_id: workspaceId,
          stream,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Request failed: ${res.status}`)
      }

      if (stream && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalContent = ''
        let currentEvent = ''

        const processDataLine = (eventType: string, rawData: string) => {
          if (!rawData.trim()) return
          try {
            const json = JSON.parse(rawData.trim()) as Record<string, unknown>
            const type = (json?.type as string) || eventType
            const ts = Date.now()
            const hasPhase = json?.phase != null
            const hasToolStep = (json?.tool != null || json?.step != null) && json?.phase === 'execute'

            if (type === 'thinking' || eventType === 'thinking' || (hasPhase && !hasToolStep && type !== 'message' && type !== 'response')) {
              setStreamingSteps((prev) => [
                ...prev,
                {
                  type: 'thinking',
                  message: (json.message as string) || (json.phase as string) || 'Thinking...',
                  data: json,
                  ts,
                },
              ])
            } else if (type === 'tool_execution' || eventType === 'tool_execution' || hasToolStep) {
              setStreamingSteps((prev) => [
                ...prev,
                {
                  type: 'tool_execution',
                  message: (json.message as string) || (json.action as string) || `Step ${json.step ?? ''} · ${json.tool ?? ''}`,
                  data: json,
                  ts,
                },
              ])
            } else if (type === 'message' || eventType === 'message') {
              const content = json.content
              if (content != null && typeof content === 'object' && (content as Record<string, unknown>).type === 'response') {
                const c = (content as Record<string, unknown>).content
                finalContent = typeof c === 'string' ? c : String(c ?? '')
              } else if (typeof content === 'string') {
                finalContent = content
              }
            } else if (type === 'response' && json.content != null) {
              finalContent = typeof json.content === 'string' ? json.content : String(json.content)
            } else if (json.response != null) {
              finalContent = typeof json.response === 'string' ? json.response : String(json.response)
            }
          } catch {
            // ignore malformed
          }
        }

        const processLine = (raw: string) => {
          const trimmed = raw.trim()
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim()
            return
          }
          if (trimmed.startsWith('data: ')) {
            const dataPayload = trimmed.slice(6).trim()
            processDataLine(currentEvent, dataPayload)
            currentEvent = ''
            return
          }
          currentEvent = ''
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) processLine(line)
          await new Promise((r) => setTimeout(r, 0))
        }
        for (const line of buffer.split('\n')) {
          const t = line.trim()
          if (t) processLine(t)
        }

        await new Promise((r) => setTimeout(r, 400))
        setStreamingSteps([])
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: finalContent || 'No response received.', timestamp: new Date() },
        ])
      } else {
        const data = await res.json()
        const content =
          data?.type === 'response' && data?.content != null
            ? (typeof data.content === 'string' ? data.content : String(data.content))
            : typeof data?.answer === 'string'
              ? data.answer
              : data?.response != null
                ? (typeof data.response === 'string' ? data.response : String(data.response))
                : JSON.stringify(data, null, 2)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content, timestamp: new Date() },
        ])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed'
      setApiError(msg)
      setStreamingSteps([])
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${msg}`, timestamp: new Date() },
      ])
    } finally {
      setIsProcessing(false)
      setStreamingSteps([])
    }
  }

  const hasSession = Boolean(orgId && workspaceId)

  return (
    <div className={`flex h-screen ${darkMode ? 'dark bg-gray-800' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-64' : 'w-0'} ${sidebarBgClass} transition-all duration-300 overflow-hidden flex flex-col border-r ${borderClass}`}>
        <div className="p-3 border-b border-gray-700">
          <div className={`text-sm font-semibold ${textClass} flex items-center gap-2`}>
            <Bot className="w-5 h-5" />
            New Agent
          </div>
        </div>
        <div className={`p-3 border-t ${borderClass} flex-1 flex flex-col justify-end`}>
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
              onClick={() => router.push('/hubspot')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-500 hover:bg-orange-600'} text-white rounded-lg transition-colors mb-2`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">HubSpot Agent</span>
            </button>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 ${darkMode ? 'bg-indigo-600' : 'bg-indigo-500'} text-white rounded-lg opacity-75 cursor-default mb-2`}
            >
              <Bot className="w-4 h-4" />
              <span className="text-sm">New Agent</span>
            </button>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 ${hoverBgClass} ${textClass} rounded-lg transition-colors mb-2`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="text-sm">{darkMode ? 'Light' : 'Dark'} mode</span>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <div className={`${mainBgClass} border-b ${borderClass} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`${textClass} ${hoverBgClass} p-2 rounded-lg`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className={`text-lg font-semibold ${textClass} flex items-center gap-2`}>
              <Bot className="w-5 h-5" />
              New Agent
            </h1>
          </div>
          {hasSession && (
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              org_id: {orgId} · workspace_id: {workspaceId}
            </div>
          )}
        </div>

        <div className={`flex-1 overflow-y-auto ${mainBgClass}`}>
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} mb-4`}>
                  <Bot className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </div>
                <h2 className={`text-2xl font-semibold ${textClass} mb-2`}>New Agent</h2>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                  Ask a question. Org ID and Workspace ID are read from your session.
                </p>
                {!hasSession && (
                  <p className={`text-sm ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                    No session found. Log in on the home page first.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className="flex gap-4">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === 'user' ? (darkMode ? 'bg-blue-600' : 'bg-blue-500') : darkMode ? 'bg-green-600' : 'bg-green-500'
                    }`}
                  >
                    <span className="text-white text-sm font-semibold">{msg.role === 'user' ? 'U' : 'AI'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${textClass} mb-1`}>
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className={`${darkMode ? 'bg-gray-700/30' : 'bg-gray-100'} rounded-lg p-5 ${textClass} break-words markdown-content shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({node, ...props}: any) => <h1 className="text-xl font-bold mb-4 mt-2 pb-2 border-b border-gray-600/30 flex items-center gap-2" {...props} />,
                          h2: ({node, ...props}: any) => <h2 className="text-lg font-bold mb-3 mt-4 text-purple-400/90" {...props} />,
                          h3: ({node, ...props}: any) => <h3 className="text-md font-semibold mb-2 mt-4 text-blue-400" {...props} />,
                          p: ({node, ...props}: any) => <p className="mb-4 leading-relaxed opacity-90" {...props} />,
                          ul: ({node, ...props}: any) => <ul className="list-disc ml-6 mb-4 space-y-1" {...props} />,
                          ol: ({node, ...props}: any) => <ol className="list-decimal ml-6 mb-4 space-y-1" {...props} />,
                          li: ({node, ...props}: any) => <li className="mb-1" {...props} />,
                          table: ({node, ...props}: any) => (
                            <div className="overflow-x-auto my-6 rounded-xl border border-gray-700/50 shadow-lg">
                              <table className="w-full text-sm text-left border-collapse" {...props} />
                            </div>
                          ),
                          thead: ({node, ...props}: any) => <thead className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} font-semibold`} {...props} />,
                          th: ({node, ...props}: any) => <th className="px-4 py-3 border-b border-gray-700 text-purple-300 font-medium whitespace-nowrap" {...props} />,
                          td: ({node, ...props}: any) => <td className="px-4 py-3 border-b border-gray-700/50 whitespace-nowrap" {...props} />,
                          tr: ({node, ...props}: any) => <tr className={`${darkMode ? 'hover:bg-gray-600/30' : 'hover:bg-gray-200/50'} transition-colors`} {...props} />,
                          blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-purple-500 pl-4 py-1 my-4 italic opacity-80" {...props} />,
                          code: ({node, ...props}: any) => <code className={`${darkMode ? 'bg-gray-800' : 'bg-gray-200'} px-1.5 py-0.5 rounded text-sm font-mono`} {...props} />,
                          strong: ({node, ...props}: any) => <strong className="font-bold text-blue-300" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    <div className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {isProcessing && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-green-600' : 'bg-green-500'}`}>
                    <span className="text-white text-sm font-semibold">AI</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex gap-1">
                        <div className={`w-2 h-2 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
                        <div className={`w-2 h-2 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
                        <div className={`w-2 h-2 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Thinking...</span>
                    </div>
                    {streamingSteps.length > 0 && (
                      <div className={`rounded-lg border ${darkMode ? 'bg-gray-700/40 border-gray-600' : 'bg-gray-100 border-gray-200'} p-3 max-h-48 overflow-y-auto`}>
                        <div className="space-y-2">
                          {streamingSteps.map((step, i) => (
                            <div key={i} className={`flex items-start gap-2 text-xs`}>
                              <span className={`font-medium shrink-0 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                {step.type}
                              </span>
                              <span className={`flex-1 min-w-0 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {step.message ?? JSON.stringify(step.data)}
                              </span>
                              <span className={`shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {new Date(step.ts).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className={`${mainBgClass} border-t ${borderClass} p-4`}>
          <div className="max-w-3xl mx-auto">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className={`text-sm font-medium ${textClass}`}>Stream:</label>
              <select
                value={stream ? 'true' : 'false'}
                onChange={(e) => setStream(e.target.value === 'true')}
                className={`${inputBgClass} border ${borderClass} rounded-lg px-3 py-2 text-sm ${textClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
              {apiError && (
                <span className="text-red-500 text-xs flex items-center gap-1">
                  <span className="font-semibold">⚠</span> {apiError}
                </span>
              )}
            </div>
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder="e.g. compare performance of rep Mohit and Chandan"
                disabled={isProcessing || !hasSession}
                className={`w-full ${inputBgClass} border ${borderClass} rounded-2xl pl-4 pr-12 py-3 ${textClass} focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-50`}
                rows={1}
                style={{ minHeight: '52px', maxHeight: '200px' }}
              />
              <button
                type="submit"
                disabled={isProcessing || !query.trim() || !hasSession}
                className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${
                  isProcessing || !query.trim() || !hasSession
                    ? darkMode ? 'text-gray-600' : 'text-gray-400'
                    : darkMode ? 'bg-white text-gray-900 hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-700'
                } disabled:cursor-not-allowed`}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <p className={`text-xs text-center mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              {hasSession ? `Org ID: ${orgId} · Workspace ID: ${workspaceId} · Stream: ${stream}` : 'Log in to use New Agent'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
