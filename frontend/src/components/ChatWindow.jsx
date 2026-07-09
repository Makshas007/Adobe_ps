import { useState, useRef, useEffect } from 'react'
import {image, history} from '../utilities/indexedDB.js'
import { dataURLtoBlob } from '../utilities/type.js'

export default function ChatWindow({ imageFilename, imageHistoryNode, onEditComplete }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !imageHistoryNode?.imgId || isLoading) return

    const prompt = input
    setMessages((prev) => [...prev, { role: 'user', text: prompt }])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image: imageFilename }),
      })
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', text: 'Edit failed. Please try again.' }])
        return
      }

      const data = await res.json()
      const dataUri = `data:image/png;base64,${data.final_image}`
      let label=''
      data.steps.forEach(
        (e,i) => label += (i + 1 === data.steps.length) ? e : e + ' -> '
      )
      onEditComplete(dataUri, label, imageHistoryNode.id)
      setMessages((prev) => [...prev, { role: 'assistant', text: `Applied: ${prompt}` }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Edit failed. Is the backend running?' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <aside className="chat-window">
      <h2>Chat</h2>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            {msg.text}
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant typing-indicator">
            <span>.</span><span>.</span><span>.</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={imageHistoryNode ? (isLoading ? "Editing..." : "Ask me to edit the image...") : "Upload an image first"}
          disabled={!imageHistoryNode || isLoading}
        />
        <button type="submit" disabled={!imageHistoryNode || isLoading || !input.trim()}>
          {isLoading ? "Wait" : "Send"}
        </button>
      </form>
    </aside>
  )
}
