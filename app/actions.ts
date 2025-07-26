"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import pdf from 'pdf-parse'
import { PDFDocument, rgb, PDFPage, PDFFont } from 'pdf-lib'

export interface TextPosition {
  x: number
  y: number
  width: number
  height: number
  fontName: string
  fontSize: number
  text: string
  pageIndex: number
}

export interface DetailedChange {
  id: string
  originalText: string
  modifiedText: string
  context: string
  changeType: 'keyword' | 'phrasing' | 'enhancement'
  keywords: string[]
  selected?: boolean
  position?: TextPosition
}

export interface KeywordExtractionResult {
  availableKeywords: string[]
  resumeText: string
  originalPdfBuffer: ArrayBuffer
  textPositions?: TextPosition[]
}

export interface OptimizationResult {
  detailedChanges: DetailedChange[]
  optimizedContent: string
  changes: string[]
}

export async function extractKeywords(formData: FormData): Promise<KeywordExtractionResult> {
  const jobDescription = formData.get("jobDescription") as string
  const resumeFile = formData.get("resume") as File

  if (!jobDescription || !resumeFile) {
    throw new Error("Missing job description or resume file")
  }

  // Extract text with positioning information
  const { text: resumeText, positions: textPositions } = await extractTextWithPositions(resumeFile)

  // Extract ATS keywords that are missing from the resume
  const keywordResult = await generateText({
    model: openai("gpt-4o"),
    system: `You are an ATS (Applicant Tracking System) expert. Compare the job description with the resume and identify important ATS keywords that are MISSING from the resume but are present in the job description.
    
    Focus on keywords that would improve ATS matching:
    - Technical skills and technologies not mentioned in resume
    - Industry-specific terms missing from resume
    - Required qualifications not highlighted in resume
    - Action verbs and competencies that could be added
    - Certifications and tools mentioned in job but not resume
    
    Return only a JSON array of strings representing missing keywords, no other text.`,
    prompt: `Job Description:
${jobDescription}

Resume Content:
${resumeText}

Extract ATS keywords that are missing from the resume but would be valuable to add:`,
  })

  let keywords: string[] = []
  try {
    keywords = JSON.parse(keywordResult.text)
  } catch {
    // Fallback parsing if JSON fails
    keywords = keywordResult.text
      .split("\n")
      .filter((k) => k.trim())
      .map((k) => k.replace(/[^\w\s]/g, "").trim())
      .filter(k => k.length > 0)
  }

  // Store original PDF buffer for later modification
  const resumeBuffer = await resumeFile.arrayBuffer()

  return {
    availableKeywords: keywords.slice(0, 20), // Limit to top 20 missing keywords
    resumeText,
    originalPdfBuffer: resumeBuffer,
    textPositions,
  }
}

