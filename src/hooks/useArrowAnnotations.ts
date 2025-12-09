// src/hooks/useArrowAnnotations.ts
/**
 * Hook to manage arrow and highlight annotations across positions
 * 
 * Stores annotations in a Map keyed by normalized position (FEN).
 * When navigating between positions, the annotations for that position
 * are automatically retrieved.
 */

import { useState, useCallback, useMemo } from "react"
import { Square } from "chess.js"
import {
  Arrow,
  Highlight,
  ArrowColor,
  PositionAnnotations,
  getPositionKey,
  createEmptyAnnotations,
  toggleArrow,
  toggleHighlight
} from "@/types/arrows"

interface UseArrowAnnotationsReturn {
  /** Current arrows for the active position */
  arrows: Arrow[]
  /** Current highlights for the active position */
  highlights: Highlight[]
  /** Add or toggle an arrow at the current position */
  addArrow: (from: Square, to: Square, color?: ArrowColor) => void
  /** Add or toggle a highlight at the current position */
  addHighlight: (square: Square, color?: ArrowColor) => void
  /** Clear all annotations at the current position */
  clearCurrentAnnotations: () => void
  /** Clear all annotations across all positions */
  clearAllAnnotations: () => void
  /** Set the current position FEN (call this when navigating) */
  setCurrentFen: (fen: string) => void
  /** Get all stored annotations (for persistence) */
  getAllAnnotations: () => Map<string, PositionAnnotations>
  /** Load annotations from storage */
  loadAnnotations: (data: Map<string, PositionAnnotations> | Record<string, PositionAnnotations>) => void
}

export function useArrowAnnotations(initialFen?: string): UseArrowAnnotationsReturn {
  // Store all annotations keyed by position
  const [annotationsMap, setAnnotationsMap] = useState<Map<string, PositionAnnotations>>(
    () => new Map()
  )
  
  // Track current position
  const [currentFen, setCurrentFenState] = useState<string>(
    initialFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  )
  
  // Get the position key for current FEN
  const currentKey = useMemo(() => getPositionKey(currentFen), [currentFen])
  
  // Get current annotations
  const currentAnnotations = useMemo(() => {
    return annotationsMap.get(currentKey) || createEmptyAnnotations()
  }, [annotationsMap, currentKey])
  
  // Update annotations for a specific position
  const updateAnnotations = useCallback((key: string, annotations: PositionAnnotations) => {
    setAnnotationsMap(prev => {
      const newMap = new Map(prev)
      if (annotations.arrows.length === 0 && annotations.highlights.length === 0) {
        // Remove empty entries to save memory
        newMap.delete(key)
      } else {
        newMap.set(key, annotations)
      }
      return newMap
    })
  }, [])
  
  // Add or toggle an arrow
  const addArrow = useCallback((from: Square, to: Square, color: ArrowColor = "green") => {
    const arrow: Arrow = { from, to, color }
    const newAnnotations = toggleArrow(currentAnnotations, arrow)
    updateAnnotations(currentKey, newAnnotations)
  }, [currentAnnotations, currentKey, updateAnnotations])
  
  // Add or toggle a highlight
  const addHighlight = useCallback((square: Square, color: ArrowColor = "green") => {
    const highlight: Highlight = { square, color }
    const newAnnotations = toggleHighlight(currentAnnotations, highlight)
    updateAnnotations(currentKey, newAnnotations)
  }, [currentAnnotations, currentKey, updateAnnotations])
  
  // Clear annotations for current position
  const clearCurrentAnnotations = useCallback(() => {
    updateAnnotations(currentKey, createEmptyAnnotations())
  }, [currentKey, updateAnnotations])
  
  // Clear all annotations
  const clearAllAnnotations = useCallback(() => {
    setAnnotationsMap(new Map())
  }, [])
  
  // Set current FEN (for navigation)
  const setCurrentFen = useCallback((fen: string) => {
    setCurrentFenState(fen)
  }, [])
  
  // Get all annotations for persistence
  const getAllAnnotations = useCallback(() => {
    return new Map(annotationsMap)
  }, [annotationsMap])
  
  // Load annotations from storage
  const loadAnnotations = useCallback((data: Map<string, PositionAnnotations> | Record<string, PositionAnnotations>) => {
    if (data instanceof Map) {
      setAnnotationsMap(new Map(data))
    } else {
      // Convert object to Map
      const map = new Map<string, PositionAnnotations>()
      for (const [key, value] of Object.entries(data)) {
        map.set(key, value)
      }
      setAnnotationsMap(map)
    }
  }, [])
  
  return {
    arrows: currentAnnotations.arrows,
    highlights: currentAnnotations.highlights,
    addArrow,
    addHighlight,
    clearCurrentAnnotations,
    clearAllAnnotations,
    setCurrentFen,
    getAllAnnotations,
    loadAnnotations
  }
}