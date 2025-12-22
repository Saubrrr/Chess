import { MoveNode } from "@/types/moveTree"
import { StudyLine, StudyConfiguration } from "@/types/studyConfig"
import { Chapter } from "@/types/study"
import { Chess } from "chess.js"

/**
 * Extract all lines (complete paths from root to leaf) from a chapter's move tree
 */
export function extractLinesFromChapter(
  chapter: Chapter,
  orientation: "white" | "black"
): StudyLine[] {
  const lines: StudyLine[] = []
  
  if (!chapter.game.rootNodes || chapter.game.rootNodes.length === 0) {
    return lines
  }

  // Recursively traverse the tree to find all complete lines
  function traverseToLeaves(
    node: MoveNode,
    pathSoFar: MoveNode[],
    depth: number
  ) {
    const currentPath = [...pathSoFar, node]
    
    if (node.children.length === 0) {
      // This is a leaf node - create a StudyLine
      lines.push({
        id: `${chapter.id}_${node.id}_${Date.now()}_${Math.random()}`,
        chapterId: chapter.id,
        chapterName: chapter.name,
        path: currentPath,
        orientation: chapter.orientation || orientation,
        isEnabled: true,
        depth: depth,
        tags: []
      })
    } else {
      // Continue traversing all children
      for (const child of node.children) {
        traverseToLeaves(child, currentPath, depth + 1)
      }
    }
  }

  // Start from each root node
  for (const root of chapter.game.rootNodes) {
    traverseToLeaves(root, [], 1)
  }

  return lines
}

/**
 * Get all lines from multiple chapters
 */
export function extractLinesFromChapters(
  chapters: Chapter[],
  defaultOrientation: "white" | "black" = "white"
): StudyLine[] {
  const allLines: StudyLine[] = []
  
  for (const chapter of chapters) {
    const chapterLines = extractLinesFromChapter(
      chapter,
      chapter.orientation || defaultOrientation
    )
    allLines.push(...chapterLines)
  }
  
  return allLines
}

/**
 * Filter lines based on configuration
 */
export function filterLines(
  lines: StudyLine[],
  config: {
    maxDepth?: number
    onlyEnabled?: boolean
    tags?: string[]
  }
): StudyLine[] {
  let filtered = lines

  if (config.onlyEnabled) {
    filtered = filtered.filter(line => line.isEnabled)
  }

  if (config.maxDepth !== undefined) {
    filtered = filtered.filter(line => line.depth <= config.maxDepth)
  }

  if (config.tags && config.tags.length > 0) {
    filtered = filtered.filter(line =>
      config.tags!.some(tag => line.tags.includes(tag))
    )
  }

  return filtered
}

/**
 * Get moves that the user should be quizzed on in a line
 * If onlyMySide is true, only return moves for the user's color
 */
export function getQuizMoves(
  line: StudyLine,
  onlyMySide: boolean
): { moveIndex: number; node: MoveNode }[] {
  const quizMoves: { moveIndex: number; node: MoveNode }[] = []
  
  // Determine which color the user is playing
  const userColor = line.orientation === "white" ? "w" : "b"
  
  for (let i = 0; i < line.path.length; i++) {
    const node = line.path[i]
    
    // The move's color is stored in node.move.color
    if (!onlyMySide || node.move.color === userColor) {
      quizMoves.push({ moveIndex: i, node })
    }
  }
  
  return quizMoves
}

/**
 * Get the FEN position before a specific move in a line
 */
export function getFenBeforeMove(
  line: StudyLine,
  moveIndex: number,
  initialFen: string
): string {
  if (moveIndex === 0) {
    return initialFen
  }
  
  // The FEN before move N is stored in the node at position N-1
  return line.path[moveIndex - 1].fen
}

/**
 * Shuffle an array (Fisher-Yates shuffle)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Check if a user's move matches the expected move
 */
export function isCorrectMove(
  userMove: { from: string; to: string; promotion?: string },
  expectedMove: MoveNode
): boolean {
  return (
    userMove.from === expectedMove.move.from &&
    userMove.to === expectedMove.move.to &&
    (userMove.promotion || undefined) === expectedMove.move.promotion
  )
}

/**
 * Get a preview string for a line (e.g., "1. e4 e5 2. Nf3 Nc6...")
 */
export function getLinePreview(line: StudyLine, maxMoves: number = 6): string {
  const moves: string[] = []
  let moveNumber = 1
  let isWhiteTurn = true
  
  for (let i = 0; i < Math.min(line.path.length, maxMoves); i++) {
    const node = line.path[i]
    const san = node.move.san
    
    if (isWhiteTurn) {
      moves.push(`${moveNumber}. ${san}`)
    } else {
      moves.push(san)
      moveNumber++
    }
    
    isWhiteTurn = !isWhiteTurn
  }
  
  let preview = moves.join(" ")
  if (line.path.length > maxMoves) {
    preview += "..."
  }
  
  return preview
}

/**
 * Count the total number of moves the user will be quizzed on
 */
export function countQuizMoves(lines: StudyLine[], onlyMySide: boolean): number {
  let total = 0
  for (const line of lines) {
    total += getQuizMoves(line, onlyMySide).length
  }
  return total
}


