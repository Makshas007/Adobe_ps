import { useState } from 'react'
import ToolbarRibbon from './components/ToolbarRibbon'
import StatusBar from './components/StatusBar'
import TreePanel from './components/TreePanel'
import ChatWindow from './components/ChatWindow'
import ImageViewer from './components/ImageViewer'
import {image, history} from './utilities/indexedDB.js'
import './App.css'
import { dataURLtoBlob } from './utilities/type.js'

function App() {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageHistoryNode, setImageHistoryNode] = useState(null)
  const [head, setHead]=useState(null)

  const handleUpload = async ({ url, filename, file }) => {
    setImageUrl(url)
    const {id} = await image.addImage(file);
    const headNode = await history.addNode({label:"Uploaded File", time:new Date().toLocaleString(), imageId:id}, null)
    setImageHistoryNode({ ...headNode, filename });
    setHead(headNode)
  }

  const handleEditComplete = async (dataUri, label) => {
    setImageUrl(dataUri)
    const blob = dataURLtoBlob(dataUri);
    const {id} = await image.addImage(blob);
    const node = await history.addNode({label, time:new Date().toLocaleString(), imageId:id}, imageHistoryNode.id)
    setImageHistoryNode({ ...node, filename: imageHistoryNode.filename })
  }

  return (
    <div className="app-layout">
      <ToolbarRibbon onUpload={handleUpload} />
      <div className="main-content">
        <ImageViewer imageUrl={imageUrl} />
        <div className="right-column">
          <TreePanel headId={head.id} />
          <ChatWindow imageHistoryNode={imageHistoryNode} onEditComplete={handleEditComplete} />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}

export default App
