import { useState, useEffect } from 'react'

export default function ChatWindow({ imageHistoryNode, head, onEditComplete }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
  ])
  const [input, setInput] = useState('')

  // Load chat messages when active head changes
  useEffect(() => {
    if (!head || !head.id) {
      setMessages([
        { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
      ])
      return
    }

    const chats = JSON.parse(localStorage.getItem('adobe_mock_ps_chats') || '{}')
    const currentChat = chats[head.id]

    if (currentChat) {
      setMessages(currentChat.messages)
    } else {
      const initialMessages = [
        { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
      ]
      chats[head.id] = {
        id: head.id,
        title: localStorage.getItem(head.id) || 'Untitled Image',
        messages: initialMessages,
        timestamp: Date.now()
      }
      localStorage.setItem('adobe_mock_ps_chats', JSON.stringify(chats))
      setMessages(initialMessages)
    }
  }, [head?.id])

  const saveChats = (newMessages) => {
    if (!head || !head.id) return
    const chats = JSON.parse(localStorage.getItem('adobe_mock_ps_chats') || '{}')
    if (!chats[head.id]) {
      chats[head.id] = {
        id: head.id,
        title: localStorage.getItem(head.id) || 'Untitled Image',
        messages: [],
        timestamp: Date.now()
      }
    }
    chats[head.id].messages = newMessages
    chats[head.id].timestamp = Date.now()
    localStorage.setItem('adobe_mock_ps_chats', JSON.stringify(chats))
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !imageHistoryNode) return

    const prompt = input
    setMessages((prev) => {
      const updated = [...prev, { role: 'user', text: prompt }]
      saveChats(updated)
      return updated
    })
    setInput('')

    try {
      const res = await fetch('/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image: localStorage.getItem(imageHistoryNode.id) || 'Untitled.jpg' }),
      })
      if (!res.ok) {
        let errorMsg = 'Edit failed. Please try again.'
        try {
          const errData = await res.json()
          errorMsg = errData.detail?.detail || errData.detail || errorMsg
        } catch (e) {}
        setMessages((prev) => {
          const updated = [...prev, { role: 'assistant', text: `Error: ${errorMsg}` }]
          saveChats(updated)
          return updated
        })
        return
      }

      const data = await res.json()
      const dataUri = `data:image/png;base64,${data.final_image}`
      let label = ''
      data.steps.forEach(
        (step, i) => label += (i + 1 === data.steps.length) ? step.operation : step.operation + ' -> '
      )
      onEditComplete(dataUri, label, data.filename || 'Untitled_Img.jpg')
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant', text: `Applied: ${prompt}` }]
        saveChats(updated)
        return updated
      })
    } catch (err) {
      console.error(err)
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant', text: 'Edit failed. Is the backend running?' }]
        saveChats(updated)
        return updated
      })
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
          placeholder={imageHistoryNode ? "Ask me to edit the image..." : "Upload an image first"}
          disabled={!imageHistoryNode}
        />
        <button type="submit" disabled={!imageHistoryNode}>Send</button>
      </form>
    </aside>
  )
}
