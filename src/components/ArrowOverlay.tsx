// src/components/ArrowOverlay.tsx
/**
 * SVG overlay for rendering arrows and highlights on the chess board
 * 
 * This component renders on top of the board squares but below the pieces
 * (or can be above pieces if needed).
 * 
 * extra random comments bc my github buggin
 * blablablalbalbbla
 * teesting mroe
 * wdawdawd
 */

import { Square } from "chess.js"
import { Arrow, Highlight, getColorCode, getHighlightColor } from "@/types/arrows"

interface ArrowOverlayProps {
  /** Array of arrows to render */
  arrows: Arrow[]
  /** Array of highlights to render */
  highlights: Highlight[]
  /** Board size in pixels */
  boardSize: number
  /** Board orientation */
  orientation: "white" | "black"
  /** Arrow being drawn (preview) */
  drawingArrow?: { from: Square; to: Square } | null
  /** Color for the drawing arrow */
  drawingColor?: string
}

const files = ["a", "b", "c", "d", "e", "f", "g", "h"]
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"]

/**
 * Convert a square to x,y coordinates (center of square)
 */
function squareToCoords(
  square: Square,
  boardSize: number,
  orientation: "white" | "black"
): { x: number; y: number } {
  const squareSize = boardSize / 8
  const file = square[0]
  const rank = square[1]
  
  let fileIndex = files.indexOf(file)
  let rankIndex = ranks.indexOf(rank)
  
  // Flip for black orientation
  if (orientation === "black") {
    fileIndex = 7 - fileIndex
    rankIndex = 7 - rankIndex
  }
  
  return {
    x: fileIndex * squareSize + squareSize / 2,
    y: rankIndex * squareSize + squareSize / 2
  }
}

/**
 * Calculate arrow head points
 */
function getArrowHeadPoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  headLength: number,
  headWidth: number
): string {
  const angle = Math.atan2(toY - fromY, toX - fromX)
  
  // Arrow head tip is at (toX, toY)
  // Calculate the two base points of the arrow head
  const baseX = toX - headLength * Math.cos(angle)
  const baseY = toY - headLength * Math.sin(angle)
  
  const leftX = baseX - headWidth * Math.cos(angle - Math.PI / 2)
  const leftY = baseY - headWidth * Math.sin(angle - Math.PI / 2)
  
  const rightX = baseX - headWidth * Math.cos(angle + Math.PI / 2)
  const rightY = baseY - headWidth * Math.sin(angle + Math.PI / 2)
  
  return `${toX},${toY} ${leftX},${leftY} ${rightX},${rightY}`
}

export default function ArrowOverlay({
  arrows,
  highlights,
  boardSize,
  orientation,
  drawingArrow,
  drawingColor = "rgba(21, 120, 27, 0.8)"
}: ArrowOverlayProps) {
  const squareSize = boardSize / 8
  const arrowWidth = squareSize * 0.2
  const headLength = squareSize * 0.35
  const headWidth = squareSize * 0.25
  
  return (
    <svg
      width={boardSize}
      height={boardSize}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 10
      }}
    >
      {/* Render highlights first (below arrows) */}
      {highlights.map((highlight, index) => {
        const coords = squareToCoords(highlight.square, boardSize, orientation)
        const color = getHighlightColor(highlight.color)
        
        return (
          <rect
            key={`highlight-${index}-${highlight.square}`}
            x={coords.x - squareSize / 2}
            y={coords.y - squareSize / 2}
            width={squareSize}
            height={squareSize}
            fill={color}
          />
        )
      })}
      
      {/* Render arrows */}
      {arrows.map((arrow, index) => {
        const from = squareToCoords(arrow.from, boardSize, orientation)
        const to = squareToCoords(arrow.to, boardSize, orientation)
        const color = getColorCode(arrow.color)
        
        // Shorten the line so it doesn't overlap with the arrow head
        const angle = Math.atan2(to.y - from.y, to.x - from.x)
        const shortenedToX = to.x - (headLength * 0.7) * Math.cos(angle)
        const shortenedToY = to.y - (headLength * 0.7) * Math.sin(angle)
        
        // Also shorten from the start so it doesn't cover piece
        const shortenedFromX = from.x + (squareSize * 0.2) * Math.cos(angle)
        const shortenedFromY = from.y + (squareSize * 0.2) * Math.sin(angle)
        
        return (
          <g key={`arrow-${index}-${arrow.from}-${arrow.to}`}>
            {/* Arrow line */}
            <line
              x1={shortenedFromX}
              y1={shortenedFromY}
              x2={shortenedToX}
              y2={shortenedToY}
              stroke={color}
              strokeWidth={arrowWidth}
              strokeLinecap="round"
            />
            {/* Arrow head */}
            <polygon
              points={getArrowHeadPoints(from.x, from.y, to.x, to.y, headLength, headWidth)}
              fill={color}
            />
          </g>
        )
      })}
      
      {/* Render drawing preview arrow */}
      {drawingArrow && drawingArrow.from !== drawingArrow.to && (
        (() => {
          const from = squareToCoords(drawingArrow.from, boardSize, orientation)
          const to = squareToCoords(drawingArrow.to, boardSize, orientation)
          
          const angle = Math.atan2(to.y - from.y, to.x - from.x)
          const shortenedToX = to.x - (headLength * 0.7) * Math.cos(angle)
          const shortenedToY = to.y - (headLength * 0.7) * Math.sin(angle)
          const shortenedFromX = from.x + (squareSize * 0.2) * Math.cos(angle)
          const shortenedFromY = from.y + (squareSize * 0.2) * Math.sin(angle)
          
          return (
            <g style={{ opacity: 0.7 }}>
              <line
                x1={shortenedFromX}
                y1={shortenedFromY}
                x2={shortenedToX}
                y2={shortenedToY}
                stroke={drawingColor}
                strokeWidth={arrowWidth}
                strokeLinecap="round"
              />
              <polygon
                points={getArrowHeadPoints(from.x, from.y, to.x, to.y, headLength, headWidth)}
                fill={drawingColor}
              />
            </g>
          )
        })()
      )}
    </svg>
  )
}