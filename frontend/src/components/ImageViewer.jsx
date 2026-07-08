export default function ImageViewer({ imageUrl }) {
  return (
    <main className="image-viewer">
      <div className="image-canvas">
        {imageUrl ? (
          <img src={imageUrl} alt="Uploaded" className="uploaded-image" />
        ) : (
          <div className="placeholder">
            <p>Active Image</p>
            <p className="hint">Edit via chat or toolbar tools</p>
          </div>
        )}
      </div>
    </main>
  )
}
