import { useState, useEffect, useRef, useCallback } from 'react'
import ToolbarRibbon from './components/ToolbarRibbon'
import StatusBar from './components/StatusBar'
import TreePanel from './components/TreePanel'
import ChatWindow from './components/ChatWindow'
import CanvasEditor from './components/CanvasEditor'
import ToolOptions from './components/ToolOptions'
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
  const [redoOptions, setRedoOptions] = useState([])
  const [canCanvasUndo, setCanCanvasUndo] = useState(false)
  const [canCanvasRedo, setCanCanvasRedo] = useState(false)

  const [activeTool, setActiveTool] = useState('select')
  const [brushColor, setBrushColor] = useState('#FF1E8A')
  const [brushSize, setBrushSize] = useState(5)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [imageDimensions, setImageDimensions] = useState(null)
  const [cursorPos, setCursorPos] = useState(null)
  const [objectCount, setObjectCount] = useState(0)
  const [filterValues, setFilterValues] = useState({
    Brightness: 0, Contrast: 0, Saturation: 0, HueRotation: 0, Blur: 0,
  })

  const canvasRef = useRef(null)
  const resolveImageLoadedRef = useRef(null)

  const handleCanvasHistoryChange = useCallback((undoAvailable, redoAvailable) => {
    setCanCanvasUndo(undoAvailable)
    setCanCanvasRedo(redoAvailable)
  }, [])

  const handleCanvasUndo = useCallback(() => {
    canvasRef.current?.canvasUndo()
  }, [])

  const handleCanvasRedo = useCallback(() => {
    canvasRef.current?.canvasRedo()
  }, [])

  const handleCanvasReady = useCallback((canvas) => {
    canvas.on('object:added', () => {
      if (canvasRef.current) {
        setObjectCount(canvasRef.current.getObjectCount())
      }
    })
    canvas.on('object:removed', () => {
      if (canvasRef.current) {
        setObjectCount(canvasRef.current.getObjectCount())
      }
    })
  }, [])

  const handleExport = useCallback(() => {
    if (!canvasRef.current) return
    const dataUri = canvasRef.current.exportImage()
    if (dataUri) {
      const link = document.createElement('a')
      link.download = `edited-${Date.now()}.png`
      link.href = dataUri
      link.click()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('canvas-export', handleExport)
    return () => window.removeEventListener('canvas-export', handleExport)
  }, [handleExport])

  const handleApplyCrop = useCallback(async () => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current.getCanvas()
    if (!canvas) return

    const objects = canvas.getObjects()
    const cropRect = objects.find(o => o.isCropRect === true)

    if (!cropRect || cropRect.width < 2 || cropRect.height < 2) {
      alert('Draw a crop rectangle on the canvas first.')
      return
    }

    const cropData = {
      left: cropRect.left,
      top: cropRect.top,
      width: cropRect.width,
      height: cropRect.height,
    }

    const newDims = await canvasRef.current.applyCrop(cropData)
    if (newDims) {
      setImageDimensions(newDims)
    }
    canvas.renderAll()
    setActiveTool('select')
  }, [])

  const handleResize = useCallback((newWidth, newHeight) => {
    if (!canvasRef.current) return
    canvasRef.current.resizeCanvas(newWidth, newHeight)
    setImageDimensions({ width: newWidth, height: newHeight })
    setActiveTool('select')
  }, [])

  const handleFilterChange = useCallback((filterType, value) => {
    setFilterValues(prev => ({ ...prev, [filterType]: value }))
    if (canvasRef.current) {
      canvasRef.current.applyFilter(filterType, value)
    }
  }, [])

  const handleUpload = async ({ url, filename }) => {
    setImageUrl(url)
    setFilterValues({ Brightness: 0, Contrast: 0, Saturation: 0, HueRotation: 0, Blur: 0 })
    setActiveTool('select')
    await new Promise(resolve => { resolveImageLoadedRef.current = resolve })
    const { id } = await image.addImage(dataURLtoBlob(canvasRef.current.exportImage()))
    const headNode = await history.addNode({ label: "Uploaded File", time: new Date().toLocaleString(), imageId: id, filename }, null)
    setImageHistoryNode({ ...headNode, filename })
    setHead(headNode)
    localStorage.setItem(headNode.id, filename)
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
    window.history.pushState(null, '', '/' + headNode.id)
    setHistoryVersion(v => v + 1)
  }

  const findLatestNode = async (nodeId) => {
    const node = await history.getNode(nodeId)
    if (!node) return null
    const childIds = Array.isArray(node.nextNode) ? node.nextNode : []
    if (childIds.length === 0) return node
    return findLatestNode(childIds[childIds.length - 1])
  }

  const newChat=()=>{
    setImageUrl(null)
    setImageHistoryNode(null)
    setHead({})
    setHistoryVersion(0)
    setView('editor')
    setRedoOptions([])
    setCanCanvasUndo(false)
    setCanCanvasRedo(false)
    setActiveTool('select')
    setBrushColor('#FF1E8A')
    setBrushSize(5)
    setBrushOpacity(1)
    setZoom(100)
    setImageDimensions(null)
    setCursorPos(null)
    setObjectCount(0)
    setFilterValues({
      Brightness: 0,
      Contrast: 0,
      Saturation: 0,
      HueRotation: 0,
      Blur: 0
    })
    canvasRef.current?.clear()
    window.history.pushState(null, '', '/');
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
        const uploadId = location.pathname.split('/')[1]
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

  useEffect(() => {
    let active = true
    const urlsToCleanup = []

    const fetchRedoOptions = async () => {
      if (!imageHistoryNode?.nextNode?.length) {
        setRedoOptions([])
        return
      }
      const options = []
      const nextIds = Array.isArray(imageHistoryNode.nextNode) ? imageHistoryNode.nextNode : []
      for (const id of nextIds) {
        const node = await history.getNode(id)
        if (node) {
          let imageUrl = null
          if (node.imageId) {
            const imgBlob = await image.getImage(node.imageId)
            if (imgBlob) {
              imageUrl = URL.createObjectURL(imgBlob)
              urlsToCleanup.push(imageUrl)
            }
          }
          options.push({
            id: node.id,
            label: node.label || 'Next Step',
            time: node.time || '',
            imageUrl
          })
        }
      }
      if (active) {
        setRedoOptions(options)
      }
    }

    fetchRedoOptions()

    return () => {
      active = false
      urlsToCleanup.forEach(url => {
        URL.revokeObjectURL(url)
      })
    }
  }, [imageHistoryNode, historyVersion])

  const setNode = useCallback(async (nodeId) => {
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
  }, [])

  const nextNode = useCallback(async (targetId) => {
    if (targetId) {
      await setNode(targetId)
    } else {
      if (!imageHistoryNode?.nextNode?.length) return
      const nextIds = Array.isArray(imageHistoryNode.nextNode) ? imageHistoryNode.nextNode : []
      if (nextIds.length > 0) {
        await setNode(nextIds[0])
      }
    }
  }, [imageHistoryNode, setNode])

  const prevNode = useCallback(async () => {
    if (!imageHistoryNode?.prevNode) return
    await setNode(imageHistoryNode.prevNode)
  }, [imageHistoryNode, setNode])

  const handleEditComplete = async (dataUri, label, filename) => {
    setImageUrl(dataUri)
    setFilterValues({ Brightness: 0, Contrast: 0, Saturation: 0, HueRotation: 0, Blur: 0 })
    setActiveTool('select')
    const blob = dataURLtoBlob(canvasRef.current.exportImage())
    const { id } = await image.addImage(blob)
    const node = await history.addNode({ label, time: new Date().toLocaleString(), imageId: id, filename }, imageHistoryNode.id)
    localStorage.setItem(node.id, filename)
    setImageHistoryNode(node)
    setHistoryVersion(v => v + 1)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); handleCanvasUndo() }
        if (e.key === 'y') { e.preventDefault(); handleCanvasRedo() }
        if (e.key === 's') { e.preventDefault(); window.dispatchEvent(new CustomEvent('canvas-save')) }
        return
      }
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break
        case 'b': setActiveTool('brush'); break
        case 'e': setActiveTool('eraser'); break
        case 't': setActiveTool('text'); break
        case 'u': setActiveTool('rect'); break
        case 'c': setActiveTool('crop'); break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCanvasUndo, handleCanvasRedo])

  return (
    <div className="app-layout">
      <nav className="top-navbar">
        <div className="navbar-logo">
          <span className="logo-icon">🎨</span>
          <span className="logo-text">Adobe Mock PS</span>
        </div>
        <div className="navbar-links">
          <button className={`nav-link ${view === 'editor' ? 'active' : ''}`} onClick={() => setView('editor')}>Editor</button>
          <button className={`nav-link ${view === 'library' ? 'active' : ''}`} onClick={() => setView('library')}>Library</button>
          <button className={`nav-link ${view === 'chatHistory' ? 'active' : ''}`} onClick={() => setView('chatHistory')}>Chat History</button>
        </div>
        <div className="user-nametag">
          <div className="user-avatar">AD</div>
          <span className="user-name">ADITYA</span>
        </div>
      </nav>

      {view === 'editor' && (
        <div className="main-content">
          <ToolbarRibbon
            onUpload={handleUpload}
            onUndo={prevNode}
            onRedo={nextNode}
            redoOptions={redoOptions}
            canUndo={!!(imageHistoryNode && imageHistoryNode.prevNode)}
            canRedo={!!(imageHistoryNode && imageHistoryNode.nextNode?.length)}
            onCanvasUndo={handleCanvasUndo}
            onCanvasRedo={handleCanvasRedo}
            canCanvasUndo={canCanvasUndo}
            canCanvasRedo={canCanvasRedo}
            newChat={newChat}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            hasImage={!!imageUrl}
          />
          <ToolOptions
            activeTool={activeTool}
            brushColor={brushColor}
            setBrushColor={setBrushColor}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            brushOpacity={brushOpacity}
            setBrushOpacity={setBrushOpacity}
            onApplyCrop={handleApplyCrop}
            onResize={handleResize}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            imageDimensions={imageDimensions}
          />
          <div className="canvas-area">
            <CanvasEditor
              ref={canvasRef}
              imageUrl={imageUrl}
              currentNodeId={imageHistoryNode?.id}
              activeTool={activeTool}
              brushColor={brushColor}
              brushSize={brushSize}
              brushOpacity={brushOpacity}
              onCursorMove={setCursorPos}
              onZoomChange={setZoom}
              onImageDimensions={setImageDimensions}
              onCanvasReady={handleCanvasReady}
              onToolChange={setActiveTool}
              onCanvasHistoryChange={handleCanvasHistoryChange}
              onImageLoaded={() => resolveImageLoadedRef.current?.()}
            />
          </div>
          <div className="right-column">
            <TreePanel headId={head.id} historyVersion={historyVersion} setNode={setNode} currNode={imageHistoryNode} />
            <ChatWindow imageHistoryNode={imageHistoryNode} head={head} onEditComplete={handleEditComplete} canvasRef={canvasRef} />
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
          <ChatHistoryView currentHeadId={head.id} onSelectChat={handleSelectChat} onDeleteChat={handleDeleteChat} />
        </div>
      )}
      <StatusBar
        zoom={zoom}
        imageDimensions={imageDimensions}
        cursorPos={cursorPos}
        activeTool={activeTool}
        objectCount={objectCount}
      />
    </div>
  )
}

export default App
