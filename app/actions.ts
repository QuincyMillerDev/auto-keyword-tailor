"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function optimizeResume(formData: FormData) {
  const jobDescription = formData.get("jobDescription") as string
  const resumeFile = formData.get("resume") as File

  if (!jobDescription || !resumeFile) {
    throw new Error("Missing job description or resume file")
  }

  // Extract text from PDF (simplified - in production you'd use a proper PDF parser)
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
  // Simplified PDF text extraction
  // In production, you would use a proper PDF parsing library like pdf-parse
  const arrayBuffer = await file.arrayBuffer()
  const text = new TextDecoder().decode(arrayBuffer)

  // This is a very basic extraction - in reality you'd need proper PDF parsing
  // For now, we'll simulate extracted resume content
  return `
JOHN DOE
Software Engineer
Email: john.doe@email.com | Phone: (555) 123-4567

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years developing web applications and systems. Skilled in multiple programming languages and frameworks with a focus on creating efficient, scalable solutions.

TECHNICAL SKILLS
• Programming Languages: JavaScript, Python, Java
• Web Technologies: React, Node.js, HTML, CSS
• Databases: MySQL, PostgreSQL, MongoDB
• Tools: Git, Docker, AWS

PROFESSIONAL EXPERIENCE

Senior Software Engineer | Tech Company | 2021 - Present
• Developed and maintained web applications serving 100k+ users
• Collaborated with cross-functional teams to deliver features on time
• Implemented automated testing procedures improving code quality
• Optimized database queries reducing response time by 40%

Software Engineer | StartupCo | 2019 - 2021
• Built responsive web interfaces using modern JavaScript frameworks
• Participated in code reviews and maintained coding standards
• Worked with APIs and third-party integrations
• Contributed to system architecture decisions

EDUCATION
Bachelor of Science in Computer Science
University of Technology | 2019

CERTIFICATIONS
• AWS Certified Developer Associate
• Google Cloud Professional Developer
  `.trim()
}
