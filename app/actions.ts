"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import pdf from 'pdf-parse'

export async function optimizeResume(formData: FormData) {
  const jobDescription = formData.get("jobDescription") as string
  const resumeFile = formData.get("resume") as File

  if (!jobDescription || !resumeFile) {
    throw new Error("Missing job description or resume file")
  }

  // Extract text from PDF using pdf-parse library
  const resumeText = await extractTextFromPDF(resumeFile)

  // Step 1: Extract ATS keywords from job description
  const keywordResult = await generateText({
    model: openai("gpt-4o"),
    system: `You are an ATS (Applicant Tracking System) expert. Extract the most important keywords and phrases that an ATS would look for from job descriptions. Focus on:
    - Technical skills and technologies
    - Industry-specific terms
    - Required qualifications
    - Action verbs and competencies
    - Certifications and tools
    
    Return only a JSON array of strings, no other text.`,
    prompt: `Extract ATS keywords from this job description:\n\n${jobDescription}`,
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
  }

  // Step 2: Optimize resume content with keywords
  const optimizationResult = await generateText({
    model: openai("gpt-4o"),
    system: `You are a professional resume optimizer. Your task is to integrate ATS keywords into a resume while:
    1. Preserving the original meaning and context
    2. Making minimal but meaningful changes
    3. Ensuring the content remains truthful and authentic
    4. Maintaining professional language and flow
    5. Not adding false information or skills
    
    Focus on:
    - Rephrasing existing sentences to include keywords naturally
    - Using synonyms and related terms
    - Enhancing bullet points with relevant keywords
    - Maintaining the original structure and formatting
    
    Return a JSON object with:
    - "optimizedContent": the full optimized resume text
    - "changes": array of strings describing what changes were made`,
    prompt: `Optimize this resume by integrating these ATS keywords: ${keywords.join(", ")}

Resume content:
${resumeText}

Keywords to integrate: ${JSON.stringify(keywords)}`,
  })

  let optimizationData
  try {
    optimizationData = JSON.parse(optimizationResult.text)
  } catch {
    // Fallback if JSON parsing fails
    optimizationData = {
      optimizedContent: optimizationResult.text,
      changes: ["Resume content has been optimized with ATS keywords"],
    }
  }

  return {
    keywords: keywords.slice(0, 15), // Limit to top 15 keywords
    optimizedContent: optimizationData.optimizedContent || optimizationResult.text,
    changes: optimizationData.changes || ["Resume optimized with relevant keywords"],
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
