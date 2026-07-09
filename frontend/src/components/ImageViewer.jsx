export default function ImageViewer({ imageUrl, onImageLoad }) {
  return (
    <main className="image-viewer">
      <div className="image-canvas">
        {imageUrl ? (
          <img src={imageUrl} alt="Uploaded" className="uploaded-image" onLoad={(e) => onImageLoad && onImageLoad({ width: e.target.naturalWidth, height: e.target.naturalHeight })} />
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
