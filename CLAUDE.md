# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application that serves as an ATS (Applicant Tracking System) Resume Optimizer. The application allows users to:
1. Paste a job description
2. Upload a resume (PDF format)
3. Extract keywords from the job description using AI
4. Optimize the resume content to incorporate those keywords in a truthful way
**IMPORTANT**: The formatting of the resume should NOT change after running through this application. Resume tailoring is done intelligently, 
where the LLM identifies parts of the text that are best suited to incorporate the keyword without adding uncessary formatting or changing the original meaning too much behind the sentences.

The application uses:
- Next.js 15 with React Server Components and Server Actions
- TypeScript for type safety
- Tailwind CSS for styling
- Shadcn/ui components for UI elements
- AI SDK with OpenAI integration for keyword extraction and resume optimization
- Lucide React for icons

## Common Development Commands

```bash
# Install dependencies
bun install

# Run development server
bun dev

# Build for production
bun build

# Run linting
bun lint

# Start production server
bun start
```

## Bun Configuration

This project uses Bun as its package manager and runtime. The `bunfig.toml` file contains configuration options to optimize Bun's behavior for this Next.js project.

Key configuration points:
- Uses the default npm registry
- Allows scripts to run properly with Next.js

## Code Architecture

### Key Files and Directories

- `app/page.tsx` - Main application UI with step-by-step workflow
- `app/actions.ts` - Server actions for AI processing (keyword extraction and resume optimization)
- `components/ui/` - Shadcn/ui components
- `lib/utils.ts` - Utility functions (likely contains cn() for Tailwind class merging)

### Data Flow

1. User provides job description and uploads resume
2. Client-side form collects data and sends to server action
3. Server action (`optimizeResume`) processes the data:
   - Extracts text from PDF (simplified implementation)
   - Uses AI to extract relevant ATS keywords from job description
   - Uses AI to optimize resume content with those keywords
4. Results are displayed to user with extracted keywords and optimized content

### Important Implementation Details

- Uses React Server Actions for backend processing (no separate API routes)
- AI processing happens in two steps: keyword extraction then resume optimization
- The PDF text extraction is currently a simplified implementation that should be replaced with a proper PDF parsing library in production
- UI uses a step-by-step workflow with visual progress indicators
- Tailwind CSS with shadcn/ui components for styling
- Responsive design with mobile support