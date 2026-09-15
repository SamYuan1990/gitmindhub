import React, { useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from 'reactflow'
import 'reactflow/dist/style.css'

// ================= Mock 数据：一个有分支的对话树 =================
// 结构设计：
// - 主干 (main): root -> n1 -> n2 -> n3 -> n4
// - 右侧分支 (feature/git-history): 从 n2 派生 -> b1 -> b2
// - 左侧分支 (experiment/electron): 从 n3 派生 -> c1 -> c2

const initialNodes = [
  // 主干 (main branch)
  {
    id: 'root', type: 'commit', position: { x: 300, y: 50 },
    data: { role: 'assistant', content: '欢迎使用 GitMindHub！这是一个支持 Git 风格上下文管理的 AI 对话工具。', branch: 'main', hash: 'a1b2c3d', timestamp: '10:00 AM', isRoot: true }
  },
  {
    id: 'n1', type: 'commit', position: { x: 300, y: 180 },
    data: { role: 'user', content: '如何设计一个 DAG 数据结构来表示对话历史？', branch: 'main', hash: 'e4f5g6h', timestamp: '10:01 AM' }
  },
  {
    id: 'n2', type: 'commit', position: { x: 300, y: 310 },
    data: { role: 'assistant', content: '推荐使用邻接表，或者包含 parent_id 的节点对象数组。每个节点保存完整的 Context 快照，边表示状态转移。', branch: 'main', hash: 'i7j8k9l', timestamp: '10:02 AM' }
  },
  {
    id: 'n3', type: 'commit', position: { x: 300, y: 440 },
    data: { role: 'user', content: '那 React Flow 这个库怎么用？', branch: 'main', hash: 'm0n1o2p', timestamp: '10:05 AM' }
  },
  {
    id: 'n4', type: 'commit', position: { x: 300, y: 570 },
    data: { role: 'assistant', content: '安装 reactflow，定义 nodes 和 edges 数组，然后用 <ReactFlow /> 组件渲染。支持自定义节点、边、小地图等。', branch: 'main', hash: 'q3r4s5t', timestamp: '10:06 AM' }
  },

  // 右侧分支：从 n2 派生 (feature/git-history)
  {
    id: 'b1', type: 'commit', position: { x: 580, y: 440 },
    data: { role: 'user', content: '换个话题，聊聊 Git 的历史吧', branch: 'feature/git-history', hash: 'u6v7w8x', timestamp: '10:10 AM' }
  },
  {
    id: 'b2', type: 'commit', position: { x: 580, y: 570 },
    data: { role: 'assistant', content: 'Git 由 Linus Torvalds 在 2005 年创建，最初是为了管理 Linux 内核开发。它的设计灵感来自 BitKeeper。', branch: 'feature/git-history', hash: 'y9z0a1b', timestamp: '10:11 AM' }
  },

  // 左侧分支：从 n3 派生 (experiment/electron)
  {
    id: 'c1', type: 'commit', position: { x: 20, y: 570 },
    data: { role: 'user', content: '其实我想问 Electron 的 IPC 通信安全吗？', branch: 'experiment/electron', hash: 'c2d3e4f', timestamp: '10:08 AM' }
  },
  {
    id: 'c2', type: 'commit', position: { x: 20, y: 700 },
    data: { role: 'assistant', content: '只要开启 contextIsolation 并使用 preload.js 暴露白名单 API，就是非常安全的。绝对不要开启 nodeIntegration。', branch: 'experiment/electron', hash: 'g5h6i7j', timestamp: '10:09 AM' }
  }
]

const initialEdges = [
  // 主干边
  { id: 'e-root-n1', source: 'root', target: 'n1', type: 'smoothstep', animated: false },
  { id: 'e-n1-n2', source: 'n1', target: 'n2', type: 'smoothstep' },
  { id: 'e-n2-n3', source: 'n2', target: 'n3', type: 'smoothstep' },
  { id: 'e-n3-n4', source: 'n3', target: 'n4', type: 'smoothstep' },

  // 右侧分支边 (从 n2 派生)
  { id: 'e-n2-b1', source: 'n2', target: 'b1', type: 'smoothstep', style: { stroke: '#f59e0b', strokeWidth: 2 }, animated: true, label: 'fork' },
  { id: 'e-b1-b2', source: 'b1', target: 'b2', type: 'smoothstep', style: { stroke: '#f59e0b', strokeWidth: 2 } },

  // 左侧分支边 (从 n3 派生)
  { id: 'e-n3-c1', source: 'n3', target: 'c1', type: 'smoothstep', style: { stroke: '#10b981', strokeWidth: 2 }, animated: true, label: 'fork' },
  { id: 'e-c1-c2', source: 'c1', target: 'c2', type: 'smoothstep', style: { stroke: '#10b981', strokeWidth: 2 } }
]

// ================= 自定义 Commit 节点 =================
const CommitNode = ({ data, selected }) => {
  const [expanded, setExpanded] = useState(false)
  const isUser = data.role === 'user'

  // 根据分支分配颜色
  const branchColors = {
    'main': { bg: '#ffffff', border: '#374151', text: '#111827' },
    'feature/git-history': { bg: '#fffbeb', border: '#f59e0b', text: '#78350f' },
    'experiment/electron': { bg: '#ecfdf5', border: '#10b981', text: '#064e3b' }
  }
  const colors = branchColors[data.branch] || branchColors.main

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: expanded ? '14px 16px' : '10px 14px',
        borderRadius: '8px',
        background: colors.bg,
        border: `2px solid ${selected ? '#3b82f6' : colors.border}`,
        boxShadow: selected
          ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 4px 6px rgba(0,0,0,0.1)'
          : '0 2px 4px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        minWidth: '220px',
        maxWidth: '280px',
        transition: 'all 0.2s',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      {/* 顶部：角色 + Hash + 时间 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.9rem' }}>{isUser ? '👤' : '🤖'}</span>
          <span style={{ fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>{data.role}</span>
        </div>
        <code style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9ca3af' }}>{data.hash}</code>
      </div>

      {/* 内容 */}
      <div style={{
        fontSize: '0.85rem',
        lineHeight: '1.5',
        color: colors.text,
        overflow: expanded ? 'visible' : 'hidden',
        textOverflow: expanded ? 'clip' : 'ellipsis',
        display: expanded ? 'block' : '-webkit-box',
        WebkitLineClamp: expanded ? 'unset' : 2,
        WebkitBoxOrient: 'vertical',
        whiteSpace: expanded ? 'normal' : 'normal'
      }}>
        {data.content}
      </div>

      {/* 底部：分支标签 + 时间 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
        <span style={{
          fontSize: '0.7rem',
          padding: '2px 8px',
          borderRadius: '10px',
          background: colors.border,
          color: '#ffffff',
          fontWeight: '600'
        }}>
          {data.isRoot && '�� '}{data.branch}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{data.timestamp}</span>
      </div>

      {/* React Flow 连接点 */}
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: '8px', height: '8px' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: '8px', height: '8px' }} />
    </div>
  )
}

