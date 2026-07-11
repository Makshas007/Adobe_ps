import { useState, useEffect } from 'react'
import { MessageSquare, Trash2, Calendar } from 'lucide-react'

export default function ChatHistoryView({ currentHeadId, onSelectChat, onDeleteChat }) {
  const [chats, setChats] = useState([])

  useEffect(() => {
    const loadedChats = []
    const isUUID = (key) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const messageStore = JSON.parse(localStorage.getItem('adobe_mock_ps_chats') || '{}')

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (isUUID(key)) {
        const title = localStorage.getItem(key)
        const chatData = messageStore[key] || {}
        loadedChats.push({
          id: key,
          title: title || 'Untitled Project',
          messages: chatData.messages || [
            { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' }
          ],
          timestamp: chatData.timestamp || Date.now()
        })
      }
    }
    
    loadedChats.sort((a, b) => b.timestamp - a.timestamp)
    setChats(loadedChats)
  }, [])

  const handleDelete = async (chatId, e) => {
    e.stopPropagation()
    if (!window.confirm("Are you sure you want to delete this chat session and its image history?")) return
    await onDeleteChat(chatId)
    setChats(prev => prev.filter(c => c.id !== chatId))
  }

  return (
    <div className="chat-history-view">
      <div className="chat-history-header">
        <h1>Chat History</h1>
        <p className="subtitle">Previous chat sessions with the AI editor assistant</p>
      </div>

      {chats.length === 0 ? (
        <div className="chat-history-empty">
          <MessageSquare size={48} className="empty-icon" />
          <p>No chat history found.</p>
          <p className="small">Open the Editor, upload an image, and send a message to start a session.</p>
        </div>
      ) : (
        <div className="chat-history-list">
          {chats.map((chat) => (
            <div 
              key={chat.id} 
              className={`chat-history-item ${currentHeadId === chat.id ? 'active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="chat-history-item-icon">
                <MessageSquare size={18} />
              </div>
              <div className="chat-history-item-content">
                <div className="chat-history-item-title-row">
                  <div className="chat-history-item-title">{chat.title}</div>
                  <div className="chat-history-item-time">
                    <Calendar size={11} style={{ marginRight: '4px' }} />
                    {new Date(chat.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="chat-history-item-preview">
                  {chat.messages[chat.messages.length - 1]?.text || 'No messages'}
                </div>
                <div className="chat-history-item-count">
                  {chat.messages.length} message{chat.messages.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button 
                className="chat-history-delete-btn" 
                onClick={(e) => handleDelete(chat.id, e)}
                title="Delete chat session"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
