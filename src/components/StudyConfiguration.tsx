import { useState, useEffect } from "react"
import { Study, Chapter } from "@/types/study"
import { StudyLine, StudyConfiguration } from "@/types/studyConfig"
import { extractLinesFromChapter, filterLines, getLinePreview, countQuizMoves } from "@/utils/studyUtils"
import { deserializeGameFromStorage } from "@/utils/studyStorage"

interface StudyConfigurationProps {
  study: Study
  selectedChapterIds: string[]
  onStart: (config: StudyConfiguration) => void
  onClose: () => void
}

export default function StudyConfigurationComponent({
  study,
  selectedChapterIds,
  onStart,
  onClose
}: StudyConfigurationProps) {
  const [lines, setLines] = useState<StudyLine[]>([])
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null)

  // Load lines from selected chapters
  useEffect(() => {
    const selectedChapters = study.chapters.filter(ch =>
      selectedChapterIds.includes(ch.id)
    )

    const allLines: StudyLine[] = []

    for (const chapter of selectedChapters) {
      // Deserialize the chapter's game data
      const gameData = deserializeGameFromStorage(chapter.game)
      const chapterWithNodes: Chapter = {
        ...chapter,
        game: {
          ...chapter.game,
          rootNodes: gameData.rootNodes
        }
      }
      const chapterLines = extractLinesFromChapter(chapterWithNodes, chapter.orientation || "white")
      allLines.push(...chapterLines)
    }

    setLines(allLines)
  }, [study, selectedChapterIds])

  const handleToggleLine = (lineId: string) => {
    setLines(prev =>
      prev.map(line =>
        line.id === lineId ? { ...line, isEnabled: !line.isEnabled } : line
      )
    )
  }

  const handleToggleAllInChapter = (chapterId: string, enable: boolean) => {
    setLines(prev =>
      prev.map(line =>
        line.chapterId === chapterId ? { ...line, isEnabled: enable } : line
      )
    )
  }

  const handleStart = () => {
    const enabledLines = filterLines(lines, {
      onlyEnabled: true
    })

    if (enabledLines.length === 0) {
      alert("Please enable at least one line to study")
      return
    }

    const config: StudyConfiguration = {
      studyId: study.id,
      studyName: study.name,
      selectedChapters: selectedChapterIds,
      lines: lines,
      onlyMySide: false // Always quiz all moves (both sides)
    }

    onStart(config)
  }

  // Group lines by chapter
  const linesByChapter = new Map<string, StudyLine[]>()
  for (const line of lines) {
    if (!linesByChapter.has(line.chapterId)) {
      linesByChapter.set(line.chapterId, [])
    }
    linesByChapter.get(line.chapterId)!.push(line)
  }

  const enabledLines = filterLines(lines, { onlyEnabled: true })
  const totalQuizMoves = countQuizMoves(enabledLines, false) // Count all moves

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "800px",
          width: "90%",
          maxHeight: "85vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ margin: 0, marginBottom: "8px", fontSize: "24px", fontWeight: "600" }}>
            Configure Study Session
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
            Refine which lines to include in your training
          </p>
        </div>

        {/* Summary */}
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#e3f2fd",
            border: "1px solid #4a90e2",
            borderRadius: "4px",
            marginBottom: "20px",
            fontSize: "14px"
          }}
        >
          <strong>{enabledLines.length}</strong> line{enabledLines.length !== 1 ? "s" : ""} selected •{" "}
          <strong>{totalQuizMoves}</strong> move{totalQuizMoves !== 1 ? "s" : ""} to practice
        </div>

        {/* Lines by Chapter */}
        <div style={{ flex: 1, overflowY: "auto", marginBottom: "20px" }}>
          {Array.from(linesByChapter.entries()).map(([chapterId, chapterLines]) => {
            const chapter = study.chapters.find(ch => ch.id === chapterId)
            if (!chapter) return null

            const enabledCount = chapterLines.filter(l => l.isEnabled).length
            const isExpanded = expandedChapter === chapterId

            return (
              <div
                key={chapterId}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  marginBottom: "12px",
                  overflow: "hidden"
                }}
              >
                {/* Chapter Header */}
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#f5f5f5",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer"
                  }}
                  onClick={() => setExpandedChapter(isExpanded ? null : chapterId)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", fontSize: "15px", marginBottom: "4px" }}>
                      {chapter.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#666" }}>
                      {enabledCount} of {chapterLines.length} line{chapterLines.length !== 1 ? "s" : ""} enabled
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleAllInChapter(chapterId, true)
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        backgroundColor: "#fff",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                    >
                      Enable All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleAllInChapter(chapterId, false)
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        backgroundColor: "#fff",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                    >
                      Disable All
                    </button>
                    <span style={{ fontSize: "16px" }}>{isExpanded ? "▼" : "▶"}</span>
                  </div>
                </div>

                {/* Lines List */}
                {isExpanded && (
                  <div style={{ padding: "8px" }}>
                    {chapterLines.map((line, idx) => (
                      <div
                        key={line.id}
                        style={{
                          padding: "8px 12px",
                          marginBottom: "4px",
                          backgroundColor: line.isEnabled ? "#fff" : "#f9f9f9",
                          border: line.isEnabled ? "1px solid #ddd" : "1px solid #e0e0e0",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          opacity: line.isEnabled ? 1 : 0.6
                        }}
                      >
                        <label style={{ display: "flex", alignItems: "center", cursor: "pointer", flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={line.isEnabled}
                            onChange={() => handleToggleLine(line.id)}
                            style={{ marginRight: "8px" }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "13px", color: "#333", marginBottom: "2px" }}>
                              Line {idx + 1}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                fontFamily: "monospace"
                              }}
                            >
                              {getLinePreview(line, 8)}
                            </div>
                          </div>
                        </label>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#666",
                            padding: "2px 6px",
                            backgroundColor: "#e0e0e0",
                            borderRadius: "3px"
                          }}
                        >
                          {line.depth} moves
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              backgroundColor: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={enabledLines.length === 0}
            style={{
              padding: "10px 20px",
              backgroundColor: enabledLines.length > 0 ? "#4a90e2" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: enabledLines.length > 0 ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            Start Training
          </button>
        </div>
      </div>
    </div>
  )
}

