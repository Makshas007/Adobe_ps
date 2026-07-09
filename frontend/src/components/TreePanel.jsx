import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  BaseEdge,
  getBezierPath,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import BaseNode from './BaseNode'
import { history } from '../utilities/indexedDB.js'

function flattenTree(node, edges) {
  const nodes = []
  const children = node.children || []
  nodes.push({
    id: node.id,
    type: 'historyNode',
    data: { title: node.label, subtitle: node.time },
  })
  for (const child of children) {
    edges.push({ id: `${node.id}->${child.id}`, source: node.id, target: child.id })
    const [childNodes] = flattenTree(child, edges)
    nodes.push(...childNodes)
  }
  return [nodes, edges]
}

const nodeWidth = 180
const nodeHeight = 52

function layoutNodes(rawNodes, rawEdges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 200, nodesep: 80, marginx: 40, marginy: 40 })
  for (const node of rawNodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  }
  for (const edge of rawEdges) {
    g.setEdge(edge.source, edge.target)
  }
  dagre.layout(g)
  return rawNodes.map((node) => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 } }
  })
}

function HistoryNode({ data, selected }) {
  return (
    <BaseNode data={data} selected={selected}>
      <div className="history-node__subtitle">{data.subtitle}</div>
    </BaseNode>
  )
}

function HistoryEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      className={`flow-edge${selected ? ' flow-edge--selected' : ''}`}
    />
  )
}

const nodeTypes = { historyNode: HistoryNode }
const edgeTypes = { historyEdge: HistoryEdge }

const defaultEdgeOptions = {
  type: 'historyEdge',
}

const connectionLineStyle = { stroke: '#FF1E8A', strokeWidth: 2, strokeDasharray: '5 5' }

function FlowCanvas({ miniature, treeData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [rfInstance, setRfInstance] = useState(null)

  useEffect(() => {
    if (!treeData) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const newEdges = []
    const [rawNodes] = flattenTree(treeData, newEdges)
    const layoutedNodes = layoutNodes(rawNodes, newEdges)
    setNodes(layoutedNodes)
    setEdges(newEdges)
  }, [treeData, setNodes, setEdges])

  useEffect(() => {
    if (rfInstance) {
        setTimeout(() => rfInstance.fitView({ padding: miniature ? 0.6 : 0.25 }), 50);
    }
  }, [miniature, treeData, rfInstance]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onInit={setRfInstance}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      connectionLineStyle={connectionLineStyle}
      fitView
      fitViewOptions={{
        padding: miniature ? 0.6 : 0.25,
      }}
      minZoom={miniature ? 0.05 : 0.1}
      maxZoom={miniature ? 0.5 : 3}
      nodesDraggable={!miniature}
      nodesConnectable={false}
      panOnDrag={!miniature}
      zoomOnScroll={!miniature}
      panOnScroll={false}
      colorMode="dark"
      proOptions={{ hideAttribution: true }}
    >
      {!miniature && <Background variant="dots" gap={20} size={1.5} color="#333" />}
    </ReactFlow>
  )
}

export default function TreePanel({ currentNode }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [treeData, setTreeData] = useState(null)

  const close = useCallback(() => setFullscreen(false), [])

  useEffect(() => {
    if (!fullscreen) return
    const handler = (e) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fullscreen])

  useEffect(() => {
    async function loadTree() {
        const heads = await history.getHeads();
        if (heads.length > 0) {
            // Assume the first head is the root for now, or trace back from currentNode
            let rootId = heads[0].id;
            if (currentNode) {
                let curr = await history.getNode(currentNode.id);
                while (curr && curr.prevNode) {
                    curr = await history.getNode(curr.prevNode);
                }
                if (curr) rootId = curr.id;
            }
            const t = await history.getTree(rootId);
            setTreeData(t);
        }
    }
    loadTree();
  }, [currentNode]);

  return (
    <>
      {fullscreen && <div className="tree-panel-backdrop" onClick={close} />}
      <aside className={`tree-panel${fullscreen ? ' tree-panel--fullscreen' : ''}`}>
        <div className="tree-panel-header">
          <h2>Edit History</h2>
          <button
            className="fullscreen-btn"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Minimize' : 'Full screen'}
          >
            {fullscreen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 14L2 12M2 12L4 10M2 12H6M12 2L14 4M14 4L12 6M14 4H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 4L4 2M4 2L2 6M6 14L4 12M12 2L14 6M10 14L12 12M14 10L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 9L7 14L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
        <div className="tree-container">
          <FlowCanvas miniature={!fullscreen} treeData={treeData} />
        </div>
      </aside>
    </>
  )
}