export async function optimizeWithKeywords(
  resumeText: string,
  selectedKeywords: string[],
  textPositions?: TextPosition[]
): Promise<OptimizationResult> {
  if (!resumeText || !selectedKeywords.length) {
    throw new Error("Missing resume text or selected keywords")
  }

  // Get detailed changes for resume optimization with selected keywords only
  const changesResult = await generateText({
    model: openai("gpt-4o"),
    system: `You are a professional resume optimizer. You must respond with ONLY a valid JSON object - no other text.

    Analyze the resume and propose specific changes to integrate ONLY the provided keywords while preserving authenticity.

    Return this exact JSON structure:
    {
      "detailedChanges": [
        {
          "id": "change_1",
          "originalText": "original text segment from resume (15-40 words)",
          "modifiedText": "proposed modification with keyword naturally integrated", 
          "context": "where this appears (e.g., 'Skills section', 'Work experience')",
          "changeType": "keyword",
          "keywords": ["keyword1", "keyword2"]
        }
      ],
      "optimizedContent": "full resume text with all changes applied",
      "changes": ["Brief summary of what was changed"]
    }

    CRITICAL RULES:
    1. ONLY return valid JSON - no explanations, no markdown, no extra text
    2. Make 3-6 realistic changes that integrate the provided keywords
    3. Use actual text from the resume in "originalText" 
    4. Preserve authenticity and truthfulness
    5. Each change should naturally integrate 1-2 keywords
    6. Ensure "optimizedContent" has all changes applied`,
    prompt: `Resume:
${resumeText}

Keywords to integrate: ${selectedKeywords.join(", ")}

Return ONLY the JSON object with detailed changes:`,
  })

  let optimizationData
  try {
    optimizationData = JSON.parse(changesResult.text)
    
    // Ensure detailedChanges has proper structure
    if (!Array.isArray(optimizationData.detailedChanges)) {
      optimizationData.detailedChanges = []
    }
    
    // Add unique IDs and position mapping if missing
    optimizationData.detailedChanges = optimizationData.detailedChanges.map((change: any, index: number) => {
      const mappedChange = {
        id: change.id || `change_${index + 1}`,
        originalText: change.originalText || "",
        modifiedText: change.modifiedText || "",
        context: change.context || "Resume content",
        changeType: change.changeType || "keyword",
        keywords: Array.isArray(change.keywords) ? change.keywords : [],
        ...change
      }
      
      // Try to find position information for this change
      if (textPositions && change.originalText) {
        const position = findTextPosition(change.originalText, textPositions)
        if (position) {
          mappedChange.position = position
        }
      }
      
      return mappedChange
    })
    
  } catch (error) {
    console.error('Failed to parse optimization result:', error)
    console.log('Raw response:', changesResult.text)
    
    // Try to extract JSON from the response if it's wrapped in other text
    const jsonMatch = changesResult.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        optimizationData = JSON.parse(jsonMatch[0])
        console.log('Successfully extracted JSON from response')
        
        // Ensure detailedChanges has proper structure
        if (!Array.isArray(optimizationData.detailedChanges)) {
          optimizationData.detailedChanges = []
        }
        
        // Add unique IDs and position mapping if missing
        optimizationData.detailedChanges = optimizationData.detailedChanges.map((change: any, index: number) => {
          const mappedChange = {
            id: change.id || `change_${index + 1}`,
            originalText: change.originalText || "",
            modifiedText: change.modifiedText || "",
            context: change.context || "Resume content",
            changeType: change.changeType || "keyword",
            keywords: Array.isArray(change.keywords) ? change.keywords : [],
            ...change
          }
          
          // Try to find position information for this change
          if (textPositions && change.originalText) {
            const position = findTextPosition(change.originalText, textPositions)
            if (position) {
              mappedChange.position = position
            }
          }
          
          return mappedChange
        })
      } catch (secondError) {
        console.error('Second JSON parse failed:', secondError)
        // Final fallback - create sample changes for debugging
        optimizationData = {
          optimizedContent: changesResult.text,
          changes: ["Resume content has been optimized with selected keywords"],
          detailedChanges: [{
            id: "debug_change_1",
            originalText: "Sample original text",
            modifiedText: "Sample modified text with " + selectedKeywords.slice(0, 2).join(", "),
            context: "Debug change - AI response parsing failed",
            changeType: "keyword",
            keywords: selectedKeywords.slice(0, 2)
          }],
        }
      }
    } else {
      console.error('No JSON found in response')
      // Final fallback - create sample changes for debugging
      optimizationData = {
        optimizedContent: changesResult.text,
        changes: ["Resume content has been optimized with selected keywords"],
        detailedChanges: [{
          id: "debug_change_1",
          originalText: "Sample original text",
          modifiedText: "Sample modified text with " + selectedKeywords.slice(0, 2).join(", "),
          context: "Debug change - No JSON found in AI response",
          changeType: "keyword",
          keywords: selectedKeywords.slice(0, 2)
        }],
      }
    }
  }

  return {
    detailedChanges: optimizationData.detailedChanges || [],
    optimizedContent: optimizationData.optimizedContent || changesResult.text,
    changes: optimizationData.changes || ["Resume optimized with selected keywords"],
  }
}

