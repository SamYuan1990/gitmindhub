import React, { useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, Handle, Position } from 'reactflow'
import 'reactflow/dist/style.css'

// 自定义 Commit 节点 (保持与之前一致，稍作简化)
const CommitNode = ({ data, selected }) => {
  const [expanded, setExpanded] = React.useState(false)
  const isUser = data.role === 'user'
  const branch = data.branch || 'main'
  
  const colors = {
    'main': { bg: '#ffffff', border: '#374151', text: '#111827' },
    'feature/git-history': { bg: '#fffbeb', border: '#f59e0b', text: '#78350f' },
    'experiment/electron': { bg: '#ecfdf5', border: '#10b981', text: '#064e3b' }
  }[branch] || { bg: '#ffffff', border: '#d1d5db', text: '#1f2937' }

  return (
    <div onClick={() => setExpanded(!expanded)} style={{
      padding: expanded ? '14px 16px' : '10px 14px', borderRadius: '8px', background: colors.bg,
      border: `2px solid ${selected ? '#3b82f6' : colors.border}`,
      boxShadow: selected ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 4px 6px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
      cursor: 'pointer', minWidth: '200px', maxWidth: '260px', transition: 'all 0.2s', fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
        <span style={{ fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>{isUser ? '👤 User' : '🤖 AI'}</span>
        <code style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{data.id.substring(0, 6)}</code>
      </div>
      <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: colors.text, overflow: expanded ? 'visible' : 'hidden', textOverflow: expanded ? 'clip' : 'ellipsis', display: expanded ? 'block' : '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2, WebkitBoxOrient: 'vertical' }}>
        {data.content}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: colors.border, color: '#ffffff', fontWeight: '600' }}>{branch}</span>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{data.timestamp}</span>
      </div>
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: '8px', height: '8px' }} />
    </div>
  )
}

const nodeTypes = { commit: CommitNode }

function DagView({ messages = [] }) {
  // 动态将 messages 转换为 React Flow 的 nodes 和 edges
  const { nodes, edges, stats } = useMemo(() => {
    const flowNodes = []
    const flowEdges = []
    const branches = new Set()
    
    // 简单的树状布局算法
    let currentY = 50
    const nodePositions = new Map()

    messages.forEach((msg) => {
      branches.add(msg.branch || 'main')
      
      // 布局逻辑：主干居中，特定分支左右偏移
      let offsetX = 0
      if (msg.branch === 'feature/git-history') offsetX = 280
      if (msg.branch === 'experiment/electron') offsetX = -280
      
      const x = 300 + offsetX
      const y = currentY
      currentY += 140 // 节点垂直间距

      nodePositions.set(msg.id, { x, y })

      flowNodes.push({
        id: msg.id,
        type: 'commit',
        position: { x, y },
        data: msg
      })

      if (msg.parentId && nodePositions.has(msg.parentId)) {
        const isBranch = msg.branch !== 'main'
        flowEdges.push({
          id: `e-${msg.parentId}-${msg.id}`,
          source: msg.parentId,
          target: msg.id,
          type: 'smoothstep',
          animated: isBranch,
          style: { 
            stroke: isBranch ? (msg.branch === 'feature/git-history' ? '#f59e0b' : '#10b981') : '#9ca3af', 
            strokeWidth: isBranch ? 2 : 1 
          },
          label: isBranch ? 'fork' : undefined
        })
      }
    })

    return {
      nodes: flowNodes,
      edges: flowEdges,
      stats: { total: messages.length, branches: Array.from(branches) }
    }
  }, [messages])

  const [displayNodes, setNodes, onNodesChange] = useNodesState(nodes)
  const [displayEdges, setEdges, onEdgesChange] = useEdgesState(edges)

  // 当 messages 变化时，更新 flow 数据
  React.useEffect(() => {
    setNodes(nodes)
    setEdges(edges)
  }, [nodes, edges, setNodes, setEdges])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, background: 'rgba(255, 255, 255, 0.95)', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '0.85rem', backdropFilter: 'blur(8px)' }}>
        <div style={{ fontWeight: '700', marginBottom: '6px', color: '#111827' }}>📊 对话图谱统计</div>
        <div style={{ color: '#6b7280', lineHeight: '1.6' }}>
          <div>总节点数: <strong style={{ color: '#3b82f6' }}>{stats.total}</strong></div>
          <div>分支数: <strong style={{ color: '#3b82f6' }}>{stats.branches.length}</strong></div>
          <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {stats.branches.map(b => (
              <span key={b} style={{ padding: '2px 6px', borderRadius: '4px', background: b === 'main' ? '#374151' : b === 'feature/git-history' ? '#f59e0b' : '#10b981', color: '#fff', fontSize: '0.7rem' }}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      <ReactFlow nodes={displayNodes} edges={displayEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.3} maxZoom={1.5} proOptions={{ hideAttribution: true }}>
        <Background color="#e5e7eb" gap={20} />
        <Controls style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
        <MiniMap style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} nodeColor={(node) => node.data.branch === 'main' ? '#374151' : node.data.branch === 'feature/git-history' ? '#f59e0b' : '#10b981'} maskColor="rgba(249, 250, 251, 0.7)" />
      </ReactFlow>
    </div>
  )
}

export default DagView