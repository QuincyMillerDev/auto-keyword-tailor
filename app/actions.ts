"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import pdf from 'pdf-parse'
import { PDFDocument, rgb } from 'pdf-lib'

export interface DetailedChange {
  id: string
  originalText: string
  modifiedText: string
  context: string
  changeType: 'keyword' | 'phrasing' | 'enhancement'
  keywords: string[]
  selected?: boolean
}

export interface KeywordExtractionResult {
  availableKeywords: string[]
  resumeText: string
  originalPdfBuffer: ArrayBuffer
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

  // Extract text from PDF using pdf-parse library
  const resumeText = await extractTextFromPDF(resumeFile)

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
  }
}

export async function optimizeWithKeywords(
  resumeText: string,
  selectedKeywords: string[]
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
    
    // Add unique IDs if missing
    optimizationData.detailedChanges = optimizationData.detailedChanges.map((change: any, index: number) => ({
      id: change.id || `change_${index + 1}`,
      originalText: change.originalText || "",
      modifiedText: change.modifiedText || "",
      context: change.context || "Resume content",
      changeType: change.changeType || "keyword",
      keywords: Array.isArray(change.keywords) ? change.keywords : [],
      ...change
    }))
    
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
        
        // Add unique IDs if missing
        optimizationData.detailedChanges = optimizationData.detailedChanges.map((change: any, index: number) => ({
          id: change.id || `change_${index + 1}`,
          originalText: change.originalText || "",
          modifiedText: change.modifiedText || "",
          context: change.context || "Resume content",
          changeType: change.changeType || "keyword",
          keywords: Array.isArray(change.keywords) ? change.keywords : [],
          ...change
        }))
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
    // For now, we'll create a simple text-based approach
    // In a more sophisticated implementation, we would:
    // 1. Load the original PDF and extract text positioning information
    // 2. Find and replace text at specific coordinates  
    // 3. Maintain formatting and layout
    
    // Create a new document with the modified content
    const newPdfDoc = await PDFDocument.create()
    const page = newPdfDoc.addPage([612, 792]) // Standard letter size
    
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
    
    // Add text to the new PDF (simplified implementation)
    const fontSize = 11
    const font = await newPdfDoc.embedFont('Helvetica')
    const lines = modifiedContent.split('\n')
    let yPosition = 750
    const margin = 50
    const lineHeight = fontSize + 2
    
    for (const line of lines) {
      if (yPosition < margin) {
        // Add new page if content exceeds current page
        const newPage = newPdfDoc.addPage([612, 792])
        yPosition = 750
        newPage.drawText(line, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        })
      } else {
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        })
      }
      yPosition -= lineHeight
    }
    
    return await newPdfDoc.save()
    
  } catch (error: any) {
    console.error('Error generating modified PDF:', error)
    throw new Error(`Failed to generate modified PDF: ${error.message || 'Unknown error'}`)
  }
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
