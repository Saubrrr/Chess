// src/components/CollapsibleMoveTree.tsx
/**
 * Collapsible tree display for chess moves
 * 
 * Shows moves in a file-explorer style with expandable/collapsible variations.
 * Main line stays expanded by default, variations can be toggled.
 */

import { useState, useEffect } from "react"
import { MoveNode } from "@/types/moveTree"

interface CollapsibleMoveTreeProps {
  rootNodes: MoveNode[]
  currentNode: MoveNode | null
  onNavigate: (node: MoveNode) => void
  onContextMenu?: (node: MoveNode, x: number, y: number) => void
  editingComment: { node: MoveNode } | null
  setEditingComment: (state: { node: MoveNode } | null) => void
  setRootNodes: (nodes: MoveNode[]) => void
  onHoverMove?: (node: MoveNode | null) => void
}

/** Count total moves in a line (including all descendants following main line) */
function countMovesInLine(node: MoveNode): number {
  let count = 1
  let current: MoveNode | null = node
  while (current && current.children.length > 0) {
    const mainChild = current.children.find(c => c.isMainLine) || current.children[0]
    count++
    current = mainChild
  }
  return count
}

/** Get a preview of the line (first few moves) */
function getLinePreview(node: MoveNode, maxMoves: number = 3): string {
  const moves: string[] = [node.move.san]
  let current: MoveNode | null = node
  
  while (current.children.length > 0 && moves.length < maxMoves) {
    const next = current.children.find(c => c.isMainLine) || current.children[0]
    moves.push(next.move.san)
    current = next
  }
  
  const hasMore = current.children.length > 0
  return moves.join(" ") + (hasMore ? "..." : "")
}

/** Check if a node is in the path to the current node */
function isInCurrentPath(node: MoveNode, currentNode: MoveNode | null): boolean {
  if (!currentNode) return false
  
  let current: MoveNode | null = currentNode
  while (current) {
    if (current.id === node.id) return true
    current = current.parent
  }
  return false
}

