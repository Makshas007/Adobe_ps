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
  { imageUrl, activeTool, brushColor, brushSize, brushOpacity, onCursorMove, onZoomChange, onImageDimensions, onCanvasReady, onToolChange, onCanvasHistoryChange, onImageLoaded, currentNodeId, onSelectionChange },
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
  const toolCursorRef = useRef(null)
  const isBlurringRef = useRef(false)
  const blurPointsRef = useRef([])
  const blurOriginalElRef = useRef(null)
  const isRestoringRef = useRef(false)
  const isDoodleErasingRef = useRef(false)

  const nodeHistoryMapRef = useRef(new Map())
  const currentNodeIdRef = useRef(null)
  const canvasHistoryRef = useRef([])
  const canvasHistoryIndexRef = useRef(-1)
  const skipSaveRef = useRef(false)
  const pendingRestoreRef = useRef(false)
  const onCanvasHistoryChangeRef = useRef(onCanvasHistoryChange)
  useEffect(() => { onCanvasHistoryChangeRef.current = onCanvasHistoryChange }, [onCanvasHistoryChange])

  const notifyHistoryChange = useCallback(() => {
    onCanvasHistoryChangeRef.current?.(
      canvasHistoryIndexRef.current > 0,
      canvasHistoryIndexRef.current < canvasHistoryRef.current.length - 1
    )
  }, [])

  const saveCanvasState = useCallback(() => {
    if (skipSaveRef.current) return
    const canvas = fabricRef.current
    if (!canvas) return
    const objects = canvas.getObjects().filter(o => !o.isCropRect)
    const bgSrc = bgImageRef.current?.getElement()?.src || null
    const state = JSON.stringify({
      objects: objects.map(o => o.toJSON(['isCropRect', 'isEraser'])),
      bgSrc,
    })
    if (canvasHistoryIndexRef.current >= 0 &&
        canvasHistoryRef.current[canvasHistoryIndexRef.current] === state) return
    canvasHistoryRef.current = canvasHistoryRef.current.slice(0, canvasHistoryIndexRef.current + 1)
    canvasHistoryRef.current.push(state)
    canvasHistoryIndexRef.current = canvasHistoryRef.current.length - 1
    if (canvasHistoryRef.current.length > 50) {
      canvasHistoryRef.current.shift()
      canvasHistoryIndexRef.current--
    }
    notifyHistoryChange()
  }, [notifyHistoryChange])

  function restoreBackground(canvas, bgSrc) {
    if (!bgSrc || !canvas) return Promise.resolve()
    if (bgImageRef.current && bgImageRef.current.getElement().src === bgSrc) return Promise.resolve()
    return new Promise((resolve) => {
      const imgEl = new window.Image()
      imgEl.onload = () => {
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
        const fabricImage = new fabric.FabricImage(imgEl, {
          selectable: false, evented: false, hasControls: false, hasBorders: false,
          hoverCursor: 'default', originX: 'center', originY: 'center',
          left: containerW / 2, top: containerH / 2,
        })
        fabricImage.scale(scale)
        bgImageRef.current = fabricImage
        canvas.add(fabricImage)
        canvas.sendObjectToBack(fabricImage)
        resolve()
      }
      imgEl.onerror = () => resolve()
      imgEl.src = bgSrc
    })
  }

  const canvasUndo = useCallback(() => {
    if (canvasHistoryIndexRef.current <= 0) return
    canvasHistoryIndexRef.current--
    const canvas = fabricRef.current
    if (!canvas) return
    skipSaveRef.current = true
    const state = JSON.parse(canvasHistoryRef.current[canvasHistoryIndexRef.current])
    const objects = state.objects || state
    const bgSrc = state.bgSrc || null
    const toRemove = canvas.getObjects().filter(o => o !== bgImageRef.current && !o.isCropRect)
    toRemove.forEach(o => canvas.remove(o))
    const restoreObjects = () => {
      fabric.util.enlivenObjects(objects).then(newObjects => {
        newObjects.forEach(o => canvas.add(o))
        canvas.renderAll()
        skipSaveRef.current = false
        notifyHistoryChange()
      })
    }
    if (bgSrc) restoreBackground(canvas, bgSrc).then(restoreObjects)
    else restoreObjects()
  }, [notifyHistoryChange])

  const canvasRedo = useCallback(() => {
    if (canvasHistoryIndexRef.current >= canvasHistoryRef.current.length - 1) return
    canvasHistoryIndexRef.current++
    const canvas = fabricRef.current
    if (!canvas) return
    skipSaveRef.current = true
    const state = JSON.parse(canvasHistoryRef.current[canvasHistoryIndexRef.current])
    const objects = state.objects || state
    const bgSrc = state.bgSrc || null
    const toRemove = canvas.getObjects().filter(o => o !== bgImageRef.current && !o.isCropRect)
    toRemove.forEach(o => canvas.remove(o))
    const restoreObjects = () => {
      fabric.util.enlivenObjects(objects).then(newObjects => {
        newObjects.forEach(o => canvas.add(o))
        canvas.renderAll()
        skipSaveRef.current = false
        notifyHistoryChange()
      })
    }
    if (bgSrc) restoreBackground(canvas, bgSrc).then(restoreObjects)
    else restoreObjects()
  }, [notifyHistoryChange])

  useEffect(() => {
    const prevId = currentNodeIdRef.current
    const newId = currentNodeId || null

    if (prevId && prevId !== newId) {
      nodeHistoryMapRef.current.set(prevId, {
        history: [...canvasHistoryRef.current],
        index: canvasHistoryIndexRef.current,
      })
    }

    if (newId) {
      const saved = nodeHistoryMapRef.current.get(newId)
      if (saved) {
        canvasHistoryRef.current = saved.history
        canvasHistoryIndexRef.current = saved.index
        pendingRestoreRef.current = true
      } else {
        canvasHistoryRef.current = []
        canvasHistoryIndexRef.current = -1
        pendingRestoreRef.current = false
      }
    } else {
      canvasHistoryRef.current = []
      canvasHistoryIndexRef.current = -1
      pendingRestoreRef.current = false
    }

    currentNodeIdRef.current = newId
    notifyHistoryChange()
  }, [currentNodeId, notifyHistoryChange])

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
  const onImageLoadedRef = useRef(onImageLoaded)
  useEffect(() => { onImageLoadedRef.current = onImageLoaded }, [onImageLoaded])
  const onSelectionChangeRef = useRef(onSelectionChange)
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange }, [onSelectionChange])

  function getSelectedObjectData() {
    const canvas = fabricRef.current
    if (!canvas) return null
    const obj = canvas.getActiveObject()
    if (!obj || obj === bgImageRef.current) return null
    const data = {
      type: obj.type,
      left: Math.round(obj.left),
      top: Math.round(obj.top),
      width: Math.round(obj.getScaledWidth()),
      height: Math.round(obj.getScaledHeight()),
      angle: Math.round(obj.angle || 0),
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      fill: obj.fill,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      opacity: obj.opacity,
    }
    if (obj.type === 'i-text' || obj.type === 'textbox') {
      data.fontSize = obj.fontSize
      data.fontFamily = obj.fontFamily
      data.fontWeight = obj.fontWeight
      data.textAlign = obj.textAlign
    }
    if (obj.type === 'ellipse') {
      data.rx = obj.rx
      data.ry = obj.ry
    }
    if (obj.type === 'rect') {
      data.rx = obj.rx || 0
      data.ry = obj.ry || 0
    }
    if (obj.type === 'line') {
      data.x1 = obj.x1
      data.y1 = obj.y1
      data.x2 = obj.x2
      data.y2 = obj.y2
    }
    return data
  }

  useImperativeHandle(ref, () => ({
    getCanvas: () => fabricRef.current,
    updateSelectedObject: (props) => {
      const canvas = fabricRef.current
      if (!canvas) return
      const obj = canvas.getActiveObject()
      if (!obj) return
      obj.set(props)
      obj.setCoords()
      canvas.renderAll()
      if (onSelectionChangeRef.current) onSelectionChangeRef.current(getSelectedObjectData())
    },
    deleteSelectedObject: () => {
      const canvas = fabricRef.current
      if (!canvas) return
      const obj = canvas.getActiveObject()
      if (!obj) return
      canvas.remove(obj)
      canvas.discardActiveObject()
      canvas.renderAll()
      if (onSelectionChangeRef.current) onSelectionChangeRef.current(null)
    },
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
          bgImageRef.current = fabricImage
          canvas.add(fabricImage)
          canvas.sendObjectToBack(fabricImage)

          const isSelect = activeToolRef.current === 'select'
          userObjects.forEach(obj => {
            obj.set({
              left: (obj.left || 0) - left,
              top: (obj.top || 0) - top,
            })
            obj.scaleX = (obj.scaleX || 1) * scale
            obj.scaleY = (obj.scaleY || 1) * scale
            obj.setCoords()
            obj.selectable = isSelect
            obj.evented = isSelect
            obj.hasControls = isSelect
            obj.hasBorders = isSelect
            obj.hoverCursor = isSelect ? 'move' : 'default'
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

      const isSelect = activeToolRef.current === 'select'
      const fabricImage = new fabric.FabricImage(srcEl, {
        selectable: isSelect,
        evented: isSelect,
        hasControls: false,
        hasBorders: false,
        hoverCursor: isSelect ? 'move' : 'default',
        originX: 'center',
        originY: 'center',
        left: newWidth / 2,
        top: newHeight / 2,
      })
      fabricImage.scale(scale)

      bgImageRef.current = fabricImage
      canvas.add(fabricImage)
      canvas.sendObjectToBack(fabricImage)
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
    hasUnsavedChanges: () => {
      const canvas = fabricRef.current
      if (!canvas || !bgImageRef.current) return false
      const userObjects = canvas.getObjects().filter(o => o !== bgImageRef.current && !o.isCropRect)
      return userObjects.length > 0
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
    },
    canvasUndo,
    canvasRedo,
    clear: () => {
      const canvas = fabricRef.current
      if (!canvas) return
      canvas.clear()
      bgImageRef.current = null
      canvasHistoryRef.current = []
      canvasHistoryIndexRef.current = -1
      notifyHistoryChange()
    },
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

    bgImageRef.current = fabricImage
    canvas.add(fabricImage)
    canvas.sendObjectToBack(fabricImage)
    canvas.renderAll()

    if (onImageDimensions) onImageDimensions({ width: imgW, height: imgH })
    if (onZoomChange) onZoomChange(100)
  }, [onImageDimensions, onZoomChange])

  function circleRectIntersect(cx, cy, r, rect) {
    const nearestX = Math.max(rect.left, Math.min(cx, rect.left + rect.width))
    const nearestY = Math.max(rect.top, Math.min(cy, rect.top + rect.height))
    const dx = cx - nearestX
    const dy = cy - nearestY
    return (dx * dx + dy * dy) < (r * r)
  }

  function applyBlurStroke() {
    const canvas = fabricRef.current
    if (!canvas || !bgImageRef.current || blurPointsRef.current.length === 0) return
    const imgEl = blurOriginalElRef.current || bgImageRef.current.getElement()
    if (!imgEl) return

    const srcW = imgEl.naturalWidth || imgEl.width
    const srcH = imgEl.naturalHeight || imgEl.height
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = srcW
    tempCanvas.height = srcH
    const ctx = tempCanvas.getContext('2d')
    ctx.drawImage(imgEl, 0, 0)

    const brushSize = brushSizeRef.current
    const bCanvas = document.createElement('canvas')
    bCanvas.width = srcW
    bCanvas.height = srcH
    const bCtx = bCanvas.getContext('2d')
    bCtx.filter = `blur(${brushSize * 1.5}px)`
    bCtx.drawImage(imgEl, 0, 0)

    const img = bgImageRef.current
    const imgBounds = getImageBounds(img)
    const scaleX = img.scaleX
    const scaleY = img.scaleY
    const r = brushSize * 3 / Math.min(scaleX || 1, scaleY || 1)

    blurPointsRef.current.forEach(p => {
      const px = (p.x - imgBounds.left) / scaleX
      const py = (p.y - imgBounds.top) / scaleY
      ctx.save()
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(bCanvas, 0, 0)
      ctx.restore()
    })

    const wrapper = wrapperRef.current
    const containerW = wrapper ? wrapper.clientWidth : 800
    const containerH = wrapper ? wrapper.clientHeight : 600

    const dataUrl = tempCanvas.toDataURL('image/png')
    const newImgEl = new window.Image()
    newImgEl.src = dataUrl
    newImgEl.onload = () => {
      skipSaveRef.current = true
      if (bgImageRef.current) {
        canvas.remove(bgImageRef.current)
        bgImageRef.current = null
      }
      const scale = Math.min(containerW / srcW, containerH / srcH)
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
      canvas.setDimensions({ width: containerW, height: containerH })
      const fabricImage = new fabric.FabricImage(newImgEl, {
        selectable: false, evented: false, hasControls: false, hasBorders: false,
        hoverCursor: 'default', originX: 'center', originY: 'center',
        left: containerW / 2, top: containerH / 2,
      })
      fabricImage.scale(scale)
      bgImageRef.current = fabricImage
      canvas.add(fabricImage)
      canvas.sendObjectToBack(fabricImage)
      canvas.renderAll()
      skipSaveRef.current = false
      saveCanvasState()
    }
  }

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

    const handleCanvasChange = () => { saveCanvasState() }
    canvas.on('object:added', handleCanvasChange)
    canvas.on('object:removed', handleCanvasChange)
    canvas.on('object:modified', handleCanvasChange)

    const handlePathCreated = (opt) => {
      if (activeToolRef.current === 'brush') {
        opt.path.set('stroke', brushColorRef.current)
        opt.path.set('opacity', brushOpacityRef.current)
        opt.path.setCoords()
      }
      if (activeToolRef.current === 'eraser') {
        opt.path.set('isEraser', true)
        opt.path.setCoords()
      }
    }
    canvas.on('path:created', handlePathCreated)

    const handleSelection = () => {
      if (onSelectionChangeRef.current) onSelectionChangeRef.current(getSelectedObjectData())
    }
    const handleSelectionCleared = () => {
      if (onSelectionChangeRef.current) onSelectionChangeRef.current(null)
    }
    canvas.on('selection:created', handleSelection)
    canvas.on('selection:updated', handleSelection)
    canvas.on('selection:cleared', handleSelectionCleared)

    canvas.on('mouse:move', (opt) => {
      const pointer = canvas.getScenePoint(opt.e)
      if (onCursorMove) onCursorMove({ x: Math.round(pointer.x), y: Math.round(pointer.y) })
    })

    canvas.on('mouse:wheel', (opt) => {
      if (activeToolRef.current === 'brush' || activeToolRef.current === 'eraser' || activeToolRef.current === 'blur' || activeToolRef.current === 'restore' || activeToolRef.current === 'doodle-eraser') return
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
      canvas.off('object:added', handleCanvasChange)
      canvas.off('object:removed', handleCanvasChange)
      canvas.off('object:modified', handleCanvasChange)
      canvas.off('path:created', handlePathCreated)
      canvas.off('selection:created', handleSelection)
      canvas.off('selection:updated', handleSelection)
      canvas.off('selection:cleared', handleSelectionCleared)
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (!imageUrl) {
      canvas.clear()
      bgImageRef.current = null
      return
    }

    canvas.getObjects().forEach(obj => {
      if (obj !== bgImageRef.current) canvas.remove(obj)
    })

    const imgEl = new Image()
    imgEl.crossOrigin = 'anonymous'
    imgEl.onload = () => {
      const currentCanvas = fabricRef.current
      if (!currentCanvas || currentCanvas !== canvas) return
      fitImageToContainer(currentCanvas, imgEl)
      onImageLoadedRef.current?.()
      if (pendingRestoreRef.current && canvasHistoryIndexRef.current >= 0) {
        skipSaveRef.current = true
        const state = JSON.parse(canvasHistoryRef.current[canvasHistoryIndexRef.current])
        const objects = state.objects || state
        fabric.util.enlivenObjects(objects).then(newObjects => {
          newObjects.forEach(o => currentCanvas.add(o))
          currentCanvas.renderAll()
          skipSaveRef.current = false
          pendingRestoreRef.current = false
        })
      }
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
    canvas.discardActiveObject()

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
            fill: 'transparent', stroke: color, strokeWidth: size,
            opacity: opacity, selectable: false, evented: false,
          })
        } else if (tool === 'circle') {
          shape = new fabric.Ellipse({
            left: pointer.x, top: pointer.y, rx: 0, ry: 0,
            fill: 'transparent', stroke: color, strokeWidth: size,
            opacity: opacity, selectable: false, evented: false,
          })
        } else if (tool === 'line') {
          shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: color, strokeWidth: size,
            opacity: opacity, selectable: false, evented: false,
          })
        }
        if (shape) { canvas.add(shape); shapeRef.current = shape }
      } else if (tool === 'crop') {
        if (!bgImageRef.current) return
        if (cropRectRef.current) { canvas.remove(cropRectRef.current); cropRectRef.current = null }
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
      } else if (tool === 'blur') {
        if (!bgImageRef.current) return
        isBlurringRef.current = true
        blurPointsRef.current = []
        blurOriginalElRef.current = bgImageRef.current.getElement()
        const pointer = canvas.getScenePoint(opt.e)
        const br = size * 2
        const cursorCircle = new fabric.Circle({
          left: pointer.x - br, top: pointer.y - br,
          radius: br, fill: 'rgba(255,255,255,0.1)', stroke: 'rgba(255,255,255,0.4)',
          strokeWidth: 1, selectable: false, evented: false,
        })
        toolCursorRef.current = cursorCircle
        canvas.add(cursorCircle)
        canvas.renderAll()
      } else if (tool === 'restore') {
        if (!bgImageRef.current) return
        isRestoringRef.current = true
        const pointer = canvas.getScenePoint(opt.e)
        const br = size * 2
        const cursorCircle = new fabric.Circle({
          left: pointer.x - br, top: pointer.y - br,
          radius: br, fill: 'rgba(144,238,144,0.15)', stroke: 'rgba(144,238,144,0.5)',
          strokeWidth: 1, selectable: false, evented: false,
        })
        toolCursorRef.current = cursorCircle
        canvas.add(cursorCircle)
        canvas.renderAll()
      } else if (tool === 'doodle-eraser') {
        if (!bgImageRef.current) return
        isDoodleErasingRef.current = true
        const pointer = canvas.getScenePoint(opt.e)
        const br = size * 2
        const cursorCircle = new fabric.Circle({
          left: pointer.x - br, top: pointer.y - br,
          radius: br, fill: 'rgba(255,100,100,0.15)', stroke: 'rgba(255,100,100,0.5)',
          strokeWidth: 1, selectable: false, evented: false,
        })
        toolCursorRef.current = cursorCircle
        canvas.add(cursorCircle)
        canvas.renderAll()
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
      } else if (tool === 'blur' && isBlurringRef.current) {
        const pointer = canvas.getScenePoint(opt.e)
        const br = size * 2
        blurPointsRef.current.push({ x: pointer.x, y: pointer.y })
        if (toolCursorRef.current) {
          toolCursorRef.current.set({ left: pointer.x - br, top: pointer.y - br })
          canvas.renderAll()
        }
      } else if (tool === 'restore' && isRestoringRef.current) {
        const pointer = canvas.getScenePoint(opt.e)
        const br = size * 2
        if (toolCursorRef.current) {
          toolCursorRef.current.set({ left: pointer.x - br, top: pointer.y - br })
        }
        const r = size * 3
        const toRemove = canvas.getObjects().filter(o =>
          o.isEraser && circleRectIntersect(pointer.x, pointer.y, r, o.getBoundingRect())
        )
        toRemove.forEach(o => canvas.remove(o))
        if (toRemove.length > 0) canvas.renderAll()
      } else if (tool === 'doodle-eraser' && isDoodleErasingRef.current) {
        const pointer = canvas.getScenePoint(opt.e)
        const br = size * 2
        if (toolCursorRef.current) {
          toolCursorRef.current.set({ left: pointer.x - br, top: pointer.y - br })
        }
        const r = size * 2
        const toRemove = canvas.getObjects().filter(o =>
          o !== bgImageRef.current && !o.isCropRect && !o.isEraser &&
          circleRectIntersect(pointer.x, pointer.y, r, o.getBoundingRect())
        )
        toRemove.forEach(o => canvas.remove(o))
        if (toRemove.length > 0) canvas.renderAll()
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
      } else if (tool === 'blur') {
        if (toolCursorRef.current) { canvas.remove(toolCursorRef.current); toolCursorRef.current = null }
        if (isBlurringRef.current) {
          isBlurringRef.current = false
          if (blurPointsRef.current.length > 0) applyBlurStroke()
          blurPointsRef.current = []
          blurOriginalElRef.current = null
        }
      } else if (tool === 'restore') {
        if (toolCursorRef.current) { canvas.remove(toolCursorRef.current); toolCursorRef.current = null }
        isRestoringRef.current = false
      } else if (tool === 'doodle-eraser') {
        if (toolCursorRef.current) { canvas.remove(toolCursorRef.current); toolCursorRef.current = null }
        isDoodleErasingRef.current = false
      }
    })

    switch (tool) {
      case 'select':
        canvas.selection = true
        canvas.forEachObject(obj => {
          if (obj === bgImageRef.current) {
            obj.selectable = true
            obj.evented = true
            obj.hasControls = false
            obj.hasBorders = false
            obj.hoverCursor = 'move'
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
        const hexToRgba = (hex, opacity) => {
          const r = parseInt(hex.slice(1, 3), 16)
          const g = parseInt(hex.slice(3, 5), 16)
          const b = parseInt(hex.slice(5, 7), 16)
          return `rgba(${r},${g},${b},${opacity})`
        }
        canvas.freeDrawingBrush.color = opacity < 1 ? hexToRgba(color, opacity) : color
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
      case 'blur':
      case 'restore':
      case 'doodle-eraser':
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
