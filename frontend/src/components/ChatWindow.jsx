import { useState } from 'react'

export default function ChatWindow({ imageFilename, onEditComplete }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
  ])
  const [input, setInput] = useState('')

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !imageFilename) return

    const prompt = input
    setMessages((prev) => [...prev, { role: 'user', text: prompt }])
    setInput('')

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
      onEditComplete(dataUri)
      setMessages((prev) => [...prev, { role: 'assistant', text: `Applied: ${prompt}` }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Edit failed. Is the backend running?' }])
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
      </div>
      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={imageFilename ? "Ask me to edit the image..." : "Upload an image first"}
          disabled={!imageFilename}
        />
        <button type="submit" disabled={!imageFilename}>Send</button>
      </form>
    </aside>
  )
}