export async function generateModifiedPDF(
  originalPdfBuffer: ArrayBuffer,
  selectedChanges: DetailedChange[],
  originalContent: string
): Promise<Uint8Array> {
  try {
    // Load the original PDF document
    const originalPdfDoc = await PDFDocument.load(originalPdfBuffer)
    const pages = originalPdfDoc.getPages()
    
    // Process each selected change
    for (const change of selectedChanges) {
      if (change.selected && change.position) {
        const page = pages[change.position.pageIndex]
        if (!page) continue
        
        // Get page dimensions
        const { width: pageWidth, height: pageHeight } = page.getSize()
        
        // Create a white rectangle to cover the original text
        page.drawRectangle({
          x: change.position.x - 2,
          y: pageHeight - change.position.y - change.position.height - 2,
          width: change.position.width + 4,
          height: change.position.height + 4,
          color: rgb(1, 1, 1), // White color
        })
        
        // Try to embed the original font or fallback to Helvetica
        let font
        try {
          font = await originalPdfDoc.embedFont('Helvetica')
        } catch {
          font = await originalPdfDoc.embedFont('Helvetica')
        }
        
        // Draw the new text at the same position
        page.drawText(change.modifiedText, {
          x: change.position.x,
          y: pageHeight - change.position.y - change.position.fontSize,
          size: change.position.fontSize,
          font: font,
          color: rgb(0, 0, 0),
        })
      }
    }
    
    return await originalPdfDoc.save()
    
  } catch (error: any) {
    console.error('Error generating modified PDF with positions:', error)
    
    // Fallback to improved simple approach if positioning fails
    try {
      return await generateSimpleModifiedPDF(originalPdfBuffer, selectedChanges, originalContent)
    } catch (fallbackError: any) {
      console.error('Fallback PDF generation also failed:', fallbackError)
      throw new Error(`Failed to generate modified PDF: ${error.message || 'Unknown error'}`)
    }
  }
}

async function generateSimpleModifiedPDF(
  originalPdfBuffer: ArrayBuffer,
  selectedChanges: DetailedChange[],
  originalContent: string
): Promise<Uint8Array> {
  // Load original PDF to preserve page size and basic structure
  const originalPdfDoc = await PDFDocument.load(originalPdfBuffer)
  const originalPages = originalPdfDoc.getPages()
  
  const newPdfDoc = await PDFDocument.create()
  
  // Apply selected changes to create modified content
  let modifiedContent = originalContent
  for (const change of selectedChanges) {
    if (change.selected) {
      modifiedContent = modifiedContent.replace(
        change.originalText,
        change.modifiedText
      )
    }
  }
  
  // Use original page dimensions if available
  const pageSize = originalPages[0] ? originalPages[0].getSize() : { width: 612, height: 792 }
  const page = newPdfDoc.addPage([pageSize.width, pageSize.height])
  
  // Improved text layout with better font and spacing
  const font = await newPdfDoc.embedFont('Helvetica')
  const fontSize = 11
  const margin = 50
  const lineHeight = fontSize * 1.2
  const maxWidth = pageSize.width - (margin * 2)
  
  const lines = modifiedContent.split('\n')
  let yPosition = pageSize.height - margin
  let currentPage = page
  
  for (const line of lines) {
    if (line.trim()) {
      // Handle long lines by wrapping them
      const words = line.split(' ')
      let currentLine = ''
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const textWidth = font.widthOfTextAtSize(testLine, fontSize)
        
        if (textWidth <= maxWidth) {
          currentLine = testLine
        } else {
          // Draw current line and start new one
          if (currentLine) {
            if (yPosition < margin) {
              currentPage = newPdfDoc.addPage([pageSize.width, pageSize.height])
              yPosition = pageSize.height - margin
            }
            
            currentPage.drawText(currentLine, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0),
            })
            yPosition -= lineHeight
          }
          currentLine = word
        }
      }
      
      // Draw remaining text
      if (currentLine) {
        if (yPosition < margin) {
          currentPage = newPdfDoc.addPage([pageSize.width, pageSize.height])
          yPosition = pageSize.height - margin
        }
        
        currentPage.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        })
      }
    }
    yPosition -= lineHeight
  }
  
  return await newPdfDoc.save()
}

