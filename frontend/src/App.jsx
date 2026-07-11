import { useState, useEffect } from 'react'
import ToolbarRibbon from './components/ToolbarRibbon'
import StatusBar from './components/StatusBar'
import TreePanel from './components/TreePanel'
import ChatWindow from './components/ChatWindow'
import ImageViewer from './components/ImageViewer'
import {image, history, waitForDB} from './utilities/indexedDB.js'
import './App.css'
import { blobToDataURL, dataURLtoBlob } from './utilities/type.js'

function App() {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageHistoryNode, setImageHistoryNode] = useState(null)
  const [head, setHead]=useState({})
  const [historyVersion, setHistoryVersion] = useState(0)

  const handleUpload = async ({ url, filename, file }) => {
    setImageUrl(url)
    const {id} = await image.addImage(file);
    const headNode = await history.addNode({label:"Uploaded File", time:new Date().toLocaleString(), imageId:id, filename}, null)
    setImageHistoryNode({ ...headNode, filename });
    setHead(headNode);
    localStorage.setItem(headNode,filename)
    window.history.pushState(null, '', '/'+headNode.id);
    setHistoryVersion(v => v + 1)
  }

  const handleChatNameChange=(chatId,val)=>localStorage.setItem(chatId,val);
  const handleChatDelete=async(chatId)=>  await history.delete(chatId)  

  useEffect(() => {
    const initLoad = async () => {
      try {
        await waitForDB()
        const uploadId = location.pathname.split('/')[1];
        const node = await history.getNode(uploadId)
        if (node) {
          setHead(node)
          await setNode(uploadId)
        } else {
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
    const {id} = await image.addImage(blob);
    const node = await history.addNode({label, time:new Date().toLocaleString(), imageId:id, filename: imageHistoryNode.filename}, imageHistoryNode.id)
    setImageHistoryNode({ ...node, filename: imageHistoryNode.filename })
    setHistoryVersion(v => v + 1)
  }

  return (
    <div className="app-layout">
      <ToolbarRibbon onUpload={handleUpload} />
      <div className="main-content">
        <ImageViewer imageUrl={imageUrl} />
        <button
          onClick={prevNode}
          disabled={!imageHistoryNode || !imageHistoryNode.prevNode}
        >Back</button>

        <button
          onClick={nextNode}
          disabled={!imageHistoryNode || !imageHistoryNode.nextNode?.length}
        >
          Front</button>
        <div className="right-column">
          <TreePanel headId={head.id} historyVersion={historyVersion} setNode={setNode} currNode={imageHistoryNode} />
          <ChatWindow imageHistoryNode={imageHistoryNode} onEditComplete={handleEditComplete} />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}

export default App