export default function CollapsibleMoveTree({
  rootNodes,
  currentNode,
  onNavigate,
  onContextMenu,
  editingComment,
  setEditingComment,
  setRootNodes,
  onHoverMove
}: CollapsibleMoveTreeProps) {
  // Track which variation nodes are expanded (by a unique key)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  
  // Auto-expand nodes in the path to current node
  useEffect(() => {
    if (currentNode) {
      const keysToExpand = new Set<string>()
      
      // Walk up from current node and find which variations need to be expanded
      let current: MoveNode | null = currentNode
      while (current && current.parent) {
        const parent = current.parent
        // If current is not the main child, it's a variation that needs expanding
        const mainChild = parent.children.find(c => c.isMainLine) || parent.children[0]
        if (current !== mainChild) {
          keysToExpand.add(`${parent.id}-${current.id}`)
        }
        current = parent
      }
      
      // Also check root level variations
      if (currentNode) {
        let root: MoveNode | null = currentNode
        while (root && root.parent) root = root.parent
        
        const mainRoot = rootNodes.find(r => r.isMainLine) || rootNodes[0]
        if (root && root !== mainRoot) {
          keysToExpand.add(`root-${root.id}`)
        }
      }
      
      if (keysToExpand.size > 0) {
        setExpandedNodes(prev => {
          const newSet = new Set(prev)
          keysToExpand.forEach(key => newSet.add(key))
          return newSet
        })
      }
    }
  }, [currentNode, rootNodes])
  
  const toggleExpanded = (key: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }
  
  const expandAll = () => {
    const allKeys = new Set<string>()
    
    const collectKeys = (node: MoveNode) => {
      if (node.children.length > 1) {
        const mainChild = node.children.find(c => c.isMainLine) || node.children[0]
        node.children.forEach(child => {
          if (child !== mainChild) {
            allKeys.add(`${node.id}-${child.id}`)
          }
          collectKeys(child)
        })
      } else if (node.children.length === 1) {
        collectKeys(node.children[0])
      }
    }
    
    // Root level variations
    const mainRoot = rootNodes.find(r => r.isMainLine) || rootNodes[0]
    rootNodes.forEach(root => {
      if (root !== mainRoot) {
        allKeys.add(`root-${root.id}`)
      }
      collectKeys(root)
    })
    
    setExpandedNodes(allKeys)
  }
  
  const collapseAll = () => {
    setExpandedNodes(new Set())
  }
  
  // Render a single move span
  const renderMoveSpan = (
    node: MoveNode,
    moveNumber: number,
    isWhite: boolean,
    showMoveNumber: boolean
  ) => {
    const isCurrentNode = node === currentNode
    const isEditing = editingComment?.node === node
    
    return (
      <span key={node.id} style={{ display: "inline-flex", alignItems: "center", gap: "2px", marginRight: "4px" }}>
        {showMoveNumber && (
          <span style={{ 
            color: "#888", 
            fontSize: "13px", 
            fontWeight: "500",
          }}>
            {isWhite ? `${moveNumber}.` : `${moveNumber}...`}
          </span>
        )}
        <span
          onClick={() => onNavigate(node)}
          onContextMenu={(e) => {
            e.preventDefault()
            onContextMenu?.(node, e.clientX, e.clientY)
          }}
          onMouseEnter={(e) => {
            onHoverMove?.(node)
            if (!isCurrentNode) {
              e.currentTarget.style.backgroundColor = "#e8e8e8"
            }
          }}
          onMouseLeave={(e) => {
            onHoverMove?.(null)
            if (!isCurrentNode) {
              e.currentTarget.style.backgroundColor = "transparent"
            }
          }}
          style={{
            cursor: "pointer",
            padding: "2px 6px",
            backgroundColor: isCurrentNode ? "#4a90e2" : "transparent",
            color: isCurrentNode ? "#fff" : "#333",
            borderRadius: "3px",
            fontSize: "14px",
            fontWeight: isCurrentNode ? "600" : "normal",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          {node.move.san}
        </span>
        
        {/* Comment */}
        {isEditing ? (
          <textarea
            autoFocus
            defaultValue={node.comment || ""}
            onBlur={(e) => {
              const newComment = e.target.value.trim()
              node.comment = newComment || undefined
              setRootNodes([...rootNodes])
              setEditingComment(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setEditingComment(null)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              marginLeft: "4px",
              padding: "2px 4px",
              fontSize: "12px",
              fontFamily: "inherit",
              border: "1px solid #ccc",
              borderRadius: "3px",
              resize: "none",
              minHeight: "18px",
              width: "200px"
            }}
          />
        ) : node.comment ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              setEditingComment({ node })
            }}
            style={{
              marginLeft: "6px",
              fontSize: "12px",
              color: "#666",
              fontStyle: "italic",
              cursor: "text",
            }}
          >
            {node.comment}
          </span>
        ) : null}
      </span>
    )
  }
  
  // Render a variation block (collapsed or expanded)
  const renderVariationBlock = (
    parentId: string,
    variation: MoveNode,
    moveNumber: number,
    isWhite: boolean
  ) => {
    const key = `${parentId}-${variation.id}`
    const isExpanded = expandedNodes.has(key)
    const isInPath = isInCurrentPath(variation, currentNode)
    const moveCount = countMovesInLine(variation)
    
    return (
      <div key={`var-${variation.id}`} style={{ marginLeft: "12px", marginTop: "4px", marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
          {/* Expand/Collapse button */}
          <button
            onClick={() => toggleExpanded(key)}
            style={{
              cursor: "pointer",
              width: "18px",
              height: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              color: "#666",
              backgroundColor: isInPath ? "#e3f2fd" : "#f0f0f0",
              border: "1px solid #ddd",
              borderRadius: "3px",
              flexShrink: 0,
              marginTop: "2px"
            }}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
          
          {isExpanded ? (
            // Expanded: show full line
            <div style={{ 
              flex: 1,
              paddingLeft: "8px",
              borderLeft: `2px solid ${isInPath ? "#4a90e2" : "#ddd"}`,
            }}>
              {renderMoveLine(variation, moveNumber, isWhite)}
            </div>
          ) : (
            // Collapsed: show preview
            <span
              onClick={() => toggleExpanded(key)}
              onMouseEnter={() => onHoverMove?.(variation)}
              onMouseLeave={() => onHoverMove?.(null)}
              style={{
                cursor: "pointer",
                fontSize: "13px",
                color: "#666",
                padding: "2px 8px",
                backgroundColor: isInPath ? "#e3f2fd" : "#f5f5f5",
                borderRadius: "3px",
                fontFamily: "'Segoe UI', system-ui, sans-serif",
              }}
            >
              {isWhite ? `${moveNumber}.` : `${moveNumber}...`} {getLinePreview(variation)} 
              <span style={{ color: "#999", marginLeft: "6px" }}>
                ({moveCount} {moveCount === 1 ? "move" : "moves"})
              </span>
            </span>
          )}
        </div>
      </div>
    )
  }
  
  // Render a line of moves with inline variations
  const renderMoveLine = (
    startNode: MoveNode,
    startMoveNumber: number,
    startIsWhite: boolean
  ): JSX.Element => {
    const elements: JSX.Element[] = []
    let current: MoveNode | null = startNode
    let moveNumber = startMoveNumber
    let isWhite = startIsWhite
    let isFirst = true
    
    while (current) {
      // Render current move
      elements.push(renderMoveSpan(current, moveNumber, isWhite, isFirst || isWhite))
      
      const nextMoveNumber = !isWhite ? moveNumber + 1 : moveNumber
      const nextIsWhite = !isWhite
      
      // Check for variations
      if (current.children.length > 1) {
        const mainChild = current.children.find(c => c.isMainLine) || current.children[0]
        const variations = current.children.filter(c => c !== mainChild)
        
        // Render each variation block
        const parentId = current.id
        variations.forEach((variation) => {
          elements.push(renderVariationBlock(parentId, variation, nextMoveNumber, nextIsWhite))
        })
        
        // Continue with main line
        current = mainChild
        moveNumber = nextMoveNumber
        isWhite = nextIsWhite
      } else if (current.children.length === 1) {
        // Single continuation
        current = current.children[0]
        moveNumber = nextMoveNumber
        isWhite = nextIsWhite
      } else {
        // End of line
        current = null
      }
      
      isFirst = false
    }
    
    return <>{elements}</>
  }
  
  if (rootNodes.length === 0) {
    return (
      <div style={{ color: "#999", fontSize: "14px", padding: "8px" }}>
        No moves yet. Play a move on the board to start.
      </div>
    )
  }
  
  // Find main root and alternative roots
  const mainRoot = rootNodes.find(r => r.isMainLine) || rootNodes[0]
  const alternativeRoots = rootNodes.filter(r => r !== mainRoot)
  
  return (
    <div style={{ fontSize: "14px" }}>
      {/* Controls */}
      <div style={{ 
        display: "flex", 
        gap: "8px", 
        marginBottom: "12px",
        paddingBottom: "8px",
        borderBottom: "1px solid #eee"
      }}>
        <button
          onClick={expandAll}
          style={{
            padding: "4px 12px",
            fontSize: "12px",
            backgroundColor: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "3px",
            cursor: "pointer"
          }}
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          style={{
            padding: "4px 12px",
            fontSize: "12px",
            backgroundColor: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "3px",
            cursor: "pointer"
          }}
        >
          Collapse All
        </button>
      </div>
      
      {/* Main line */}
      <div style={{ lineHeight: "2.0" }}>
        {renderMoveLine(mainRoot, 1, true)}
        
        {/* Alternative first moves (root-level variations) */}
        {alternativeRoots.map(altRoot => 
          renderVariationBlock("root", altRoot, 1, true)
        )}
      </div>
    </div>
  )
}