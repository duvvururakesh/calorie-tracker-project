import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Send, Sparkles } from 'lucide-react'
import api from '@/api/client'
import useCurrentLocalDate from '@/hooks/useCurrentLocalDate'

type Message = {
  id: number | string
  role: 'user' | 'assistant'
  content: string
  intent?: string
  created_at?: string
}

type NibblyHistory = {
  greeting: string
  messages: Message[]
  memories: Record<string, string>
  ai_provider?: string | null
  suggestions?: string[]
}

export default function NibblyPage() {
  const [message, setMessage] = useState('')
  const [extraMessages, setExtraMessages] = useState<Message[]>([])
  const qc = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const today = useCurrentLocalDate()

  const { data, isLoading } = useQuery<NibblyHistory>({
    queryKey: ['nibbly-history', today],
    queryFn: () => api.get(`/coach/history?date=${today}`).then(r => r.data),
  })

  const messages = [...(data?.messages || []), ...extraMessages]
  const suggestions = data?.suggestions || []
  const suggestionKey = suggestions.join('|')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    suggestionsRef.current?.scrollTo({ left: 0 })
  }, [suggestionKey])

  const send = useMutation({
    mutationFn: (content: string) => api.post('/coach/message', { message: content, date: today }).then(r => r.data),
    onMutate: content => {
      const userMessage: Message = {
        id: `local-${Date.now()}`,
        role: 'user',
        content,
      }
      setExtraMessages(prev => [...prev, userMessage])
      setMessage('')
    },
    onSuccess: data => {
      const reply = data?.reply?.content
        ? data.reply
        : {
            id: `nibbly-empty-${Date.now()}`,
            role: 'assistant' as const,
            content: 'I got your message, but Nibbly could not write a clear reply. Try once more.',
          }
      setExtraMessages(prev => [...prev, reply])
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['entries'] })
    },
    onError: error => {
      const detail = error instanceof Error ? error.message : 'Unknown request error'
      setExtraMessages(prev => [
        ...prev,
        {
          id: `nibbly-error-${Date.now()}`,
          role: 'assistant',
          content: `I could not reach Nibbly. ${detail}`,
        },
      ])
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const content = message.trim()
    if (!content || send.isPending) return
    send.mutate(content)
  }

  function sendSuggestion(value: string) {
    if (send.isPending) return
    send.mutate(value)
  }

  return (
    <div className="max-w-2xl mx-auto min-w-0 h-[calc(100svh-11.75rem-env(safe-area-inset-bottom))] md:h-[calc(100svh-7rem)] flex flex-col">
      <section className="min-h-0 flex-1 flex flex-col">
        <div className="border-b border-white/10 pb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-elevated/70 flex items-center justify-center text-lime">
            <Bot size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Nibbly</p>
            <p className="text-xs text-gray-500 truncate">
              {isLoading
                ? 'Loading food context...'
                : data?.ai_provider
                  ? `Food understanding: ${data.ai_provider}`
                  : 'Food understanding needs a server key'}
            </p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-4 pr-1 space-y-3">
          {!isLoading && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-elevated/70 flex items-center justify-center text-lime flex-shrink-0">
                <Sparkles size={15} />
              </div>
              <div className="max-w-[82%] rounded-[1.25rem] rounded-tl-md bg-elevated px-4 py-3 text-sm leading-relaxed text-gray-100">
                {data?.greeting || 'Tell me what you ate or what you want me to remember.'}
              </div>
            </div>
          )}

          {messages.map(item => (
            <div key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[84%] rounded-[1.25rem] px-4 py-3 text-sm leading-relaxed ${
                  item.role === 'user'
                    ? 'rounded-tr-md bg-lime text-black font-medium'
                    : 'rounded-tl-md bg-elevated text-gray-100'
                }`}
              >
                {item.content}
              </div>
            </div>
          ))}

          {send.isPending && (
            <div className="text-xs text-gray-500 px-2">Reading...</div>
          )}
        </div>

        <div className="pt-2 pb-5 md:pb-0 bg-bg">
          {suggestions.length > 0 && (
            <div ref={suggestionsRef} className="flex gap-2 overflow-x-auto overscroll-x-contain no-scrollbar pb-3">
              {suggestions.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => sendSuggestion(item)}
                  className="min-h-11 whitespace-nowrap rounded-full bg-elevated px-4 text-xs font-semibold text-gray-300"
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={1}
              placeholder="Ask or log food..."
              className="resize-none"
            />
            <button
              type="submit"
              disabled={!message.trim() || send.isPending}
              aria-label="Send"
              className="w-12 h-12 rounded-full bg-lime text-black flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
