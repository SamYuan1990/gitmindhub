import React, { useMemo, useEffect } from 'react'
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, Handle, Position } from 'reactflow'
import 'reactflow/dist/style.css'

// 自定义 Commit 节点
const CommitNode = ({ data, selected, is_in_lineage, is_active }) => {
  const isUser = data.role === 'user'
  
  const opacity = is_in_lineage ? 1 : 0.4
  const borderColor = is_active ? '#3b82f6' : (isUser ? '#10b981' : '#6b7280')
  const bgColor = is_active ? '#eff6ff' : '#ffffff'

  return (
    <div style={{
      padding: '10px 14px', borderRadius: '8px', background: bgColor,
      border: `2px solid ${borderColor}`,
      boxShadow: is_active ? '0 0 0 3px rgba(59, 130, 246, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)',
      cursor: 'pointer', minWidth: '180px', maxWidth: '240px', 
      transition: 'all 0.2s', fontFamily: 'system-ui, sans-serif',
      opacity: opacity
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.7rem', color: '#6b7280' }}>
        <span style={{ fontWeight: '600' }}>{isUser ? '👤 User' : '🤖 AI'}</span>
        <code style={{ fontFamily: 'monospace' }}>{data.uuid.substring(0, 6)}</code>
      </div>
      <div style={{ fontSize: '0.8rem', lineHeight: '1.4', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {data.preview_text || data.full_text}
      </div>
      <Handle type="target" position={Position.Top} style={{ background: borderColor, width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, width: '8px', height: '8px' }} />
    </div>
  )
}

const nodeTypes = { commit: CommitNode }

function DagView({ messages = [], activeNodeId, onNodeClick, onNodeDoubleClick }) {
  
  const lineageIds = useMemo(() => {
    if (!activeNodeId || typeof activeNodeId !== 'string') return new Set()
    const ids = new Set()
    const msgMap = new Map(messages.map(m => [m.uuid, m]))
    let curr = activeNodeId
    while (curr) {
      ids.add(curr)
      const msg = msgMap.get(curr)
      if (!msg) break
      curr = msg.parent_uuid
    }
    return ids
  }, [messages, activeNodeId])

  // 🌟 核心重构：使用“子树宽度算法”彻底解决重叠问题
  const { nodes, edges } = useMemo(() => {
    const flowNodes = []
    const flowEdges = []
    
    if (messages.length === 0) return { nodes: flowNodes, edges: flowEdges }

    // 1. 构建树结构 (找出每个节点的子节点)
    const childrenMap = new Map()
    const roots = []
    
    messages.forEach(msg => {
      if (!msg.parent_uuid) {
        roots.push(msg)
      } else {
        if (!childrenMap.has(msg.parent_uuid)) {
          childrenMap.set(msg.parent_uuid, [])
        }
        childrenMap.get(msg.parent_uuid).push(msg)
      }
    })

    // 2. 计算每个节点的“子树宽度” (以叶子节点数量为基准)
    const subtreeWidth = new Map()
    const calculateWidth = (nodeId) => {
      const children = childrenMap.get(nodeId) || []
      if (children.length === 0) {
        subtreeWidth.set(nodeId, 1)
        return 1
      }
      let width = 0
      for (const child of children) {
        width += calculateWidth(child.uuid)
      }
      subtreeWidth.set(nodeId, width)
      return width
    }
    roots.forEach(root => calculateWidth(root.uuid))

    // 3. 布局参数
    const NODE_WIDTH = 260  // 节点宽度 + 水平间距 (需略大于节点的 maxWidth 240)
    const TREE_GAP = 150    // 不同的树之间的额外间隙
    const LEVEL_HEIGHT = 120 // 垂直层级高度

    const xCoords = {}
    const yCoords = {}

    // 4. 递归分配 X 坐标 (保证树内不重叠)
    const assignX = (nodeId, startX) => {
      const children = childrenMap.get(nodeId) || []
      const totalWidth = subtreeWidth.get(nodeId) || 1
      
      // 当前节点居中于它的子树宽度之上
      xCoords[nodeId] = startX + (totalWidth * NODE_WIDTH) / 2 - NODE_WIDTH / 2
      
      let childStartX = startX
      for (const child of children) {
        const childWidth = subtreeWidth.get(child.uuid) || 1
        assignX(child.uuid, childStartX)
        childStartX += childWidth * NODE_WIDTH
      }
    }

    // 5. 为每棵独立的树分配起始 X (保证树与树之间不重叠)
    let currentGlobalX = 0
    roots.forEach(root => {
      assignX(root.uuid, currentGlobalX)
      const treeWidth = subtreeWidth.get(root.uuid) || 1
      currentGlobalX += treeWidth * NODE_WIDTH + TREE_GAP
    })

    // 6. 计算 Y 坐标 (基于深度，保证所有根节点同高)
    const depthMap = new Map()
    const calculateDepth = (nodeId, currentDepth) => {
      depthMap.set(nodeId, currentDepth)
      const children = childrenMap.get(nodeId) || []
      for (const child of children) {
        calculateDepth(child.uuid, currentDepth + 1)
      }
    }
    roots.forEach(root => calculateDepth(root.uuid, 0))

    messages.forEach(msg => {
      const depth = depthMap.get(msg.uuid) || 0
      yCoords[msg.uuid] = 50 + depth * LEVEL_HEIGHT // 🌟 根节点深度为0，Y=50
    })

    // 7. 组装 React Flow 数据
    messages.forEach((msg) => {
      flowNodes.push({
        id: msg.uuid,
        type: 'commit',
        position: { x: xCoords[msg.uuid] || 0, y: yCoords[msg.uuid] || 50 },
        data: msg,
        is_in_lineage: lineageIds.has(msg.uuid),
        is_active: msg.uuid === activeNodeId
      })

      if (msg.parent_uuid) {
        flowEdges.push({
          id: `e-${msg.parent_uuid}-${msg.uuid}`,
          source: msg.parent_uuid,
          target: msg.uuid,
          type: 'smoothstep',
          style: { 
            stroke: lineageIds.has(msg.uuid) && lineageIds.has(msg.parent_uuid) ? '#3b82f6' : '#d1d5db', 
            strokeWidth: lineageIds.has(msg.uuid) ? 2 : 1 
          }
        })
      }
    })

    return { nodes: flowNodes, edges: flowEdges }
  }, [messages, activeNodeId, lineageIds])

  const [displayNodes, setNodes, onNodesChange] = useNodesState(nodes)
  const [displayEdges, setEdges, onEdgesChange] = useEdgesState(edges)

  useEffect(() => {
    setNodes(nodes)
    setEdges(edges)
  }, [nodes, edges, setNodes, setEdges])

  const handleNodeClick = (event, node) => {
    if (onNodeClick && typeof node.id === 'string') onNodeClick(node.id)
  }

  const handleNodeDoubleClick = (event, node) => {
    if (onNodeDoubleClick && typeof node.id === 'string') onNodeDoubleClick(node.id)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow 
        nodes={displayNodes} 
        edges={displayEdges} 
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick} 
        onNodeDoubleClick={handleNodeDoubleClick} 
        nodeTypes={nodeTypes} 
        fitView 
        fitViewOptions={{ padding: 0.2 }} 
        minZoom={0.1} // 🌟 调小最小缩放，防止树太宽时缩不到最小
        maxZoom={1.5} 
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => node.id === activeNodeId ? '#3b82f6' : (lineageIds.has(node.id) ? '#10b981' : '#d1d5db')} 
          maskColor="rgba(249, 250, 251, 0.7)" 
        />
      </ReactFlow>
      
      <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', color: '#4b5563', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        💡 单击选中节点，<strong>双击</strong>进行 Checkout 并切换到对话视图。
      </div>
    </div>
  )
}

export default DagView