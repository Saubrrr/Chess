// src/types/arrows.ts
/**
 * Arrow and highlight annotations for chess positions
 * 
 * Arrows and highlights are stored per-position using a normalized FEN key
 * (just the piece placement + turn, ignoring castling/en passant/move counts
 * for more flexible matching)
 */

import { Square } from "chess.js"

/** Arrow drawn on the board */
export interface Arrow {
  from: Square
  to: Square
  color: ArrowColor
}

/** Circle/highlight on a square */
export interface Highlight {
  square: Square
  color: ArrowColor
}

/** Available arrow/highlight colors (matches Lichess conventions) */
export type ArrowColor = "green" | "red" | "blue" | "yellow"

/** All annotations for a position */
export interface PositionAnnotations {
  arrows: Arrow[]
  highlights: Highlight[]
}

/**
 * Get a normalized position key from a FEN string.
 * Uses piece placement + turn only, so annotations persist
 * even if castling rights or move counts differ.
 */
export function getPositionKey(fen: string): string {
  const parts = fen.split(" ")
  // Use piece placement (part 0) and turn (part 1)
  return `${parts[0]} ${parts[1]}`
}

/**
 * Create an empty annotations object
 */
export function createEmptyAnnotations(): PositionAnnotations {
  return {
    arrows: [],
    highlights: []
  }
}

/**
 * Check if two arrows are equal
 */
export function arrowsEqual(a: Arrow, b: Arrow): boolean {
  return a.from === b.from && a.to === b.to && a.color === b.color
}

/**
 * Check if two highlights are equal
 */
export function highlightsEqual(a: Highlight, b: Highlight): boolean {
  return a.square === b.square && a.color === b.color
}

/**
 * Toggle an arrow in an annotations object.
 * If the exact arrow exists, remove it. Otherwise, add it.
 * Returns a new annotations object.
 */
export function toggleArrow(
  annotations: PositionAnnotations,
  arrow: Arrow
): PositionAnnotations {
  const existingIndex = annotations.arrows.findIndex(a => arrowsEqual(a, arrow))
  
  if (existingIndex !== -1) {
    // Remove existing arrow
    return {
      ...annotations,
      arrows: annotations.arrows.filter((_, i) => i !== existingIndex)
    }
  } else {
    // Add new arrow
    return {
      ...annotations,
      arrows: [...annotations.arrows, arrow]
    }
  }
}

/**
 * Toggle a highlight in an annotations object.
 * If the exact highlight exists, remove it. Otherwise, add it.
 * Returns a new annotations object.
 */
export function toggleHighlight(
  annotations: PositionAnnotations,
  highlight: Highlight
): PositionAnnotations {
  const existingIndex = annotations.highlights.findIndex(h => highlightsEqual(h, highlight))
  
  if (existingIndex !== -1) {
    // Remove existing highlight
    return {
      ...annotations,
      highlights: annotations.highlights.filter((_, i) => i !== existingIndex)
    }
  } else {
    // Add new highlight
    return {
      ...annotations,
      highlights: [...annotations.highlights, highlight]
    }
  }
}

/**
 * Clear all annotations for a position
 */
export function clearAnnotations(): PositionAnnotations {
  return createEmptyAnnotations()
}

/**
 * Get color code for arrow/highlight rendering
 */
export function getColorCode(color: ArrowColor): string {
  switch (color) {
    case "green": return "rgba(21, 120, 27, 0.8)"
    case "red": return "rgba(200, 40, 40, 0.8)"
    case "blue": return "rgba(40, 80, 200, 0.8)"
    case "yellow": return "rgba(200, 180, 40, 0.8)"
    default: return "rgba(21, 120, 27, 0.8)"
  }
}

/**
 * Get highlight color (more transparent than arrows)
 */
export function getHighlightColor(color: ArrowColor): string {
  switch (color) {
    case "green": return "rgba(21, 120, 27, 0.5)"
    case "red": return "rgba(200, 40, 40, 0.5)"
    case "blue": return "rgba(40, 80, 200, 0.5)"
    case "yellow": return "rgba(200, 180, 40, 0.5)"
    default: return "rgba(21, 120, 27, 0.5)"
  }
}