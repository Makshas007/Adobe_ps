import { useState, useEffect } from 'react'
import {image} from '../utilities/indexedDB.js'
import { blobToDataURL } from '../utilities/type.js'

export default function ChatWindow({ imageHistoryNode, canvasURI, head, onEditComplete }) {
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

  const img_by_id = (id) => {
    return new Promise((resolve, reject) => {
      image.getImage(id)
        .then((res) => {
          if (!res) return resolve(null);
          try {
            blobToDataURL(res, (dat) => resolve(dat));
          } catch (err) {
            reject(err);
          }
        })
        .catch((err) => reject(err));
    });
  };
  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !imageHistoryNode) return

    if(canvasURI && canvasURI!== await img_by_id(imageHistoryNode.imageId)){
      onEditComplete(canvasURI, 'User Edits', localStorage.getItem(head.id) || 'Untitled_Img.jpg')
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant', text: `Applied: User Edits` }]
        saveChats(updated)
        return updated
      })
    }
    
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
        body: JSON.stringify({ prompt, image: canvasURI || await img_by_id(imageHistoryNode.imageId) }),
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
      onEditComplete(dataUri, label, localStorage.getItem(head.id) || 'Untitled_Img.jpg')
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
