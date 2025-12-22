import { useState, useEffect, ChangeEvent } from "react"
import { Study, Chapter } from "@/types/study"
import { MoveNode } from "@/types/moveTree"
import { StudyConfiguration } from "@/types/studyConfig"
import { loadStudies, createStudy, addStudy, deleteStudy, getChapterById, updateChapterInStudy, addChapterToStudy, createChapter, deserializeGameFromStorage, serializeGameForStorage, reorderChaptersInStudy, deleteChapterFromStudy } from "@/utils/studyStorage"
import { importFromPGN, generateChapterNameFromMetadata, PGNMetadata } from "@/utils/pgnUtils"
import ChessBoardWithMoves from "@/components/ChessBoardWithMoves"
import StudyConfigurationComponent from "@/components/StudyConfiguration"
import StudySession from "@/components/StudySession"

export default function Home() {
  const [studies, setStudies] = useState<Study[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateStudy, setShowCreateStudy] = useState(false)
  const [newStudyName, setNewStudyName] = useState("")
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [currentRootNodes, setCurrentRootNodes] = useState<MoveNode[]>([])
  const [showNewChapterInput, setShowNewChapterInput] = useState(false)
  const [newChapterName, setNewChapterName] = useState("")
  const [newChapterTab, setNewChapterTab] = useState<"Empty" | "PGN">("Empty")
  const [pgnText, setPgnText] = useState("")
  const [draggedChapterId, setDraggedChapterId] = useState<string | null>(null)
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editChapterName, setEditChapterName] = useState("")
  const [editChapterOrientation, setEditChapterOrientation] = useState<"white" | "black">("white")
  const [showStudySelection, setShowStudySelection] = useState(false)
  const [selectedChaptersForStudy, setSelectedChaptersForStudy] = useState<Set<string>>(new Set())
  const [showStudyConfiguration, setShowStudyConfiguration] = useState(false)
  const [studyConfiguration, setStudyConfiguration] = useState<StudyConfiguration | null>(null)
  const [isInStudySession, setIsInStudySession] = useState(false)

  useEffect(() => {
    refreshStudies()
  }, [])

  const refreshStudies = () => {
    const loadedStudies = loadStudies()
    setStudies(loadedStudies)
  }

  const handleCreateStudy = () => {
    if (!newStudyName.trim()) {
      return
    }

    const newStudy = createStudy(newStudyName.trim())
    if (addStudy(newStudy)) {
      refreshStudies()
      setNewStudyName("")
      setShowCreateStudy(false)
    }
  }

  const handleDeleteStudy = (studyId: string, studyName: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the study click
    if (confirm(`Are you sure you want to delete "${studyName}"? This will delete all chapters and games in this study.`)) {
      if (deleteStudy(studyId)) {
        refreshStudies()
        // If the deleted study was selected, exit the board view
        if (selectedStudyId === studyId) {
          setSelectedStudyId(null)
          setSelectedChapterId(null)
          setCurrentRootNodes([])
        }
      } else {
        alert("Failed to delete study")
      }
    }
  }

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffWeeks = Math.floor(diffDays / 7)
    const diffMonths = Math.floor(diffDays / 30)
    const diffYears = Math.floor(diffDays / 365)

    if (diffYears > 0) {
      return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`
    } else if (diffMonths > 0) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
    } else if (diffWeeks > 0) {
      return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } else {
      return "Today"
    }
  }

  const getStudyIcon = (study: Study): string => {
    // Use first two letters of study name as icon
    const name = study.name.trim()
    if (name.length >= 2) {
      return name.substring(0, 2).toUpperCase()
    }
    return name.substring(0, 1).toUpperCase()
  }

  const filteredStudies = studies.filter(study =>
    study.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleStudyClick = (studyId: string) => {
    setSelectedStudyId(studyId)
    const study = studies.find(s => s.id === studyId)
    // Ensure study has at least one chapter
    if (study) {
      if (study.chapters.length === 0) {
        // Create an empty chapter if study has none
        const newChapter = createChapter("Chapter 1")
        if (addChapterToStudy(studyId, newChapter)) {
          refreshStudies()
          setSelectedChapterId(newChapter.id)
        }
      } else {
        setSelectedChapterId(study.chapters[0].id)
      }
    }
  }

  const handleChapterClick = (studyId: string, chapterId: string) => {
    setSelectedStudyId(studyId)
    setSelectedChapterId(chapterId)
  }

  const handleExit = () => {
    // Save current chapter before exiting
    if (selectedStudyId && selectedChapterId) {
      saveCurrentChapter()
    }
    setSelectedStudyId(null)
    setSelectedChapterId(null)
    setCurrentRootNodes([])
    refreshStudies() // Refresh to get any updates
  }

  const loadChapterData = (chapter: Chapter | null) => {
    if (!chapter) {
      setCurrentRootNodes([])
      return
    }
    
    // Always deserialize since data from localStorage is JSON and needs proper parent references
    const gameData = deserializeGameFromStorage({
      rootNodes: chapter.game.rootNodes || [],
      initialFen: chapter.game.initialFen
    })
    setCurrentRootNodes(gameData.rootNodes)
  }

  const saveCurrentChapter = () => {
    if (!selectedStudyId || !selectedChapterId) return
    
    const chapter = getChapterById(selectedStudyId, selectedChapterId)
    if (!chapter) return
    
    // Serialize for storage (removes circular parent references)
    const serialized = serializeGameForStorage(currentRootNodes, chapter.game.initialFen)
    const updatedChapter: Chapter = {
      ...chapter,
      game: {
        ...chapter.game,
        rootNodes: serialized.rootNodes, // Store serialized version (will be deserialized on load)
        initialFen: serialized.initialFen
      }
    }
    
    updateChapterInStudy(selectedStudyId, selectedChapterId, updatedChapter)
  }

  const handleChapterSwitch = (chapterId: string) => {
    // Save current chapter before switching
    if (selectedChapterId) {
      saveCurrentChapter()
    }
    
    setSelectedChapterId(chapterId)
    const chapter = getChapterById(selectedStudyId!, chapterId)
    loadChapterData(chapter)
  }

  const handleCreateChapter = () => {
    if (!selectedStudyId) {
      alert("Please select a study first")
      return
    }
    
    let chapterName = newChapterName.trim()
    let newChapter: Chapter
    
    if (newChapterTab === "Empty") {
      // Create empty chapter with base setup
      if (!chapterName) {
        chapterName = "Untitled Chapter"
      }
      newChapter = createChapter(chapterName)
    } else {
      // Create chapter from PGN
      if (!pgnText.trim()) {
        alert("Please provide PGN text or select a file")
        return
      }
      
      const importResult = importFromPGN(pgnText.trim())
      
      // Auto-generate chapter name from metadata if empty
      if (!chapterName) {
        chapterName = generateChapterNameFromMetadata(importResult.metadata)
      }
      
      // Check for errors
      if (importResult.errors.length > 0) {
        const errorMsg = importResult.errors.join("\n")
        alert(`Failed to import PGN:\n\n${errorMsg}`)
        return
      }
      
      // Check if we got any moves
      if (importResult.rootNodes.length === 0) {
        alert("No valid moves found in PGN. Please check the format.")
        return
      }
      
      // Show warnings if any
      if (importResult.warnings.length > 0) {
        console.warn("PGN import warnings:", importResult.warnings)
      }
      
      // Create chapter with imported data
      newChapter = createChapter(chapterName)
      
      // Serialize the rootNodes for storage (removes circular parent references)
      const serialized = serializeGameForStorage(importResult.rootNodes, newChapter.game.initialFen)
      newChapter.game.rootNodes = serialized.rootNodes
      newChapter.game.initialFen = serialized.initialFen
      
      if (importResult.metadata && Object.keys(importResult.metadata).length > 0) {
        newChapter.game.metadata = importResult.metadata
      }
    }
    
    if (addChapterToStudy(selectedStudyId, newChapter)) {
      refreshStudies()
      setNewChapterName("")
      setPgnText("")
      setShowNewChapterInput(false)
      setNewChapterTab("Empty")
      handleChapterSwitch(newChapter.id)
    } else {
      alert("Failed to add chapter to study")
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setPgnText(text)
      }
      reader.readAsText(file)
    }
  }

  // Handle drag and drop for chapters
  const handleDragStart = (chapterId: string) => {
    setDraggedChapterId(chapterId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetChapterId: string) => {
    if (!draggedChapterId || !selectedStudyId || draggedChapterId === targetChapterId) {
      setDraggedChapterId(null)
      return
    }

    const study = studies.find(s => s.id === selectedStudyId)
    if (!study) {
      setDraggedChapterId(null)
      return
    }

    const chapterIds = study.chapters.map(c => c.id)
    const draggedIndex = chapterIds.indexOf(draggedChapterId)
    const targetIndex = chapterIds.indexOf(targetChapterId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedChapterId(null)
      return
    }

    // Reorder chapters
    const newChapterIds = [...chapterIds]
    newChapterIds.splice(draggedIndex, 1)
    newChapterIds.splice(targetIndex, 0, draggedChapterId)

    if (reorderChaptersInStudy(selectedStudyId, newChapterIds)) {
      refreshStudies()
    }

    setDraggedChapterId(null)
  }

  // Handle chapter settings
  const handleOpenSettings = (chapterId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const chapter = getChapterById(selectedStudyId!, chapterId)
    if (chapter) {
      setEditingChapterId(chapterId)
      setEditChapterName(chapter.name)
      setEditChapterOrientation(chapter.orientation || "white")
    }
  }

  const handleCloseSettings = () => {
    setEditingChapterId(null)
    setEditChapterName("")
    setEditChapterOrientation("white")
  }

  const handleSaveChapter = () => {
    if (!selectedStudyId || !editingChapterId) return

    const chapter = getChapterById(selectedStudyId, editingChapterId)
    if (!chapter) return

    const updatedChapter: Chapter = {
      ...chapter,
      name: editChapterName.trim() || "Untitled Chapter",
      orientation: editChapterOrientation,
      updatedAt: new Date().toISOString()
    }

    if (updateChapterInStudy(selectedStudyId, editingChapterId, updatedChapter)) {
      refreshStudies()
      if (selectedChapterId === editingChapterId) {
        loadChapterData(updatedChapter)
      }
      handleCloseSettings()
    }
  }

  const handleClearAnnotations = () => {
    if (!selectedStudyId || !editingChapterId) return

    const chapter = getChapterById(selectedStudyId, editingChapterId)
    if (!chapter) return

    // Remove all comments from all nodes
    const removeComments = (nodes: MoveNode[]) => {
      nodes.forEach(node => {
        node.comment = undefined
        if (node.children.length > 0) {
          removeComments(node.children)
        }
      })
    }

    const deserialized = deserializeGameFromStorage(chapter.game)
    removeComments(deserialized.rootNodes)
    const serialized = serializeGameForStorage(deserialized.rootNodes, chapter.game.initialFen)

    const updatedChapter: Chapter = {
      ...chapter,
      game: {
        ...chapter.game,
        rootNodes: serialized.rootNodes,
        updatedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    }

    if (updateChapterInStudy(selectedStudyId, editingChapterId, updatedChapter)) {
      refreshStudies()
      if (selectedChapterId === editingChapterId) {
        loadChapterData(updatedChapter)
      }
    }
  }

  const handleClearVariations = () => {
    if (!selectedStudyId || !editingChapterId) return

    const chapter = getChapterById(selectedStudyId, editingChapterId)
    if (!chapter) return

    // Keep only main line moves, remove all variations and comments
    const keepMainLine = (node: MoveNode, parent: MoveNode | null): MoveNode | null => {
      // Create a cleaned node without comments
      const cleanedNode: MoveNode = {
        ...node,
        parent: parent,
        comment: undefined,
        children: [],
        isMainLine: true
      }

      // Find the main line child (or first child if no main line marked)
      const mainChild = node.children.find(c => c.isMainLine) || (node.children.length > 0 ? node.children[0] : null)
      
      if (mainChild) {
        const mainLineChild = keepMainLine(mainChild, cleanedNode)
        if (mainLineChild) {
          cleanedNode.children = [mainLineChild]
        }
      }

      return cleanedNode
    }

    const deserialized = deserializeGameFromStorage(chapter.game)
    // Process each root node and keep only its main line
    const mainLineNodes: MoveNode[] = []
    for (const rootNode of deserialized.rootNodes) {
      const mainLineNode = keepMainLine(rootNode, null)
      if (mainLineNode) {
        mainLineNodes.push(mainLineNode)
      }
    }

    const serialized = serializeGameForStorage(mainLineNodes, chapter.game.initialFen)

    const updatedChapter: Chapter = {
      ...chapter,
      game: {
        ...chapter.game,
        rootNodes: serialized.rootNodes,
        updatedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    }

    if (updateChapterInStudy(selectedStudyId, editingChapterId, updatedChapter)) {
      refreshStudies()
      if (selectedChapterId === editingChapterId) {
        loadChapterData(updatedChapter)
      }
    }
  }

  const handleDeleteChapter = () => {
    if (!selectedStudyId || !editingChapterId) return

    const study = studies.find(s => s.id === selectedStudyId)
    const isLastChapter = study && study.chapters.length === 1
    const wasCurrentChapter = selectedChapterId === editingChapterId

    if (confirm("Are you sure you want to delete this chapter?")) {
      if (deleteChapterFromStudy(selectedStudyId, editingChapterId)) {
        refreshStudies()
        // Get the updated study after refresh
        const updatedStudies = loadStudies()
        const updatedStudy = updatedStudies.find(s => s.id === selectedStudyId)
        
        if (updatedStudy && updatedStudy.chapters.length > 0) {
          if (isLastChapter && wasCurrentChapter) {
            // Switch to the new empty chapter that was just created
            const newChapter = updatedStudy.chapters[updatedStudy.chapters.length - 1]
            setSelectedChapterId(newChapter.id)
            loadChapterData(newChapter)
          } else if (wasCurrentChapter) {
            // If there are other chapters, select the first one
            setSelectedChapterId(updatedStudy.chapters[0].id)
            loadChapterData(updatedStudy.chapters[0])
          }
        }
        handleCloseSettings()
      }
    }
  }

  // Study mode handlers
  const handleOpenStudySelection = () => {
    if (!selectedStudyId) return
    const study = studies.find(s => s.id === selectedStudyId)
    if (study) {
      // Initialize with all chapters selected
      const allChapterIds = new Set(study.chapters.map(ch => ch.id))
      setSelectedChaptersForStudy(allChapterIds)
      setShowStudySelection(true)
    }
  }

  const handleCloseStudySelection = () => {
    setShowStudySelection(false)
  }

  const handleToggleChapterForStudy = (chapterId: string) => {
    setSelectedChaptersForStudy(prev => {
      const newSet = new Set(prev)
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId)
      } else {
        newSet.add(chapterId)
      }
      return newSet
    })
  }

  const handleStartStudy = () => {
    if (selectedChaptersForStudy.size === 0) {
      alert("Please select at least one chapter to study")
      return
    }
    setShowStudySelection(false)
    setShowStudyConfiguration(true)
  }

  const handleStudyConfigurationStart = (config: StudyConfiguration) => {
    setStudyConfiguration(config)
    setShowStudyConfiguration(false)
    setIsInStudySession(true)
  }

  const handleExitStudySession = () => {
    setIsInStudySession(false)
    setStudyConfiguration(null)
  }

  // Count lines in a chapter
  const countLinesInChapter = (chapter: Chapter): number => {
    if (!chapter || !chapter.game || !chapter.game.rootNodes) return 0
    
    const deserialized = deserializeGameFromStorage(chapter.game)
    const rootNodes = deserialized.rootNodes
    
    if (rootNodes.length === 0) return 0
    
    const countLinesFromNode = (node: MoveNode): number => {
      // If this is a leaf node (no children), it's one line
      if (node.children.length === 0) {
        return 1
      }
      
      // Otherwise, sum up all lines from all children
      let total = 0
      for (const child of node.children) {
        total += countLinesFromNode(child)
      }
      return total
    }
    
    // Count lines from each root node
    let count = 0
    for (const rootNode of rootNodes) {
      count += countLinesFromNode(rootNode)
    }
    
    return count
  }

  // Load chapter data when chapter changes
  useEffect(() => {
    if (selectedStudyId && selectedChapterId) {
      const chapter = getChapterById(selectedStudyId, selectedChapterId)
      loadChapterData(chapter)
    }
  }, [selectedStudyId, selectedChapterId])

  // If in study session, show the StudySession component
  if (isInStudySession && studyConfiguration) {
    return <StudySession configuration={studyConfiguration} onExit={handleExitStudySession} />
  }

  // If a study is selected, show the chess board with chapters sidebar
  if (selectedStudyId) {
    const study = studies.find(s => s.id === selectedStudyId)
    const chapter = selectedChapterId && study 
      ? getChapterById(selectedStudyId, selectedChapterId)
      : null
    
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "20px"
      }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignSelf: "flex-start" }}>
          <button
            onClick={handleExit}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            ← Exit
          </button>
          <button
            onClick={handleOpenStudySelection}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4a90e2",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            Study
          </button>
        </div>
        <div style={{
          display: "flex",
          gap: "20px",
          flex: 1
        }}>
          <div style={{
            flex: 1,
            backgroundColor: "#f9f9f9",
            border: "2px solid #ccc",
            borderRadius: "8px",
            padding: "24px"
          }}>
            <ChessBoardWithMoves 
              initialFen={chapter?.game.initialFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
              movable={true}
              initialRootNodes={currentRootNodes}
              orientation={chapter?.orientation || "white"}
              onSave={(rootNodes) => {
                setCurrentRootNodes(rootNodes)
                saveCurrentChapter()
              }}
            />
          </div>
          
          {/* Chapters Sidebar */}
          <div style={{
            width: "250px",
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto"
          }}>
            <h3 style={{
              marginTop: 0,
              marginBottom: "16px",
              fontSize: "18px",
              fontWeight: "600"
            }}>
              Chapters
            </h3>
            
            {study && study.chapters.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                {study.chapters.map((ch, index) => (
                  <div
                    key={ch.id}
                    draggable
                    onDragStart={() => handleDragStart(ch.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(ch.id)}
                    onClick={() => handleChapterSwitch(ch.id)}
                    style={{
                      padding: "10px",
                      marginBottom: "8px",
                      backgroundColor: selectedChapterId === ch.id ? "#e3f2fd" : "#f5f5f5",
                      border: selectedChapterId === ch.id ? "2px solid #4a90e2" : "1px solid #ddd",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      opacity: draggedChapterId === ch.id ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                      <span style={{ 
                        fontSize: "12px", 
                        color: "#666", 
                        minWidth: "20px",
                        fontWeight: "500"
                      }}>
                        {index + 1}
                      </span>
                      <span style={{ flex: 1 }}>{ch.name || "Untitled Chapter"}</span>
                    </div>
                    <button
                      onClick={(e) => handleOpenSettings(ch.id, e)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "transparent",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        marginLeft: "8px"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f0f0f0"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent"
                      }}
                    >
                      ⚙️
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {showNewChapterInput ? (
              <div style={{
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
              }}>
                <div style={{
                  backgroundColor: "#fff",
                  padding: "24px",
                  borderRadius: "8px",
                  minWidth: "500px",
                  maxWidth: "600px",
                  maxHeight: "80vh",
                  overflowY: "auto"
                }}>
                  <div style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
                    New chapter
                  </div>
                  
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ marginBottom: "8px", fontSize: "14px" }}>Name</div>
                    <input
                      type="text"
                      value={newChapterName}
                      onChange={(e) => setNewChapterName(e.target.value)}
                      placeholder="Chapter name"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "14px"
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", gap: "16px", marginBottom: "12px", borderBottom: "1px solid #ccc" }}>
                      <button
                        onClick={() => setNewChapterTab("Empty")}
                        style={{
                          padding: "8px 0",
                          backgroundColor: "transparent",
                          border: "none",
                          borderBottom: newChapterTab === "Empty" ? "2px solid #4a90e2" : "2px solid transparent",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: newChapterTab === "Empty" ? "600" : "400"
                        }}
                      >
                        Empty
                      </button>
                      <button
                        onClick={() => setNewChapterTab("PGN")}
                        style={{
                          padding: "8px 0",
                          backgroundColor: "transparent",
                          border: "none",
                          borderBottom: newChapterTab === "PGN" ? "2px solid #4a90e2" : "2px solid transparent",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: newChapterTab === "PGN" ? "600" : "400"
                        }}
                      >
                        PGN
                      </button>
                    </div>

                    {newChapterTab === "Empty" && (
                      <div style={{ fontSize: "14px", color: "#666" }}>
                        Start from the base setup with no moves
                      </div>
                    )}

                    {newChapterTab === "PGN" && (
                      <div>
                        <div style={{ marginBottom: "12px" }}>
                          <input
                            type="file"
                            accept=".pgn,.txt"
                            onChange={handleFileSelect}
                            style={{ display: "none" }}
                            id="pgn-file-input"
                          />
                          <button
                            onClick={() => document.getElementById("pgn-file-input")?.click()}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: "#f0f0f0",
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "14px",
                              marginBottom: "12px"
                            }}
                          >
                            Choose File
                          </button>
                        </div>
                        <textarea
                          value={pgnText}
                          onChange={(e) => setPgnText(e.target.value)}
                          placeholder="Paste PGN text here"
                          style={{
                            width: "100%",
                            minHeight: "200px",
                            padding: "8px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            fontSize: "14px",
                            fontFamily: "monospace",
                            backgroundColor: "#fff",
                            color: "#000",
                            resize: "vertical"
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        setShowNewChapterInput(false)
                        setNewChapterName("")
                        setPgnText("")
                        setNewChapterTab("Empty")
                      }}
                      style={{
                        padding: "8px 16px",
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
                      onClick={handleCreateChapter}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#4a90e2",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "14px"
                      }}
                    >
                      CREATE CHAPTER
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  onClick={() => setShowNewChapterInput(true)}
                  style={{
                    padding: "10px",
                    backgroundColor: "#f0f0f0",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  + New Chapter
                </button>
                <button
                  onClick={handleOpenStudySelection}
                  style={{
                    padding: "10px",
                    backgroundColor: "#4a90e2",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}
                >
                  Study
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chapter Settings Modal */}
        {editingChapterId && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001
          }}
          onClick={handleCloseSettings}
          >
            <div style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "8px",
              minWidth: "500px",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
                Edit chapter
              </div>
              
              <div style={{ marginBottom: "16px" }}>
                <div style={{ marginBottom: "8px", fontSize: "14px" }}>Name</div>
                <input
                  type="text"
                  value={editChapterName}
                  onChange={(e) => setEditChapterName(e.target.value)}
                  placeholder="Chapter name"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ marginBottom: "8px", fontSize: "14px" }}>Board side</div>
                <select
                  value={editChapterOrientation}
                  onChange={(e) => {
                    const newOrientation = e.target.value as "white" | "black"
                    setEditChapterOrientation(newOrientation)
                    // Update immediately if this is the current chapter
                    if (selectedChapterId === editingChapterId && selectedStudyId) {
                      const chapter = getChapterById(selectedStudyId, editingChapterId)
                      if (chapter) {
                        const updatedChapter: Chapter = {
                          ...chapter,
                          orientation: newOrientation,
                          updatedAt: new Date().toISOString()
                        }
                        updateChapterInStudy(selectedStudyId, editingChapterId, updatedChapter)
                        refreshStudies()
                      }
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px"
                  }}
                >
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
              </div>

              <div style={{ marginBottom: "16px", display: "flex", gap: "16px" }}>
                <button
                  onClick={handleClearAnnotations}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "transparent",
                    border: "none",
                    color: "#d32f2f",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  CLEAR ANNOTATIONS
                </button>
                <button
                  onClick={handleClearVariations}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "transparent",
                    border: "none",
                    color: "#d32f2f",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  CLEAR VARIATIONS
                </button>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <button
                  onClick={handleDeleteChapter}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "transparent",
                    border: "none",
                    color: "#d32f2f",
                    cursor: "pointer",
                    fontSize: "14px",
                    textDecoration: "underline"
                  }}
                >
                  DELETE CHAPTER
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={handleCloseSettings}
                  style={{
                    padding: "8px 16px",
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
                  onClick={handleSaveChapter}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#4a90e2",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  SAVE CHAPTER
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Study Selection Modal */}
        {showStudySelection && selectedStudyId && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1002
          }}
          onClick={handleCloseStudySelection}
          >
            <div style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "8px",
              minWidth: "500px",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
                Select Chapters to Study
              </div>
              
              <div style={{ marginBottom: "16px", fontSize: "14px", color: "#666" }}>
                Choose which chapters to include in your study session. Toggle chapters on or off using the switches.
              </div>

              <div style={{ marginBottom: "24px", maxHeight: "400px", overflowY: "auto" }}>
                {study && study.chapters.length > 0 ? (
                  study.chapters.map((chapter, index) => (
                    <div
                      key={chapter.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px",
                        marginBottom: "8px",
                        backgroundColor: "#f9f9f9",
                        borderRadius: "4px",
                        border: "1px solid #e0e0e0"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                        <span style={{ 
                          fontSize: "14px", 
                          color: "#666", 
                          minWidth: "24px",
                          fontWeight: "500"
                        }}>
                          {index + 1}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                          <span style={{ fontSize: "14px", fontWeight: "500" }}>
                            {chapter.name || "Untitled Chapter"}
                          </span>
                          <span style={{ fontSize: "12px", color: "#666" }}>
                            {countLinesInChapter(chapter)} line{countLinesInChapter(chapter) !== 1 ? 's' : ''}
                          </span>
                      </div>
                    </div>
                      <label style={{
                        display: "inline-flex",
                        alignItems: "center",
                        cursor: "pointer",
                        position: "relative",
                        width: "50px",
                        height: "26px"
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedChaptersForStudy.has(chapter.id)}
                          onChange={() => handleToggleChapterForStudy(chapter.id)}
                          style={{
                            opacity: 0,
                            width: 0,
                            height: 0
                          }}
                        />
                        <span style={{
                          position: "absolute",
                          width: "50px",
                          height: "26px",
                          backgroundColor: selectedChaptersForStudy.has(chapter.id) ? "#4a90e2" : "#ccc",
                          borderRadius: "13px",
                          transition: "background-color 0.2s",
                          cursor: "pointer"
                        }} />
                        <span style={{
                          position: "absolute",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          backgroundColor: "#fff",
                          top: "2px",
                          left: selectedChaptersForStudy.has(chapter.id) ? "26px" : "2px",
                          transition: "left 0.2s",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          pointerEvents: "none"
                        }} />
                      </label>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>
                    No chapters available
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={handleCloseStudySelection}
                  style={{
                    padding: "8px 16px",
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
                  onClick={handleStartStudy}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#4a90e2",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}
                >
                  Start Study
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Study Configuration Modal */}
        {showStudyConfiguration && selectedStudyId && (
          <StudyConfigurationComponent
            study={study}
            selectedChapterIds={Array.from(selectedChaptersForStudy)}
            onStart={handleStudyConfigurationStart}
            onClose={() => setShowStudyConfiguration(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{
      minHeight: "100vh",
      padding: "20px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      {/* Top Bar */}
      <div style={{
        display: "flex",
        gap: "12px",
        marginBottom: "24px",
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: "1",
            minWidth: "200px",
            padding: "10px 16px",
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "14px",
            outline: "none"
          }}
        />
        <button
          onClick={() => setShowCreateStudy(true)}
          style={{
            padding: "10px 16px",
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Create new
        </button>
      </div>

      {/* Create Study Modal */}
      {showCreateStudy && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: "#fff",
            padding: "24px",
            borderRadius: "8px",
            minWidth: "300px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Create New Study</h3>
            <input
              type="text"
              value={newStudyName}
              onChange={(e) => setNewStudyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateStudy()
                } else if (e.key === "Escape") {
                  setShowCreateStudy(false)
                  setNewStudyName("")
                }
              }}
              placeholder="Study name"
              autoFocus
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#fff",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
                marginBottom: "16px",
                outline: "none"
              }}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowCreateStudy(false)
                  setNewStudyName("")
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStudy}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#4a90e2",
                  border: "none",
                  borderRadius: "4px",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Studies Grid */}
      {filteredStudies.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#666"
        }}>
          <p style={{ fontSize: "18px", marginBottom: "8px" }}>No studies found</p>
          <p style={{ fontSize: "14px" }}>Create a new study to get started</p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "20px"
        }}>
          {filteredStudies.map((study) => {
            const icon = getStudyIcon(study)
            
            return (
              <div
                key={study.id}
                onClick={() => handleStudyClick(study.id)}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  padding: "16px",
                  border: "1px solid #ccc",
                  cursor: "pointer"
                }}
              >
                {/* Study Header */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px"
                }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    backgroundColor: "#4a90e2",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#fff",
                    flexShrink: 0
                  }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
                    }}>
                      <div style={{
                        color: "#4a90e2",
                        fontSize: "16px",
                        fontWeight: "500",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1
                      }}>
                        {study.name}
                      </div>
                      <button
                        onClick={(e) => handleDeleteStudy(study.id, study.name, e)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#dc3545",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "500",
                          flexShrink: 0
                        }}
                        title="Delete study"
                      >
                        Delete
                      </button>
                    </div>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "4px",
                      fontSize: "12px",
                      color: "#666"
                    }}>
                      <span>{formatTimeAgo(study.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Chapters List */}
                <div style={{ marginTop: "12px" }} onClick={(e) => e.stopPropagation()}>
                  {study.chapters.length === 0 ? (
                    <div style={{
                      padding: "8px",
                      color: "#666",
                      fontSize: "13px",
                      fontStyle: "italic"
                    }}>
                      No chapters yet
                    </div>
                  ) : (
                    study.chapters.slice(0, 4).map((chapter, idx) => (
                      <div
                        key={chapter.id}
                        onClick={() => handleChapterClick(study.id, chapter.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "4px 0",
                          fontSize: "13px",
                          cursor: "pointer"
                        }}
                      >
                        <span style={{ color: "#666" }}>-</span>
                        <span
                          style={{
                            flex: 1,
                            color: "#333",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {chapter.name || `Chapter ${idx + 1}`}
                        </span>
                      </div>
                    ))
                  )}
                  {study.chapters.length > 4 && (
                    <div style={{
                      padding: "4px 0",
                      fontSize: "12px",
                      color: "#666",
                      fontStyle: "italic"
                    }}>
                      +{study.chapters.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