function findTextPosition(searchText: string, positions: TextPosition[]): TextPosition | null {
  const cleanSearchText = searchText.trim().toLowerCase()
  
  // Try to find exact match first
  for (const pos of positions) {
    if (pos.text.toLowerCase().includes(cleanSearchText)) {
      return pos
    }
  }
  
  // Try to find partial substring matches
  for (const pos of positions) {
    const cleanPosText = pos.text.toLowerCase()
    if (cleanPosText.length > 10 && cleanSearchText.length > 5) {
      // Check if a significant portion of the search text is in this position
      const words = cleanSearchText.split(/\s+/)
      const matchedWords = words.filter(word => 
        word.length > 2 && cleanPosText.includes(word)
      )
      
      if (matchedWords.length >= Math.ceil(words.length * 0.6)) {
        return pos
      }
    }
  }
  
  // Try to find matches by combining adjacent positions
  const searchWords = cleanSearchText.split(/\s+/).filter(w => w.length > 2)
  if (searchWords.length > 1) {
    for (let i = 0; i < positions.length - 1; i++) {
      const combinedText = (positions[i].text + ' ' + positions[i + 1].text).toLowerCase()
      const matchedWords = searchWords.filter(word => combinedText.includes(word))
      
      if (matchedWords.length >= Math.ceil(searchWords.length * 0.5)) {
        // Return the position of the first item, but with extended width
        return {
          ...positions[i],
          width: (positions[i + 1].x + positions[i + 1].width) - positions[i].x
        }
      }
    }
  }
  
  // Final fallback: try to match individual significant words
  const significantWords = searchWords.filter(w => w.length > 4)
  for (const word of significantWords) {
    for (const pos of positions) {
      if (pos.text.toLowerCase().includes(word)) {
        return pos
      }
    }
  }
  
  return null
}

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // Convert File to Buffer for pdf-parse
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Extract text from PDF using pdf-parse
    const pdfData = await pdf(buffer)
    return pdfData.text || ''
  } catch (error: any) {
    console.error('Error parsing PDF:', error)
    // Handle the specific error where pdf-parse tries to access non-existent files
    if (error.code === 'ENOENT' || error.message?.includes('ENOENT') || error.message?.includes('test/data')) {
      throw new Error('Failed to process PDF. The file may be corrupted or in an unsupported format.')
    }
    throw new Error(`Failed to extract text from PDF: ${error.message || 'Unknown error'}`)
  }
}

async function extractTextWithPositions(file: File): Promise<{ text: string; positions: TextPosition[] }> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Extract text using pdf-parse
    const pdfData = await pdf(buffer)
    const text = pdfData.text || ''
    
    // Since we can't get precise positioning from pdf-parse in server environment,
    // we'll create estimated positions based on text analysis
    const positions = estimateTextPositions(text)
    
    return { text, positions }
  } catch (error: any) {
    console.error('Error extracting text with positions:', error)
    // Fallback to simple text extraction
    const fallbackText = await extractTextFromPDF(file)
    return { text: fallbackText, positions: [] }
  }
}

function estimateTextPositions(text: string): TextPosition[] {
  const positions: TextPosition[] = []
  const lines = text.split('\n')
  let currentY = 750 // Start from top of page
  const lineHeight = 14
  const fontSize = 12
  const margin = 50
  
  lines.forEach((line, lineIndex) => {
    if (line.trim()) {
      // Split line into words and create positions for text segments
      const words = line.trim().split(/\s+/)
      let currentX = margin
      
      // Create position for the entire line (this will be used for matching)
      if (words.length > 0) {
        positions.push({
          x: currentX,
          y: currentY,
          width: line.length * 6, // Estimated width
          height: lineHeight,
          fontName: 'Helvetica',
          fontSize: fontSize,
          text: line.trim(),
          pageIndex: Math.floor(lineIndex * lineHeight / 700) // Rough page estimation
        })
      }
      
      // Also create positions for individual words (for better matching)
      words.forEach(word => {
        if (word.length > 2) { // Only for meaningful words
          positions.push({
            x: currentX,
            y: currentY,
            width: word.length * 6,
            height: lineHeight,
            fontName: 'Helvetica',
            fontSize: fontSize,
            text: word,
            pageIndex: Math.floor(lineIndex * lineHeight / 700)
          })
          currentX += word.length * 6 + 6 // Estimated spacing
        }
      })
    }
    currentY -= lineHeight
  })
  
  return positions
}