const nodeTypes = { commit: CommitNode }

// ================= 主组件 =================
function DagView() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // 统计信息
  const stats = useMemo(() => {
    const branches = new Set(nodes.map(n => n.data.branch))
    return {
      totalCommits: nodes.length,
      totalBranches: branches.size,
      branches: Array.from(branches)
    }
  }, [nodes])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 顶部信息栏 */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontSize: '0.85rem',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ fontWeight: '700', marginBottom: '6px', color: '#111827' }}>📊 对话图谱统计</div>
        <div style={{ color: '#6b7280', lineHeight: '1.6' }}>
          <div>总提交数: <strong style={{ color: '#3b82f6' }}>{stats.totalCommits}</strong></div>
          <div>分支数: <strong style={{ color: '#3b82f6' }}>{stats.totalBranches}</strong></div>
          <div style={{ marginTop: '6px', fontSize: '0.75rem' }}>
            {stats.branches.map(b => (
              <span key={b} style={{
                display: 'inline-block',
                padding: '2px 6px',
                marginRight: '4px',
                borderRadius: '4px',
                background: b === 'main' ? '#374151' : b === 'feature/git-history' ? '#f59e0b' : '#10b981',
                color: '#fff',
                fontSize: '0.7rem'
              }}>{b}</span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#9ca3af', fontStyle: 'italic' }}>
          💡 点击节点展开完整内容
        </div>
      </div>

      {/* React Flow 画布 */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
        <MiniMap
          style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          nodeColor={(node) => {
            const branch = node.data.branch
            if (branch === 'main') return '#374151'
            if (branch === 'feature/git-history') return '#f59e0b'
            if (branch === 'experiment/electron') return '#10b981'
            return '#9ca3af'
          }}
          maskColor="rgba(249, 250, 251, 0.7)"
        />
      </ReactFlow>
    </div>
  )
}

export default DagView
