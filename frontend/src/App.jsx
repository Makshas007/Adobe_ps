import { useState } from 'react'
import ToolbarRibbon from './components/ToolbarRibbon'
import StatusBar from './components/StatusBar'
import TreePanel from './components/TreePanel'
import ChatWindow from './components/ChatWindow'
import ImageViewer from './components/ImageViewer'
import './App.css'

function App() {
  const [imageUrl, setImageUrl] = useState(null)

  return (
    <div className="app-layout">
      <ToolbarRibbon onUpload={setImageUrl} />
      <div className="main-content">
        <ImageViewer imageUrl={imageUrl} />
        <div className="right-column">
          <TreePanel />
          <ChatWindow />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}

export default App
