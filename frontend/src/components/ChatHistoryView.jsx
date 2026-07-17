import { useState, useEffect } from 'react'
import { GitBranch, Trash2, Calendar } from 'lucide-react'
import { history, waitForDB } from '../utilities/indexedDB.js'

export default function ChatHistoryView({ currentHeadId, onSelectChat, onDeleteChat }) {
  const [chats, setChats] = useState([])

  useEffect(() => {
    const loadChats = async () => {
      await waitForDB()
      const heads = await history.getHeads()
      const loadedChats = await Promise.all(heads.map(async (head) => {
        const tree = await history.getTree(head.id)
        const nodeCount = countNodes(tree)
        const labels = collectLabels(tree)
        return {
          id: head.id,
          title: head.filename || 'Untitled Project',
          time: head.time || '',
          timestamp: parseTime(head.time),
          nodeCount,
          lastEdit: labels[labels.length - 1] || ''
        }
      }))
      loadedChats.sort((a, b) => b.timestamp - a.timestamp)
      setChats(loadedChats)
    }
    loadChats()
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
        <p className="subtitle">Edit history trees from AI assistant sessions</p>
      </div>

      {chats.length === 0 ? (
        <div className="chat-history-empty">
          <GitBranch size={48} className="empty-icon" />
          <p>No edit history found.</p>
          <p className="small">Open the Editor, upload an image, and make edits to start a session.</p>
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
                <GitBranch size={18} />
              </div>
              <div className="chat-history-item-content">
                <div className="chat-history-item-title-row">
                  <div className="chat-history-item-title">{chat.title}</div>
                  <div className="chat-history-item-time">
                    <Calendar size={11} style={{ marginRight: '4px' }} />
                    {chat.time}
                  </div>
                </div>
                <div className="chat-history-item-preview">
                  {chat.lastEdit || 'Uploaded'}
                </div>
                <div className="chat-history-item-count">
                  {chat.nodeCount} node{chat.nodeCount !== 1 ? 's' : ''} in edit tree
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

function countNodes(tree) {
  if (!tree) return 0
  let count = 1
  if (tree.children) {
    for (const child of tree.children) {
      count += countNodes(child)
    }
  }
  return count
}

function collectLabels(tree) {
  if (!tree) return []
  const labels = [tree.label || '']
  if (tree.children) {
    for (const child of tree.children) {
      labels.push(...collectLabels(child))
    }
  }
  return labels.filter(Boolean)
}

function parseTime(timeStr) {
  if (!timeStr) return 0
  const d = new Date(timeStr)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}
