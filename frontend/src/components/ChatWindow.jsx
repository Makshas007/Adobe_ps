import { useState, useEffect, useCallback } from 'react'
import {image} from '../utilities/indexedDB.js'
import { blobToDataURL } from '../utilities/type.js'

function ExplanationSection({ explanation, executionLog }) {
  const [showLog, setShowLog] = useState(false)

  if (!explanation) return null

  return (
    <div className="explanation-section">
      <div className="explanation-plain">
        {explanation.plain_english}
      </div>
      <div className="explanation-technical">
        <span className="explanation-label">Technical Details</span>
        <pre className="explanation-tech-text">{explanation.technical_summary}</pre>
      </div>
      <div className="explanation-log-toggle">
        <button
          className="explanation-log-btn"
          onClick={() => setShowLog(!showLog)}
        >
          {showLog ? 'Hide' : 'Show'} Execution Details {showLog ? '▲' : '▼'}
        </button>
        {showLog && executionLog && executionLog.length > 0 && (
          <div className="explanation-log">
            {executionLog.map((entry, i) => (
              <div key={i} className={`explanation-log-entry log-${entry.status}`}>
                <div className="log-entry-header">
                  <span className="log-entry-op">{entry.operation}</span>
                  <span className={`log-entry-status status-${entry.status}`}>{entry.status}</span>
                  <span className="log-entry-duration">{entry.duration.toFixed(0)}ms</span>
                </div>
                {entry.target && <div className="log-entry-detail">Target: {entry.target}</div>}
                {entry.model && <div className="log-entry-detail">Model: {entry.model}</div>}
                {entry.reason && <div className="log-entry-detail">Reason: {entry.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatWindow({ imageHistoryNode, head, onEditComplete, canvasRef }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' },
  ])
  const [input, setInput] = useState('')
  const [disabledMsg, setDisabledMsg] = useState('')

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
  const handleSave = useCallback(async () => {
    if (!canvasRef?.current || !imageHistoryNode) return
    if (canvasRef.current.hasUnsavedChanges()) {
      const canvasURI = canvasRef.current.exportImage()
      onEditComplete(canvasURI, 'User Edits', localStorage.getItem(head.id) || 'Untitled_Img.jpg')
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant', text: `Applied: User Edits` }]
        saveChats(updated)
        return updated
      })
    }
    else{alert("No changes");}
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
    if (canvasRef?.current?.hasUnsavedChanges()) {
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
          setDisabledMsg("")
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
        const updated = [...prev, {
          role: 'assistant',
          text: `Applied: ${prompt}`,
          explanation: data.explanation,
          executionLog: data.execution_log,
        }]
        saveChats(updated)
        return updated
      })
    } catch (err) {
      console.error(err)
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant', text: 'Edit failed. Is the backend running?' }]
        saveChats(updated)
        setDisabledMsg("")
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
            <div>{msg.text}</div>
            {msg.explanation && (
              <ExplanationSection
                explanation={msg.explanation}
                executionLog={msg.executionLog}
              />
            )}
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
