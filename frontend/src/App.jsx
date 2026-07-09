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
  const [imageFilename, setImageFilename] = useState(null)

  const handleUpload = ({ url, filename }) => {
    setImageUrl(url)
    setImageFilename(filename)
  }

  const handleEditComplete = async (newUrl,label,prevNode) => {
    setImageUrl(newUrl)
    const file = dataURLtoBlob(newUrl);
    const {id} =await image.addImage(file);
    const headNode=await history.addNode({label, time:Date.now().toLocaleString(), imageId:id},prevNode)

  }

  return (
    <div className="app-layout">
      <ToolbarRibbon onUpload={handleUpload} />
      <div className="main-content">
        <ImageViewer imageUrl={imageUrl} />
        <div className="right-column">
          <TreePanel />
          <ChatWindow imageFilename={imageFilename} onEditComplete={handleEditComplete} />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}

export default App
