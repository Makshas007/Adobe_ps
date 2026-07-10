import { useState } from 'react'
import ToolbarRibbon from './components/ToolbarRibbon'
import StatusBar from './components/StatusBar'
import TreePanel from './components/TreePanel'
import ChatWindow from './components/ChatWindow'
import ImageViewer from './components/ImageViewer'
import {image, history} from './utilities/indexedDB.js'
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
    setHead(headNode)
    setHistoryVersion(v => v + 1)
  }

  const setNode=async(node)=>{
    setImageHistoryNode(await history.getNode(node));
    const imgBlob = await image.getImage(imageHistoryNode.imgId);
    blobToDataURL(imgBlob,res=>setImageUrl(res))
  }

  const nextNode=async()=>{
    if(imageHistoryNode?.nextNode.length)return;
    else if(imageHistoryNode.nextNode.length===1) await setNode( imageHistoryNode.nextNode[0] );
    else {
    const i = parseInt(prompt("Enter Index to go to")??1);
    await  setNode(imageHistoryNode.nextNode[i-1]);
    }
  }

  const prevNode=async()=>{
    if(imageHistoryNode?.prevNode)return;
    else setNode(imageHistoryNode.prevNode)
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
          disabled={imageHistoryNode!=={}||imageHistoryNode?.prevNode}
        >Back</button>

        <button
          onClick={nextNode}
          disabled={imageHistoryNode!=={}||imageHistoryNode?.nextNode.length}
        >
          Front</button>
        <div className="right-column">
          <TreePanel headId={head.id} historyVersion={historyVersion} />
          <ChatWindow imageHistoryNode={imageHistoryNode} onEditComplete={handleEditComplete} />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}

export default App
