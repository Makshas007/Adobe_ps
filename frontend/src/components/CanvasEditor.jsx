import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import * as fabric from 'fabric'

const CANVAS_BG_COLOR = '#2a2a2a'

function getImageBounds(img) {
  const sw = img.getScaledWidth()
  const sh = img.getScaledHeight()
  return {
    left: img.left - sw / 2,
    top: img.top - sh / 2,
    right: img.left + sw / 2,
    bottom: img.top + sh / 2,
  }
}

const CanvasEditor = forwardRef(function CanvasEditor(
  { imageUrl, activeTool, brushColor, brushSize, brushOpacity, onCursorMove, onZoomChange, onImageDimensions, onCanvasReady, onToolChange },
  ref
) {
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const fabricRef = useRef(null)
  const bgImageRef = useRef(null)
  const isPanning = useRef(false)
  const lastPanPos = useRef({ x: 0, y: 0 })
  const spaceHeld = useRef(false)
  const shapeStartPoint = useRef(null)
  const shapeRef = useRef(null)
  const cropRectRef = useRef(null)

  const activeToolRef = useRef(activeTool)
  const brushColorRef = useRef(brushColor)
  const brushSizeRef = useRef(brushSize)
  const brushOpacityRef = useRef(brushOpacity)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { brushColorRef.current = brushColor }, [brushColor])
  useEffect(() => { brushSizeRef.current = brushSize }, [brushSize])
  useEffect(() => { brushOpacityRef.current = brushOpacity }, [brushOpacity])

  const onToolChangeRef = useRef(onToolChange)
  useEffect(() => { onToolChangeRef.current = onToolChange }, [onToolChange])

  useImperativeHandle(ref, () => ({
    getCanvas: () => fabricRef.current,
    exportImage: () => {
      const canvas = fabricRef.current
      if (!canvas || !bgImageRef.current) return null
      const img = bgImageRef.current
      const sw = img.getScaledWidth()
      const sh = img.getScaledHeight()
      const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
        left: img.left - sw / 2,
        top: img.top - sh / 2,
        width: sw,
        height: sh,
      })
      return dataUrl
    },
    applyCrop: (cropData) => {
      const canvas = fabricRef.current
      if (!canvas || !bgImageRef.current) return null
      const { left, top, width, height } = cropData

      const img = bgImageRef.current
      const imgScaleX = img.scaleX
      const imgScaleY = img.scaleY
      const imgBounds = getImageBounds(img)

      const cropLeftInImg = (left - imgBounds.left) / imgScaleX
      const cropTopInImg = (top - imgBounds.top) / imgScaleY
      const cropWidthInImg = width / imgScaleX
      const cropHeightInImg = height / imgScaleY

      const srcEl = img.getElement()
      const tmpCanvas = document.createElement('canvas')
      tmpCanvas.width = Math.max(1, Math.round(cropWidthInImg))
      tmpCanvas.height = Math.max(1, Math.round(cropHeightInImg))
      const ctx = tmpCanvas.getContext('2d')
      ctx.drawImage(
        srcEl,
        Math.round(cropLeftInImg), Math.round(cropTopInImg),
        Math.round(cropWidthInImg), Math.round(cropHeightInImg),
        0, 0,
        tmpCanvas.width, tmpCanvas.height
      )
      const croppedDataUrl = tmpCanvas.toDataURL('image/png')

      const userObjects = canvas.getObjects().filter(o => o !== bgImageRef.current && !o.isCropRect)
      canvas.remove(...userObjects)

      if (cropRectRef.current) { canvas.remove(cropRectRef.current); cropRectRef.current = null }

      const newWidth = tmpCanvas.width
      const newHeight = tmpCanvas.height

      return new Promise((resolve) => {
        const croppedImg = new Image()
        croppedImg.onload = () => {
          canvas.remove(bgImageRef.current)
          bgImageRef.current = null

          const wrapper = wrapperRef.current
          const containerW = wrapper ? wrapper.clientWidth : 800
          const containerH = wrapper ? wrapper.clientHeight : 600
          const scale = Math.min(containerW / newWidth, containerH / newHeight)

          canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
          canvas.setDimensions({ width: containerW, height: containerH })

          const fabricImage = new fabric.FabricImage(croppedImg, {
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            hoverCursor: 'default',
            originX: 'center',
            originY: 'center',
            left: containerW / 2,
            top: containerH / 2,
          })
          fabricImage.scale(scale)
          canvas.add(fabricImage)
          canvas.sendObjectToBack(fabricImage)
          bgImageRef.current = fabricImage

          userObjects.forEach(obj => {
            obj.set({
              left: (obj.left || 0) - left,
              top: (obj.top || 0) - top,
            })
            obj.scaleX = (obj.scaleX || 1) * scale
            obj.scaleY = (obj.scaleY || 1) * scale
            obj.setCoords()
            canvas.add(obj)
          })

          canvas.renderAll()
          resolve({ width: newWidth, height: newHeight })
        }
        croppedImg.src = croppedDataUrl
      })
    },
    resizeCanvas: (newWidth, newHeight) => {
      const canvas = fabricRef.current
      if (!canvas || !bgImageRef.current) return
      const img = bgImageRef.current
      const srcEl = img.getElement()
      const srcWidth = srcEl.naturalWidth || srcEl.width
      const srcHeight = srcEl.naturalHeight || srcEl.height

      canvas.remove(bgImageRef.current)
      bgImageRef.current = null

      canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
      canvas.setDimensions({ width: newWidth, height: newHeight })

      const scaleX = newWidth / srcWidth
      const scaleY = newHeight / srcHeight
      const scale = Math.min(scaleX, scaleY)

      const fabricImage = new fabric.FabricImage(srcEl, {
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'default',
        originX: 'center',
        originY: 'center',
        left: newWidth / 2,
        top: newHeight / 2,
      })
      fabricImage.scale(scale)

      canvas.add(fabricImage)
      canvas.sendObjectToBack(fabricImage)
      bgImageRef.current = fabricImage
      canvas.renderAll()
    },
    applyFilter: (filterType, value) => {
      const canvas = fabricRef.current
      if (!canvas || !bgImageRef.current) return
      const img = bgImageRef.current

      img.filters = img.filters || []
      img.filters = img.filters.filter(f => f.type !== filterType)

      let filter = null
      switch (filterType) {
        case 'Brightness':
          filter = new fabric.filters.Brightness({ brightness: value })
          break
        case 'Contrast':
          filter = new fabric.filters.Contrast({ contrast: value })
          break
        case 'Saturation':
          filter = new fabric.filters.Saturation({ saturation: value })
          break
        case 'HueRotation':
          filter = new fabric.filters.HueRotation({ rotation: value })
          break
        case 'Blur':
          filter = new fabric.filters.Blur({ blur: value })
          break
      }
      if (filter) img.filters.push(filter)

      img.applyFilters()
      canvas.renderAll()
    },
    getCanvasDimensions: () => {
      const canvas = fabricRef.current
      if (!canvas) return { width: 0, height: 0 }
      return { width: canvas.width, height: canvas.height }
    },
    getObjectCount: () => {
      const canvas = fabricRef.current
      if (!canvas) return 0
      return canvas.getObjects().filter(o => o !== bgImageRef.current).length
    },
    removeSelected: () => {
      const canvas = fabricRef.current
      if (!canvas) return
      const active = canvas.getActiveObjects()
      active.forEach(obj => {
        if (obj !== bgImageRef.current) canvas.remove(obj)
      })
      canvas.discardActiveObject()
      canvas.renderAll()
    }
  }))

  const fitImageToContainer = useCallback((canvas, imgEl) => {
    const wrapper = wrapperRef.current
    const containerW = wrapper ? wrapper.clientWidth : 800
    const containerH = wrapper ? wrapper.clientHeight : 600

    const imgW = imgEl.naturalWidth || imgEl.width
    const imgH = imgEl.naturalHeight || imgEl.height
    const scale = Math.min(containerW / imgW, containerH / imgH)

    if (bgImageRef.current) {
      canvas.remove(bgImageRef.current)
      bgImageRef.current = null
    }

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    canvas.setDimensions({ width: containerW, height: containerH })

    const isSelect = activeToolRef.current === 'select'
    const fabricImage = new fabric.FabricImage(imgEl, {
      selectable: isSelect,
      evented: isSelect,
      hasControls: isSelect,
      hasBorders: isSelect,
      hoverCursor: isSelect ? 'move' : 'default',
      originX: 'center',
      originY: 'center',
      left: containerW / 2,
      top: containerH / 2,
    })

    canvas.add(fabricImage)
    canvas.sendObjectToBack(fabricImage)
    bgImageRef.current = fabricImage
    canvas.renderAll()

    if (onImageDimensions) onImageDimensions({ width: imgW, height: imgH })
    if (onZoomChange) onZoomChange(100)
  }, [onImageDimensions, onZoomChange])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: CANVAS_BG_COLOR,
      selection: true,
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas
    if (onCanvasReady) onCanvasReady(canvas)

    const handleResize = () => {
      const wrapper = wrapperRef.current
      if (!wrapper) return
      const containerW = wrapper.clientWidth
      const containerH = wrapper.clientHeight
      canvas.setDimensions({ width: containerW, height: containerH })
      if (bgImageRef.current) {
        const imgEl = bgImageRef.current.getElement()
        const imgW = imgEl.naturalWidth || imgEl.width
        const imgH = imgEl.naturalHeight || imgEl.height
        const s = Math.min(containerW / imgW, containerH / imgH)
        bgImageRef.current.scale(s)
        bgImageRef.current.set({ left: containerW / 2, top: containerH / 2 })
      }
      canvas.renderAll()
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    canvas.on('mouse:move', (opt) => {
      const pointer = canvas.getScenePoint(opt.e)
      if (onCursorMove) onCursorMove({ x: Math.round(pointer.x), y: Math.round(pointer.y) })
    })

    canvas.on('mouse:wheel', (opt) => {
      if (activeToolRef.current === 'brush' || activeToolRef.current === 'eraser') return
      const delta = opt.e.deltaY
      let zoom = canvas.getZoom()
      zoom *= 0.999 ** delta
      if (zoom > 10) zoom = 10
      if (zoom < 0.1) zoom = 0.1
      canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom)
      opt.e.preventDefault()
      opt.e.stopPropagation()
      if (onZoomChange) onZoomChange(Math.round(zoom * 100))
    })

    canvas.on('mouse:down', (opt) => {
      if (spaceHeld.current || opt.e.button === 1) {
        isPanning.current = true
        lastPanPos.current = { x: opt.e.clientX, y: opt.e.clientY }
        canvas.selection = false
        canvas.setCursor('grabbing')
        opt.e.preventDefault()
        return
      }
    })

    canvas.on('mouse:up', () => {
      if (isPanning.current) {
        isPanning.current = false
        canvas.selection = activeToolRef.current === 'select'
        canvas.setCursor('default')
      }
    })

    canvas.on('mouse:move', (opt) => {
      if (isPanning.current) {
        const dx = opt.e.clientX - lastPanPos.current.x
        const dy = opt.e.clientY - lastPanPos.current.y
        canvas.relativePan(new fabric.Point(dx, dy))
        lastPanPos.current = { x: opt.e.clientX, y: opt.e.clientY }
      }
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !imageUrl) return

    canvas.getObjects().forEach(obj => {
      if (obj !== bgImageRef.current) canvas.remove(obj)
    })

    const imgEl = new Image()
    imgEl.crossOrigin = 'anonymous'
    imgEl.onload = () => {
      const currentCanvas = fabricRef.current
      if (!currentCanvas || currentCanvas !== canvas) return
      fitImageToContainer(currentCanvas, imgEl)
    }
    imgEl.src = imageUrl
  }, [imageUrl, fitImageToContainer])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const tool = activeTool
    const color = brushColor
    const size = brushSize
    const opacity = brushOpacity

    canvas.isDrawingMode = false
    canvas.selection = false
    canvas.forEachObject(obj => {
      obj.selectable = false
      obj.evented = false
      obj.hoverCursor = 'default'
    })

    if (shapeRef.current) { canvas.remove(shapeRef.current); shapeRef.current = null }
    if (cropRectRef.current) { canvas.remove(cropRectRef.current); cropRectRef.current = null }

    canvas.off('mouse:down')
    canvas.off('mouse:move')
    canvas.off('mouse:up')
    canvas.off('mouse:dblclick')

    canvas.on('mouse:down', (opt) => {
      if (spaceHeld.current || opt.e.button === 1) {
        isPanning.current = true
        lastPanPos.current = { x: opt.e.clientX, y: opt.e.clientY }
        canvas.selection = false
        canvas.setCursor('grabbing')
        opt.e.preventDefault()
        return
      }
      if (tool === 'text') {
        if (opt.target) return
        const pointer = canvas.getScenePoint(opt.e)
        const t = new fabric.IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 24,
          fontFamily: 'Inter, sans-serif',
          fill: color,
          editable: true,
        })
        canvas.add(t)
        canvas.setActiveObject(t)
        t.enterEditing()
        t.selectAll()
        canvas.renderAll()
      } else if (tool === 'rect' || tool === 'circle' || tool === 'line') {
        const pointer = canvas.getScenePoint(opt.e)
        shapeStartPoint.current = { x: pointer.x, y: pointer.y }
        let shape = null
        if (tool === 'rect') {
          shape = new fabric.Rect({
            left: pointer.x, top: pointer.y, width: 0, height: 0,
            fill: 'transparent', stroke: color, strokeWidth: 2,
            selectable: false, evented: false,
          })
        } else if (tool === 'circle') {
          shape = new fabric.Ellipse({
            left: pointer.x, top: pointer.y, rx: 0, ry: 0,
            fill: 'transparent', stroke: color, strokeWidth: 2,
            selectable: false, evented: false,
          })
        } else if (tool === 'line') {
          shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: color, strokeWidth: 2,
            selectable: false, evented: false,
          })
        }
        if (shape) { canvas.add(shape); shapeRef.current = shape }
      } else if (tool === 'crop') {
        if (!bgImageRef.current) return
        const pointer = canvas.getScenePoint(opt.e)
        shapeStartPoint.current = { x: pointer.x, y: pointer.y }

        const cropRect = new fabric.Rect({
          left: pointer.x, top: pointer.y, width: 0, height: 0,
          originX: 'left', originY: 'top',
          fill: 'transparent', stroke: '#fff', strokeWidth: 2,
          strokeDashArray: [5, 5], selectable: false, evented: false,
          isCropRect: true,
        })
        cropRectRef.current = cropRect
        canvas.add(cropRect)
      }
    })

    canvas.on('mouse:move', (opt) => {
      if (isPanning.current) {
        const dx = opt.e.clientX - lastPanPos.current.x
        const dy = opt.e.clientY - lastPanPos.current.y
        canvas.relativePan(new fabric.Point(dx, dy))
        lastPanPos.current = { x: opt.e.clientX, y: opt.e.clientY }
        return
      }
      if (tool === 'rect' || tool === 'circle' || tool === 'line') {
        if (!shapeStartPoint.current || !shapeRef.current) return
        const pointer = canvas.getScenePoint(opt.e)
        const sx = shapeStartPoint.current.x
        const sy = shapeStartPoint.current.y
        if (tool === 'rect') {
          shapeRef.current.set({
            left: Math.min(sx, pointer.x), top: Math.min(sy, pointer.y),
            width: Math.abs(pointer.x - sx), height: Math.abs(pointer.y - sy),
          })
        } else if (tool === 'circle') {
          shapeRef.current.set({
            left: Math.min(sx, pointer.x), top: Math.min(sy, pointer.y),
            rx: Math.abs(pointer.x - sx) / 2, ry: Math.abs(pointer.y - sy) / 2,
          })
        } else if (tool === 'line') {
          shapeRef.current.set({ x2: pointer.x, y2: pointer.y })
        }
        canvas.renderAll()
      } else if (tool === 'crop') {
        if (!shapeStartPoint.current || !cropRectRef.current || !bgImageRef.current) return
        const pointer = canvas.getScenePoint(opt.e)
        const sx = shapeStartPoint.current.x
        const sy = shapeStartPoint.current.y

        const imgBounds = getImageBounds(bgImageRef.current)

        const left = Math.max(imgBounds.left, Math.min(sx, pointer.x))
        const top = Math.max(imgBounds.top, Math.min(sy, pointer.y))
        const right = Math.min(imgBounds.right, Math.max(sx, pointer.x))
        const bottom = Math.min(imgBounds.bottom, Math.max(sy, pointer.y))
        cropRectRef.current.set({ left, top, width: right - left, height: bottom - top })
        canvas.renderAll()
      }
    })

    canvas.on('mouse:up', () => {
      if (isPanning.current) {
        isPanning.current = false
        canvas.selection = activeToolRef.current === 'select'
        canvas.setCursor('default')
        return
      }
      if (tool === 'rect' || tool === 'circle' || tool === 'line') {
        if (!shapeRef.current) return
        shapeRef.current.set({ selectable: true, evented: true })
        canvas.setActiveObject(shapeRef.current)
        canvas.renderAll()
        shapeRef.current = null
        shapeStartPoint.current = null
        onToolChangeRef.current?.('select')
      } else if (tool === 'crop') {
        if (cropRectRef.current && (cropRectRef.current.width < 2 || cropRectRef.current.height < 2)) {
          if (cropRectRef.current) { canvas.remove(cropRectRef.current); cropRectRef.current = null }
        }
        shapeStartPoint.current = null
      }
    })

    switch (tool) {
      case 'select':
        canvas.selection = true
        canvas.forEachObject(obj => {
          if (obj === bgImageRef.current) {
            obj.selectable = false
            obj.evented = false
            obj.hasControls = false
            obj.hasBorders = false
            obj.hoverCursor = 'default'
          } else {
            obj.selectable = true
            obj.evented = true
            obj.hasControls = true
            obj.hasBorders = true
            obj.hoverCursor = 'move'
          }
        })
        canvas.defaultCursor = 'default'
        break
      case 'brush':
        canvas.isDrawingMode = true
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
        canvas.freeDrawingBrush.color = color
        canvas.freeDrawingBrush.width = size
        canvas.freeDrawingBrush.opacity = opacity
        canvas.freeDrawingBrush.strokeLineCap = 'round'
        canvas.freeDrawingBrush.strokeLineJoin = 'round'
        canvas.defaultCursor = 'crosshair'
        break
      case 'eraser':
        canvas.isDrawingMode = true
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
        canvas.freeDrawingBrush.color = CANVAS_BG_COLOR
        canvas.freeDrawingBrush.width = size * 2
        canvas.freeDrawingBrush.opacity = 1
        canvas.freeDrawingBrush.strokeLineCap = 'round'
        canvas.freeDrawingBrush.strokeLineJoin = 'round'
        canvas.defaultCursor = 'crosshair'
        break
      case 'text':
        canvas.defaultCursor = 'text'
        break
      case 'rect':
      case 'circle':
      case 'line':
        canvas.defaultCursor = 'crosshair'
        break
      case 'crop':
        canvas.defaultCursor = 'crosshair'
        break
      default:
        canvas.defaultCursor = 'default'
    }
    canvas.renderAll()
  }, [activeTool, brushColor, brushSize, brushOpacity])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.target.closest('input, textarea, [contenteditable]')) {
        e.preventDefault()
        spaceHeld.current = true
        if (fabricRef.current) fabricRef.current.setCursor('grab')
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!e.target.closest('input, textarea, [contenteditable]')) {
          const canvas = fabricRef.current
          if (canvas) {
            const active = canvas.getActiveObjects()
            active.forEach(obj => {
              if (obj !== bgImageRef.current) canvas.remove(obj)
            })
            canvas.discardActiveObject()
            canvas.renderAll()
          }
        }
      }
    }
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        if (fabricRef.current) fabricRef.current.setCursor('default')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <main className="image-viewer">
      <div className="canvas-container-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} />
      </div>
    </main>
  )
})

export default CanvasEditor
