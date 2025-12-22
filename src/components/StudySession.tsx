import { useState, useEffect, useCallback } from "react"
import { Chess } from "chess.js"
import { StudyConfiguration, StudyLine, StudySessionProgress } from "@/types/studyConfig"
import { MoveNode } from "@/types/moveTree"
import {
  filterLines,
  shuffleArray,
  getLinePreview
} from "@/utils/studyUtils"
import SimpleChessBoard from "@/components/SimpleChessBoard"

interface StudySessionProps {
  configuration: StudyConfiguration
  onExit: () => void
}

export default function StudySession({ configuration, onExit }: StudySessionProps) {
  // Now we quiz entire lines, not individual moves
  const [lineQueue, setLineQueue] = useState<StudyLine[]>([])
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)
  const [progress, setProgress] = useState<StudySessionProgress>({
    totalLines: 0,
    completedLines: 0,
    correctMoves: 0,
    incorrectMoves: 0,
    currentLineIndex: 0
  })
  const [currentFen, setCurrentFen] = useState<string>("")
  const [waitingForMove, setWaitingForMove] = useState(true)
  const [feedback, setFeedback] = useState<{
    type: "correct" | "incorrect" | null
    message: string
  }>({ type: null, message: "" })
  const [movesMadeInCurrentLine, setMovesMadeInCurrentLine] = useState<string[]>([])
  const [chess] = useState(() => new Chess())
  const [fenBeforeUserMove, setFenBeforeUserMove] = useState<string>("")
  const [incorrectMoveShown, setIncorrectMoveShown] = useState(false)

  // Initialize line queue
  useEffect(() => {
    const enabledLines = filterLines(configuration.lines, {
      onlyEnabled: true
    })

    if (enabledLines.length === 0) {
      return
    }

    // Shuffle the lines for variety
    const shuffled = shuffleArray(enabledLines)
    setLineQueue(shuffled)

    setProgress({
      totalLines: shuffled.length,
      completedLines: 0,
      correctMoves: 0,
      incorrectMoves: 0,
      currentLineIndex: 0
    })

    // Set up first line
    if (shuffled.length > 0) {
      startLine(shuffled[0])
    }
  }, [configuration])

  const playOpponentMovesUntilUserTurn = useCallback((
    line: StudyLine,
    fromMoveIndex: number,
    chessInstance: Chess,
    userColor: string
  ) => {
    let currentIdx = fromMoveIndex
    
    // Auto-play all opponent moves until we reach a user move
    while (currentIdx < line.path.length) {
      const move = line.path[currentIdx]
      
      // If this is the user's move, stop and wait for input
      if (move.move.color === userColor) {
        setCurrentMoveIndex(currentIdx)
        setWaitingForMove(true)
        break
      }
      
      // This is an opponent move - play it automatically
      try {
        chessInstance.move({
          from: move.move.from,
          to: move.move.to,
          promotion: move.move.promotion
        })
        
        // Update visual state
        setCurrentFen(chessInstance.fen())
        setMovesMadeInCurrentLine(prev => [...prev, move.move.san])
        setCurrentMoveIndex(currentIdx + 1)
        
        currentIdx++
      } catch (error) {
        console.error("Failed to auto-play opponent move:", error)
        break
      }
    }
    
    // If we've reached the end of the line, mark it complete
    if (currentIdx >= line.path.length) {
      setTimeout(() => {
        advanceToNextMove()
      }, 800)
    }
  }, [])

  const startLine = useCallback((line: StudyLine) => {
    // Start from the beginning position
    const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    chess.load(initialFen)
    setCurrentFen(initialFen)
    setCurrentMoveIndex(0)
    setMovesMadeInCurrentLine([])
    setWaitingForMove(false)
    setFeedback({ type: null, message: "" })
    
    // Auto-play opponent moves until it's the user's turn
    const userColor = line.orientation === "white" ? "w" : "b"
    playOpponentMovesUntilUserTurn(line, 0, chess, userColor)
  }, [chess, playOpponentMovesUntilUserTurn])

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!waitingForMove || currentLineIndex >= lineQueue.length) {
        return false
      }

      const currentLine = lineQueue[currentLineIndex]
      const expectedMove = currentLine.path[currentMoveIndex]
      
      // Save the FEN before attempting the move
      setFenBeforeUserMove(currentFen)
      
      // Check if the move matches
      const fromMatch = from === expectedMove.move.from
      const toMatch = to === expectedMove.move.to
      const promotionMatch = (promotion || undefined) === expectedMove.move.promotion
      
      const correct = fromMatch && toMatch && promotionMatch

      if (correct) {
        // Make the move on our chess instance
        try {
          chess.move({ from, to, promotion })
        } catch (error) {
          console.error("Failed to make move:", error)
          return false
        }

        // Update the FEN
        setCurrentFen(chess.fen())
        
        // Add the move to our list (update AFTER move is made)
        setMovesMadeInCurrentLine(prev => [...prev, expectedMove.move.san])

        setFeedback({
          type: "correct",
          message: `Correct! ${expectedMove.move.san}`
        })
        setProgress(prev => ({
          ...prev,
          correctMoves: prev.correctMoves + 1
        }))
        setWaitingForMove(false)
        setIncorrectMoveShown(false)

        // Auto-advance and play opponent moves
        setTimeout(() => {
          const nextMoveIndex = currentMoveIndex + 1
          
          // Check if we've completed this line
          if (nextMoveIndex >= currentLine.path.length) {
            advanceToNextMove()
          } else {
            // Auto-play opponent moves until next user turn
            const userColor = currentLine.orientation === "white" ? "w" : "b"
            playOpponentMovesUntilUserTurn(currentLine, nextMoveIndex, chess, userColor)
            setFeedback({ type: null, message: "" })
          }
        }, 800)

        return true
      } else {
        // Incorrect move - make it on the board to show what was played
        try {
          chess.move({ from, to, promotion })
          setCurrentFen(chess.fen())
        } catch (error) {
          // If the move is illegal, just show feedback
          console.error("Illegal move attempted:", error)
        }
        
        setFeedback({
          type: "incorrect",
          message: `Incorrect move`
        })
        setProgress(prev => ({
          ...prev,
          incorrectMoves: prev.incorrectMoves + 1
        }))
        // Keep waitingForMove true but mark that we're showing an incorrect move
        setIncorrectMoveShown(true)

        return false
      }
    },
    [waitingForMove, currentLineIndex, currentMoveIndex, lineQueue, chess, currentFen, playOpponentMovesUntilUserTurn]
  )

  const advanceToNextMove = () => {
    const currentLine = lineQueue[currentLineIndex]
    const nextMoveIndex = currentMoveIndex + 1

    // Check if we've completed this line
    if (nextMoveIndex >= currentLine.path.length) {
      // Line complete! Move to next line
      const nextLineIndex = currentLineIndex + 1
      
      setProgress(prev => ({
        ...prev,
        completedLines: prev.completedLines + 1
      }))

      if (nextLineIndex >= lineQueue.length) {
        // Session complete!
        return
      }

      setCurrentLineIndex(nextLineIndex)
      startLine(lineQueue[nextLineIndex])
    } else {
      // Continue with next move in this line
      setCurrentMoveIndex(nextMoveIndex)
      setWaitingForMove(true)
      setFeedback({ type: null, message: "" })
    }
  }

  const handleNext = () => {
    advanceToNextMove()
  }

  const handleResetAfterIncorrectMove = () => {
    if (incorrectMoveShown && fenBeforeUserMove) {
      // Reset to the position before the incorrect move
      chess.load(fenBeforeUserMove)
      setCurrentFen(fenBeforeUserMove)
      setIncorrectMoveShown(false)
      setFeedback({ type: null, message: "" })
    }
  }

  const handleRetry = () => {
    // Restart the current line from the beginning
    if (currentLineIndex < lineQueue.length) {
      startLine(lineQueue[currentLineIndex])
    }
  }

  if (lineQueue.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2>No lines to practice</h2>
          <p style={{ color: "#666", marginBottom: "16px" }}>
            Please select some lines in the configuration
          </p>
          <button
            onClick={onExit}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4a90e2",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Back to Study
          </button>
        </div>
      </div>
    )
  }

  const currentLine = lineQueue[currentLineIndex]
  const isComplete = currentLineIndex >= lineQueue.length
  const totalMoves = lineQueue.reduce((sum, line) => sum + line.path.length, 0)
  const completedMoves = progress.correctMoves + progress.incorrectMoves
  const progressPercent = totalMoves > 0 ? (completedMoves / totalMoves) * 100 : 0

  if (isComplete) {
    const accuracy =
      progress.correctMoves + progress.incorrectMoves > 0
        ? Math.round((progress.correctMoves / (progress.correctMoves + progress.incorrectMoves)) * 100)
        : 0

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          flexDirection: "column"
        }}
      >
        <div
          style={{
            backgroundColor: "#fff",
            padding: "40px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            textAlign: "center",
            maxWidth: "500px"
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "16px", color: "#28a745" }}>
            🎉 Session Complete!
          </h2>
          <div style={{ fontSize: "16px", color: "#666", marginBottom: "24px" }}>
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ fontSize: "48px", color: "#4a90e2" }}>{accuracy}%</strong>
              <div style={{ fontSize: "14px", marginTop: "4px" }}>Accuracy</div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginTop: "24px"
              }}
            >
              <div>
                <div style={{ fontSize: "24px", fontWeight: "600", color: "#28a745" }}>
                  {progress.correctMoves}
                </div>
                <div style={{ fontSize: "13px" }}>Correct</div>
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: "600", color: "#dc3545" }}>
                  {progress.incorrectMoves}
                </div>
                <div style={{ fontSize: "13px" }}>Incorrect</div>
              </div>
            </div>
          </div>
          <button
            onClick={onExit}
            style={{
              padding: "12px 24px",
              backgroundColor: "#4a90e2",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500"
            }}
          >
            Finish
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "20px"
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <h2 style={{ margin: 0, marginBottom: "8px", fontSize: "20px" }}>
            {configuration.studyName} - Training
          </h2>
          <div style={{ fontSize: "14px", color: "#666" }}>
            Line {currentLineIndex + 1} of {lineQueue.length} • Move {currentMoveIndex + 1} of {currentLine.path.length}
          </div>
        </div>
        <button
          onClick={onExit}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Exit Training
        </button>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          marginBottom: "20px",
          backgroundColor: "#e0e0e0",
          borderRadius: "4px",
          height: "8px",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            backgroundColor: "#4a90e2",
            transition: "width 0.3s ease"
          }}
        />
      </div>

      {/* Main Content */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          flex: 1,
          alignItems: "flex-start"
        }}
      >
        {/* Board */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#f9f9f9",
            border: "2px solid #ccc",
            borderRadius: "8px",
            padding: "24px",
            position: "relative"
          }}
        >
          <SimpleChessBoard
            fen={currentFen}
            orientation={currentLine.orientation}
            onMove={handleMove}
            movable={!incorrectMoveShown && waitingForMove}
          />
          
          {/* Overlay for incorrect move - click to reset */}
          {incorrectMoveShown && (
            <div
              onClick={handleResetAfterIncorrectMove}
              style={{
                position: "absolute",
                top: "24px",
                left: "24px",
                right: "24px",
                bottom: "24px",
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                borderRadius: "4px",
                zIndex: 10
              }}
            >
              <div
                style={{
                  backgroundColor: "#fff",
                  padding: "20px 30px",
                  borderRadius: "8px",
                  textAlign: "center",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
                }}
              >
                <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>
                  Click to try again
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div
          style={{
            width: "350px",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}
        >
          {/* Current Line Info */}
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "16px"
            }}
          >
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
              From: {currentLine.chapterName}
            </div>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
              Moves Played:
            </div>
            <div style={{ 
              fontSize: "13px", 
              lineHeight: "1.6", 
              minHeight: "20px",
              wordWrap: "break-word",
              overflowWrap: "break-word",
              whiteSpace: "normal"
            }}>
              {movesMadeInCurrentLine.length === 0 ? (
                <span style={{ color: "#999", fontStyle: "italic" }}>None yet</span>
              ) : (
                movesMadeInCurrentLine.map((san, idx) => {
                  // Determine if this is a white move based on the index
                  const isWhiteMove = idx % 2 === 0
                  const moveNumber = Math.floor(idx / 2) + 1
                  
                  return (
                    <span key={idx}>
                      {isWhiteMove && (
                        <span style={{ fontWeight: "600", marginRight: "4px" }}>
                          {moveNumber}.
                        </span>
                      )}
                      <span style={{ marginRight: "6px" }}>
                        {san}
                      </span>
                    </span>
                  )
                })
              )}
            </div>
          </div>

          {/* Feedback */}
          {feedback.type && (
            <div
              style={{
                backgroundColor: "#fff",
                border: `1px solid ${feedback.type === "correct" ? "#c3e6cb" : "#ddd"}`,
                color: feedback.type === "correct" ? "#155724" : "#333",
                borderRadius: "8px",
                padding: "16px"
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>
                {feedback.type === "correct" ? "✓ Correct!" : "✗ Incorrect"}
              </div>
              <div style={{ fontSize: "14px", marginBottom: feedback.type === "incorrect" ? "12px" : "0" }}>
                {feedback.message}
              </div>
              {feedback.type === "incorrect" && (
                <button
                  onClick={handleRetry}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#6c757d",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "13px"
                  }}
                >
                  Try Whole Line Again
                </button>
              )}
            </div>
          )}

          {/* Next Button - only show for correct moves */}
          {!waitingForMove && feedback.type === "correct" && (
            <button
              onClick={handleNext}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#4a90e2",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "16px",
              fontWeight: "500"
            }}
          >
            Next Move →
          </button>
          )}
        </div>
      </div>
    </div>
  )
}

