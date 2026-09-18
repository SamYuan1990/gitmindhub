import React, { useMemo, useEffect } from 'react'
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, Handle, Position } from 'reactflow'
import 'reactflow/dist/style.css'

// 自定义 Commit 节点
const CommitNode = ({ data, selected, is_in_lineage, is_active }) => {
  const isUser = data.role === 'user'
  
  // 🌟 根据是否在 Lineage 中决定样式
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

function DagView({ messages = [], activeNodeId, onNodeClick }) {
  
  // 🌟 计算当前 Lineage 的 UUID 集合 (用于高亮)
  const lineageIds = useMemo(() => {
    if (!activeNodeId) return new Set()
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

  // 动态生成 nodes 和 edges
  const { nodes, edges } = useMemo(() => {
    const flowNodes = []
    const flowEdges = []
    
    // 简单的树状布局算法 (按层级和分支偏移)
    const levels = {}
    messages.forEach(msg => {
      if (!levels[msg.parent_uuid || 'root']) levels[msg.parent_uuid || 'root'] = []
      levels[msg.parent_uuid || 'root'].push(msg)
    })

    // 计算 Y 坐标 (按时间/层级)
    const yCoords = {}
    const sortedMsgs = [...messages].sort((a, b) => a.timestamp - b.timestamp)
    sortedMsgs.forEach((msg, index) => {
      yCoords[msg.uuid] = index * 120 + 50
    })

    // 计算 X 坐标 (简单的分支偏移)
    const xCoords = {}
    const branchOffsets = { 'main': 0 }
    let currentOffset = 250

    messages.forEach(msg => {
      if (!xCoords[msg.uuid]) {
        if (msg.parent_uuid && xCoords[msg.parent_uuid] !== undefined) {
           // 如果父节点已经有子节点了，说明这是分叉，需要偏移
           const siblings = messages.filter(m => m.parent_uuid === msg.parent_uuid)
           if (siblings.length > 1) {
             branchOffsets[msg.branch || `branch_${msg.uuid}`] = currentOffset
             currentOffset += 250
           }
           xCoords[msg.uuid] = xCoords[msg.parent_uuid] + (branchOffsets[msg.branch || `branch_${msg.uuid}`] || 0)
        } else {
          xCoords[msg.uuid] = 400 // 根节点居中
        }
      }
    })

    messages.forEach((msg) => {
      flowNodes.push({
        id: msg.uuid,
        type: 'commit',
        position: { x: xCoords[msg.uuid] || 400, y: yCoords[msg.uuid] || 50 },
        data: msg,
        // 🌟 传递高亮状态给自定义节点
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

  // 处理节点点击
  const handleNodeClick = (event, node) => {
    if (onNodeClick) {
      onNodeClick(node.id)
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow 
        nodes={displayNodes} 
        edges={displayEdges} 
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick} // 🌟 绑定点击事件
        nodeTypes={nodeTypes} 
        fitView 
        fitViewOptions={{ padding: 0.2 }} 
        minZoom={0.3} 
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
      
      {/* 提示面板 */}
      <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', color: '#4b5563', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        💡 点击任意节点进行 <code>Checkout</code>，高亮路径为当前上下文。
      </div>
    </div>
  )
}

export default DagView