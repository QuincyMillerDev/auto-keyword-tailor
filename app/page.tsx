"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, FileText, Zap, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { optimizeResume } from "./actions"

interface OptimizationResult {
  keywords: string[]
  optimizedContent: string
  changes: string[]
}

export default function ATSOptimizer() {
  const [jobDescription, setJobDescription] = useState("")
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [currentStep, setCurrentStep] = useState(1)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setResumeFile(file)
      setCurrentStep(2)
    }
  }

  const handleOptimize = async () => {
    if (!jobDescription.trim() || !resumeFile) return

    setIsProcessing(true)
    setCurrentStep(3)

    try {
      const formData = new FormData()
      formData.append("jobDescription", jobDescription)
      formData.append("resume", resumeFile)

      const optimizationResult = await optimizeResume(formData)
      setResult(optimizationResult)
      setCurrentStep(4)
    } catch (error) {
      console.error("Optimization failed:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const resetForm = () => {
    setJobDescription("")
    setResumeFile(null)
    setResult(null)
    setCurrentStep(1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">ATS Resume Optimizer</h1>
          <p className="text-slate-600 text-lg">
            Intelligently optimize your resume with AI-powered keyword integration
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          {[
            { step: 1, label: "Job Description", icon: FileText },
            { step: 2, label: "Upload Resume", icon: Upload },
            { step: 3, label: "AI Processing", icon: Zap },
            { step: 4, label: "Optimized Result", icon: CheckCircle },
          ].map(({ step, label, icon: Icon }) => (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-slate-300 text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className={`ml-2 text-sm font-medium ${currentStep >= step ? "text-slate-900" : "text-slate-400"}`}>
                {label}
              </span>
              {step < 4 && <div className="w-8 h-px bg-slate-300 ml-4" />}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <div className="space-y-6">
            <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Job Description
                </CardTitle>
                <CardDescription>Paste the job description to extract ATS keywords</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Paste the complete job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[200px] resize-none border-slate-200 focus:border-blue-500"
                />
                <div className="mt-2 text-sm text-slate-500">{jobDescription.length} characters</div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Resume Upload
                </CardTitle>
                <CardDescription>Upload your resume in PDF format</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="resume-upload" className="text-sm font-medium">
                      Select PDF File
                    </Label>
                    <Input
                      id="resume-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="mt-1 border-slate-200 focus:border-blue-500"
                    />
                  </div>
                  {resumeFile && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">{resumeFile.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {(resumeFile.size / 1024 / 1024).toFixed(1)} MB
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleOptimize}
              disabled={!jobDescription.trim() || !resumeFile || isProcessing}
              className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Optimizing Resume...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Optimize Resume
                </>
              )}
            </Button>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {result ? (
              <>
                <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-green-700">Optimization Complete</CardTitle>
                    <CardDescription>Your resume has been optimized with ATS keywords</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Extracted Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.keywords.map((keyword, index) => (
                          <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Key Changes Made</h4>
                      <ul className="space-y-1">
                        {result.changes.map((change, index) => (
                          <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle>Optimized Resume Content</CardTitle>
                    <CardDescription>Review and copy your optimized resume</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-slate-800 font-mono">
                        {result.optimizedContent}
                      </pre>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={() => navigator.clipboard.writeText(result.optimizedContent)}
                        variant="outline"
                        className="flex-1"
                      >
                        Copy to Clipboard
                      </Button>
                      <Button onClick={resetForm} variant="outline">
                        Start Over
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Zap className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Ready to Optimize</h3>
                  <p className="text-slate-600 max-w-sm">
                    Upload your job description and resume to get started with AI-powered ATS optimization.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
