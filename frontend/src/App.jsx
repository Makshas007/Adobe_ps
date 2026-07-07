import ToolbarRibbon from './components/ToolbarRibbon'
import StatusBar from './components/StatusBar'
import TreePanel from './components/TreePanel'
import ChatWindow from './components/ChatWindow'
import ImageViewer from './components/ImageViewer'
import './App.css'

function App() {
  return (
    <div className="app-layout">
      <ToolbarRibbon />
      <div className="main-content">
        <ImageViewer />
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
