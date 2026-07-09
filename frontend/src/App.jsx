import { useState } from 'react'
import ToolbarRibbon from './components/ToolbarRibbon'
import StatusBar from './components/StatusBar'
import TreePanel from './components/TreePanel'
import ChatWindow from './components/ChatWindow'
import ImageViewer from './components/ImageViewer'
import {image, history} from './utilities/indexedDB.js'
import { dataURLtoBlob } from './utilities/type.js'
import './App.css'

function App() {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageHistoryNode, setImageHistoryNode] = useState(null)
  const [imageFilename, setImageFilename] = useState(null)
  const [currentNode, setCurrentNode] = useState(null)
  const [dimensions, setDimensions] = useState(null)
  const [historyCount, setHistoryCount] = useState(0)

  const handleUpload = async ({ url, filename }) => {
    setImageUrl(url)
    setImageFilename(filename)
    const {id} =await image.addImage(file);
    const headNode=await history.addNode({label:'Uploaded Image', time:Date.now().toLocaleString(), imageId:id},null)
    setImageHistoryNode(headNode)
    setHistoryCount(1)
  }

  const handleEditComplete = async (newUrl,label,prevNode) => {
    const file = dataURLtoBlob(newUrl);
    const objectUrl = URL.createObjectURL(file);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(objectUrl)
    const {id} = await image.addImage(file);
    const headNode = await history.addNode({label, time:Date.now().toLocaleString(), imageId:id},prevNode)
    setCurrentNode(headNode)
    setHistoryCount(prev => prev + 1)
  }

  return (
    <div className="app-layout">
      <ToolbarRibbon onUpload={handleUpload} />
      <div className="main-content">
        <ImageViewer imageUrl={imageUrl} onImageLoad={setDimensions} />
        <div className="right-column">
          <TreePanel />
          <ChatWindow imageHistoryNode={imageHistoryNode} onEditComplete={handleEditComplete} />
        </div>
      </div>
      <StatusBar dimensions={dimensions} historyCount={historyCount} />
    </div>
  )
}

export default App
