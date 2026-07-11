import { useState, useEffect } from 'react'
import ToolbarRibbon from './components/ToolbarRibbon'
import StatusBar from './components/StatusBar'
import TreePanel from './components/TreePanel'
import ChatWindow from './components/ChatWindow'
import ImageViewer from './components/ImageViewer'
import LibraryView from './components/LibraryView'
import ChatHistoryView from './components/ChatHistoryView'
import { image, history, waitForDB } from './utilities/indexedDB.js'
import './App.css'
import { blobToDataURL, dataURLtoBlob } from './utilities/type.js'

function App() {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageHistoryNode, setImageHistoryNode] = useState(null)
  const [head, setHead] = useState({})
  const [historyVersion, setHistoryVersion] = useState(0)
  const [view, setView] = useState('editor')

  const handleUpload = async ({ url, filename, file }) => {
    setImageUrl(url)
    const { id } = await image.addImage(file);
    const headNode = await history.addNode({ label: "Uploaded File", time: new Date().toLocaleString(), imageId: id, filename }, null)
    setImageHistoryNode({ ...headNode, filename });
    setHead(headNode);
    const chats = JSON.parse(localStorage.getItem('adobe_mock_ps_chats') || '{}')
    chats[headNode.id] = {
      id: headNode.id,
      title: filename,
      messages: [
        { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' }
      ],
      timestamp: Date.now()
    }
    localStorage.setItem('adobe_mock_ps_chats', JSON.stringify(chats))
    window.history.pushState(null, '', '/' + headNode.id);
    setHistoryVersion(v => v + 1)
  }

  const findLatestNode = async (nodeId) => {
    const node = await history.getNode(nodeId)
    if (!node) return null
    const childIds = Array.isArray(node.nextNode) ? node.nextNode : []
    if (childIds.length === 0) {
      return node
    }
    return findLatestNode(childIds[childIds.length - 1])
  }

  const handleSelectLibraryNode = async (nodeId) => {
    try {
      const node = await history.getNode(nodeId)
      if (!node) return

      let curr = node
      while (curr.prevNode) {
        const prev = await history.getNode(curr.prevNode)
        if (!prev) break
        curr = prev
      }

      setHead(curr)
      await setNode(nodeId)
      window.history.pushState(null, '', '/' + curr.id)
      setView('editor')
    } catch (err) {
      console.error("Failed to select library node:", err)
    }
  }

  const handleSelectChat = async (chatId) => {
    try {
      const headNode = await history.getNode(chatId)
      if (!headNode) return

      setHead(headNode)

      const latestNode = await findLatestNode(chatId)
      if (latestNode) {
        await setNode(latestNode.id)
      } else {
        await setNode(chatId)
      }
      window.history.pushState(null, '', '/' + chatId)
      setView('editor')
    } catch (err) {
      console.error("Failed to select chat:", err)
    }
  }

  const handleDeleteChat = async (chatId) => {
    try {
      await history.delete(chatId)
      localStorage.removeItem(chatId)

      const chats = JSON.parse(localStorage.getItem('adobe_mock_ps_chats') || '{}')
      delete chats[chatId]
      localStorage.setItem('adobe_mock_ps_chats', JSON.stringify(chats))

      if (head && head.id === chatId) {
        setHead({})
        setImageHistoryNode(null)
        setImageUrl(null)
        window.history.pushState(null, '', '/')
      }
      setHistoryVersion(v => v + 1)
    } catch (err) {
      console.error("Failed to delete chat:", err)
    }
  }

  useEffect(() => {
    const initLoad = async () => {
      try {
        await waitForDB()

        // Migration: Register existing legacy head nodes into localStorage chat history
        const heads = await history.getHeads()
        if (heads && heads.length > 0) {
          const chats = JSON.parse(localStorage.getItem('adobe_mock_ps_chats') || '{}')
          let updated = false

          for (const headNode of heads) {
            if (headNode.id) {
              if (!localStorage.getItem(headNode.id)) {
                localStorage.setItem(headNode.id, headNode.filename || 'Untitled Upload')
              }
              if (!chats[headNode.id]) {
                chats[headNode.id] = {
                  id: headNode.id,
                  title: headNode.filename || 'Untitled Upload',
                  messages: [
                    { role: 'assistant', text: 'Hello! I can help you edit this image. Try asking me to crop, resize, or apply a filter.' }
                  ],
                  timestamp: Date.now()
                }
                updated = true
              }
            }
          }
          if (updated) {
            localStorage.setItem('adobe_mock_ps_chats', JSON.stringify(chats))
          }
        }

        const uploadId = location.pathname.split('/')[1];
        const node = await history.getNode(uploadId)
        if (node) {
          setHead(node)
          await setNode(uploadId)
        }
      } catch (err) {
        console.error("Failed to load initial history:", err)
      }
    }
    initLoad()
  }, [])

  const setNode = async (nodeId) => {
    if (!nodeId) return
    const nextNodeData = await history.getNode(nodeId)
    if (!nextNodeData) return

    setImageHistoryNode(nextNodeData)
    if (nextNodeData.imageId) {
      const imgBlob = await image.getImage(nextNodeData.imageId)
      if (imgBlob) {
        blobToDataURL(imgBlob, (res) => setImageUrl(res))
      } else {
        setImageUrl(null)
      }
    } else {
      setImageUrl(null)
    }
  }

  const nextNode = async () => {
    if (!imageHistoryNode?.nextNode?.length) return

    const nextIds = Array.isArray(imageHistoryNode.nextNode) ? imageHistoryNode.nextNode : []
    if (nextIds.length === 1) {
      await setNode(nextIds[0])
      return
    }

    const choice = window.prompt('Enter index to go to', '1')
    const index = Number.parseInt(choice ?? '1', 10)
    const targetId = nextIds[index - 1]
    if (targetId) {
      await setNode(targetId)
    }
  }

  const prevNode = async () => {
    if (!imageHistoryNode?.prevNode) return
    await setNode(imageHistoryNode.prevNode)
  }

  const handleEditComplete = async (dataUri, label) => {
    setImageUrl(dataUri)
    const blob = dataURLtoBlob(dataUri);
    const { id } = await image.addImage(blob);
    const node = await history.addNode({ label, time: new Date().toLocaleString(), imageId: id, filename: imageHistoryNode.filename }, imageHistoryNode.id)
    setImageHistoryNode({ ...node, filename: imageHistoryNode.filename })
    setHistoryVersion(v => v + 1)
  }

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <div className="navbar-logo">
          <span className="logo-icon">🎨</span>
          <span className="logo-text">Adobe Mock PS</span>
        </div>
        <div className="navbar-links">
          <button
            className={`nav-link ${view === 'editor' ? 'active' : ''}`}
            onClick={() => setView('editor')}
          >
            Editor
          </button>
          <button
            className={`nav-link ${view === 'library' ? 'active' : ''}`}
            onClick={() => setView('library')}
          >
            Library
          </button>
          <button
            className={`nav-link ${view === 'chatHistory' ? 'active' : ''}`}
            onClick={() => setView('chatHistory')}
          >
            Chat History
          </button>
        </div>
        <div className="user-nametag">
          <div className="user-avatar">AD</div>
          <span className="user-name">ADITYA</span>
        </div>
      </nav>

      {/* Main Workspace View Switcher */}
      {view === 'editor' && (
        <div className="main-content">
          <ToolbarRibbon
            onUpload={handleUpload}
            onUndo={prevNode}
            onRedo={nextNode}
            canUndo={!!(imageHistoryNode && imageHistoryNode.prevNode)}
            canRedo={!!(imageHistoryNode && imageHistoryNode.nextNode?.length)}
          />
          <ImageViewer imageUrl={imageUrl} />
          <div className="right-column">
            <TreePanel headId={head.id} historyVersion={historyVersion} setNode={setNode} currNode={imageHistoryNode} />
            <ChatWindow imageHistoryNode={imageHistoryNode} head={head} onEditComplete={handleEditComplete} />
          </div>
        </div>
      )}

      {view === 'library' && (
        <div className="main-content">
          <LibraryView onSelectNode={handleSelectLibraryNode} currentHeadId={head.id} />
        </div>
      )}

      {view === 'chatHistory' && (
        <div className="main-content">
          <ChatHistoryView
            currentHeadId={head.id}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
          />
        </div>
      )}
      <StatusBar />
    </div>
  )
}

export default App
