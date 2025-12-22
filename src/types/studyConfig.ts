import { MoveNode } from "./moveTree"

// Represents a specific line/variation in the study
export interface StudyLine {
  id: string
  chapterId: string
  chapterName: string
  path: MoveNode[] // The sequence of moves in this line
  orientation: "white" | "black" // Which side the user is playing
  isEnabled: boolean // Whether this line is included in the study
  depth: number // How many moves deep this line goes
  tags: string[] // User-defined tags for categorization
}

// Configuration for a study session
export interface StudyConfiguration {
  studyId: string
  studyName: string
  selectedChapters: string[] // Chapter IDs to include
  lines: StudyLine[] // All available lines from selected chapters
  maxDepth?: number // Optional: limit how deep to study
  onlyMySide: boolean // Only quiz moves for the user's side
}

// Progress tracking for a study session
export interface StudySessionProgress {
  totalLines: number
  completedLines: number
  correctMoves: number
  incorrectMoves: number
  currentLineIndex: number
}

// Represents the current state in a study session
export interface StudySessionState {
  configuration: StudyConfiguration
  progress: StudySessionProgress
  currentLine: StudyLine | null
  currentMoveIndex: number // Which move in the line we're testing
  waitingForUserMove: boolean
  lastResult: "correct" | "incorrect" | null
}


