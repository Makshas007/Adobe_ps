import { useState, useEffect, useCallback } from 'react'
import {image, messages as messageStore} from '../utilities/indexedDB.js'
import { blobToDataURL } from '../utilities/type.js'

export default function ChatWindow({ imageHistoryNode, head, onEditComplete, canvasRef }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
  ])
  const [input, setInput] = useState('')
  const [disabledMsg, setDisabledMsg] = useState('')

  useEffect(() => {
    if (!head || !head.id) {
      setMessages([
        { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
      ])
      return
    }

    const loadMessages = async () => {
      const saved = await messageStore.get(head.id)
      if (saved) {
        setMessages(saved.messages)
      } else {
        const initialMessages = [
          { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
        ]
        await messageStore.save(head.id, initialMessages, Date.now())
        setMessages(initialMessages)
      }
    }
    loadMessages()
  }, [head?.id])

  const saveChats = async (newMessages) => {
    if (!head || !head.id) return
    await messageStore.save(head.id, newMessages, Date.now())
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
  const handleSave = useCallback(async () => {
    if (!canvasRef?.current || !imageHistoryNode) return
    const canvasURI = canvasRef.current.exportImage()
    const dbImage = await img_by_id(imageHistoryNode.imageId)
    if (canvasURI && canvasURI !== dbImage) {
      onEditComplete(canvasURI, 'User Edits', head.filename || 'Untitled_Img.jpg')
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant', text: `Applied: User Edits` }]
        saveChats(updated)
        return updated
      })
    }
  }, [canvasRef, imageHistoryNode, head, onEditComplete])

  useEffect(() => {
    const handleSaveEvent = () => {
      handleSave()
    }
    window.addEventListener('canvas-save', handleSaveEvent)
    return () => window.removeEventListener('canvas-save', handleSaveEvent)
  }, [handleSave])

  async function handleSend(e) {
    setDisabledMsg("Editing in progress, Please Wait...")
    e.preventDefault()
    if (!input.trim() || !imageHistoryNode) return
    
    const canvasURI = canvasRef?.current?.exportImage()
    const dbImage = await img_by_id(imageHistoryNode.imageId)
    if (canvasURI && canvasURI !== dbImage) {
      onEditComplete(canvasURI, 'User Edits', head.filename || 'Untitled_Img.jpg')
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
      onEditComplete(dataUri, label, head.filename || 'Untitled_Img.jpg')
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
    setDisabledMsg("")
  }

  const placeholder=()=>{
    if(imageHistoryNode && !disabledMsg )return"Ask me to edit the image...";
    else if(disabledMsg)return disabledMsg;
    else return "Upload an image first";
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
          placeholder={placeholder()}
          disabled={!imageHistoryNode || disabledMsg.length!==0}
        />
        <button type="submit" disabled={!imageHistoryNode || disabledMsg.length!==0}>Send</button>
      </form>
    </aside>
  )
}
