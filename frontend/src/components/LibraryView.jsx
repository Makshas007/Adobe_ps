import { useState, useEffect } from 'react'
import { image, history, waitForDB } from '../utilities/indexedDB.js'
import { Trash2, ExternalLink, Image as ImageIcon } from 'lucide-react'

export default function LibraryView({ onSelectNode, currentHeadId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchLibrary = async () => {
      try {
        await waitForDB()
        const [imagesList, allNodes] = await Promise.all([
          image.getAllImages(),
          history.getAllNodes()
        ])

        if (!active) return

        // Map imageId to its node
        const nodeMapByImageId = {}
        for (const node of allNodes) {
          if (node.imageId) {
            nodeMapByImageId[node.imageId] = node
          }
        }

        const libraryItems = imagesList.map((img) => {
          const associatedNode = nodeMapByImageId[img.id]
          const objectUrl = URL.createObjectURL(img.blob)
          return {
            id: img.id,
            url: objectUrl,
            nodeId: associatedNode?.id || null,
            filename: (associatedNode?.id ? localStorage.getItem(associatedNode.id) : null) || 'Untitled File',
            label: associatedNode?.label || 'Edited Image',
            time: associatedNode?.time || 'Unknown Date',
            headId: associatedNode?.prevNode ? null : associatedNode?.id
          }
        })

        setItems(libraryItems)
      } catch (err) {
        console.error("Error loading library:", err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchLibrary()

    return () => {
      active = false
      // Clean up object URLs
      items.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [])

  const handleDelete = async (itemId, e) => {
    e.stopPropagation()
    if (!window.confirm("Are you sure you want to delete this image?")) return
    try {
      await image.deleteImage(itemId)
      setItems(prev => prev.filter(item => item.id !== itemId))
    } catch (err) {
      console.error("Failed to delete image:", err)
    }
  }

  if (loading) {
    return <div className="library-loading">Loading library assets...</div>
  }

  return (
    <div className="library-view">
      <div className="library-header">
        <h1>Asset Library</h1>
        <p className="subtitle">All image revisions and assets stored locally in IndexedDB</p>
      </div>

      {items.length === 0 ? (
        <div className="library-empty">
          <ImageIcon size={48} className="empty-icon" />
          <p>No images found in your local database.</p>
          <p className="small">Go to the Editor, upload an image and make edits to see them here!</p>
        </div>
      ) : (
        <div className="library-grid">
          {items.map((item) => (
            <div 
              key={item.id} 
              className={`library-item ${currentHeadId === item.headId ? 'active' : ''}`}
              onClick={() => item.nodeId && onSelectNode(item.nodeId)}
            >
              <div className="library-image-wrapper">
                <img src={item.url} alt={item.filename} />
                <div className="library-item-hover">
                  <span className="open-btn">
                    <ExternalLink size={14} style={{ marginRight: '6px' }} />
                    Open in Editor
                  </span>
                </div>
              </div>
              <div className="library-item-info">
                <div className="library-item-title" title={item.filename}>{item.filename}</div>
                <div className="library-item-meta">
                  <span className="library-item-label">{item.label}</span>
                  <span className="library-item-time">{item.time}</span>
                </div>
                <div className="library-item-actions">
                  <button 
                    className="library-delete-btn" 
                    onClick={(e) => handleDelete(item.id, e)} 
                    title="Delete image"
                  >
                    <Trash2 size={13} style={{ marginRight: '4px' }} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
