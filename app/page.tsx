"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, FileText, Zap, CheckCircle, Download, ArrowLeft, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel"
import { extractKeywords, optimizeWithKeywords, generateModifiedPDF, DetailedChange, OptimizationResult, KeywordExtractionResult } from "./actions"


export default function ATSOptimizer() {
  const [jobDescription, setJobDescription] = useState("")
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [keywordResults, setKeywordResults] = useState<KeywordExtractionResult | null>(null)
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [selectedChanges, setSelectedChanges] = useState<DetailedChange[]>([])
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setResumeFile(file)
      goToStep(2)
    }
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
    carouselApi?.scrollTo(step - 1)
  }

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1)
    }
  }

  const goToNextStep = () => {
    goToStep(currentStep + 1)
  }

  const handleExtractKeywords = async () => {
    if (!jobDescription.trim() || !resumeFile) return

    setIsProcessing(true)
    goToStep(3)

    try {
      const formData = new FormData()
      formData.append("jobDescription", jobDescription)
      formData.append("resume", resumeFile)

      const results = await extractKeywords(formData)
      setKeywordResults(results)
      goToStep(4)
    } catch (error) {
      console.error("Keyword extraction failed:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOptimizeWithSelectedKeywords = async () => {
    if (!keywordResults || !selectedKeywords.length) return

    setIsProcessing(true)
    goToStep(5)

    try {
      const results = await optimizeWithKeywords(keywordResults.resumeText, selectedKeywords)
      setOptimizationResult(results)
      // Initialize all changes as selected
      const initialChanges = results.detailedChanges.map((change: DetailedChange) => ({
        ...change,
        selected: true
      }))
      setSelectedChanges(initialChanges)
    } catch (error) {
      console.error("Optimization failed:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const resetForm = () => {
    setJobDescription("")
    setResumeFile(null)
    setKeywordResults(null)
    setSelectedKeywords([])
    setOptimizationResult(null)
    setSelectedChanges([])
    goToStep(1)
  }

  const handleKeywordSelection = (keyword: string) => {
    setSelectedKeywords(prev => 
      prev.includes(keyword) 
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    )
  }

  const handleSelectAllKeywords = () => {
    if (!keywordResults) return
    setSelectedKeywords(keywordResults.availableKeywords)
  }

  const handleSelectNoKeywords = () => {
    setSelectedKeywords([])
  }

  const handleChangeSelection = (changeId: string, selected: boolean) => {
    setSelectedChanges(prev => prev.map(change => 
      change.id === changeId ? { ...change, selected } : change
    ))
  }

  const handleDownloadPDF = async () => {
    if (!keywordResults || !optimizationResult || !selectedChanges.length) return
    
    setIsGeneratingPDF(true)
    try {
      const pdfBytes = await generateModifiedPDF(
        keywordResults.originalPdfBuffer,
        selectedChanges,
        optimizationResult.optimizedContent
      )
      
      // Create download link
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'optimized-resume.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      goToStep(6)
    } catch (error) {
      console.error('Failed to generate PDF:', error)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleRetryOptimization = async () => {
    if (!keywordResults || !selectedKeywords.length) return
    await handleOptimizeWithSelectedKeywords()
  }

  const handleSelectAll = () => {
    setSelectedChanges(prev => prev.map(change => ({ ...change, selected: true })))
  }

  const handleSelectNone = () => {
    setSelectedChanges(prev => prev.map(change => ({ ...change, selected: false })))
  }

  const getNextButtonText = () => {
    switch (currentStep) {
      case 1: return "Continue"
      case 2: return "Extract Keywords"
      case 4: return `Optimize with ${selectedKeywords.length} Keywords`
      case 5: return "Download PDF"
      default: return "Next"
    }
  }

  const getNextButtonAction = () => {
    switch (currentStep) {
      case 1: return () => goToNextStep()
      case 2: return handleExtractKeywords
      case 4: return handleOptimizeWithSelectedKeywords
      case 5: return handleDownloadPDF
      default: return () => goToNextStep()
    }
  }

  const canGoNext = () => {
    switch (currentStep) {
      case 1: return jobDescription.trim().length > 0
      case 2: return resumeFile !== null
      case 4: return selectedKeywords.length > 0
      case 5: return selectedChanges.some(c => c.selected)
      case 6: return false
      default: return true
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
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
            { step: 3, label: "Extract Keywords", icon: Zap },
            { step: 4, label: "Select Keywords", icon: CheckCircle },
            { step: 5, label: "Review Changes", icon: CheckCircle },
            { step: 6, label: "Download PDF", icon: Download },
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
              {step < 6 && <div className="w-8 h-px bg-slate-300 ml-4" />}
            </div>
          ))}
        </div>

        {/* Main Carousel */}
        <div className="relative">
          <Carousel
            setApi={setCarouselApi}
            className="w-full"
            opts={{
              align: "start",
              dragFree: false,
              skipSnaps: false,
            }}
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {/* Stage 1: Job Description */}
              <CarouselItem className="pl-2 md:pl-4">
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
                      className="min-h-[300px] resize-none border-slate-200 focus:border-blue-500"
                    />
                    <div className="mt-2 text-sm text-slate-500">{jobDescription.length} characters</div>
                  </CardContent>
                </Card>
              </CarouselItem>

              {/* Stage 2: Resume Upload */}
              <CarouselItem className="pl-2 md:pl-4">
                <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-blue-600" />
                      Resume Upload
                    </CardTitle>
                    <CardDescription>Upload your resume in PDF format</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
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
                        <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-blue-900 block">{resumeFile.name}</span>
                            <span className="text-xs text-blue-700">
                              {(resumeFile.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </div>
                          <Badge variant="secondary">
                            Ready
                          </Badge>
                        </div>
                      )}
                      {!resumeFile && (
                        <div className="text-center py-12 text-slate-500">
                          <Upload className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                          <p>Choose a PDF file to continue</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>

              {/* Stage 3: Processing */}
              <CarouselItem className="pl-2 md:pl-4">
                <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                    <h3 className="text-xl font-medium text-slate-900 mb-2">Extracting Keywords</h3>
                    <p className="text-slate-600 max-w-sm">
                      AI is analyzing your job description and resume to identify relevant ATS keywords...
                    </p>
                  </CardContent>
                </Card>
              </CarouselItem>

              {/* Stage 4: Keyword Selection */}
              <CarouselItem className="pl-2 md:pl-4">
                <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-blue-700">Select Keywords to Add</CardTitle>
                    <CardDescription>Choose which keywords you want to incorporate into your resume</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {keywordResults ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-slate-900">Available Keywords</h4>
                            <div className="flex gap-2">
                              <Button
                                onClick={handleSelectAllKeywords}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                Select All
                              </Button>
                              <Button
                                onClick={handleSelectNoKeywords}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                Select None
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                            {keywordResults.availableKeywords.map((keyword, index) => (
                              <Badge 
                                key={index} 
                                variant={selectedKeywords.includes(keyword) ? "default" : "outline"}
                                className={`transition-colors cursor-pointer ${
                                  selectedKeywords.includes(keyword) 
                                    ? "bg-blue-600 text-white" 
                                    : "bg-white text-slate-700 hover:bg-blue-50"
                                }`}
                                onClick={() => handleKeywordSelection(keyword)}
                              >
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-sm text-slate-500 mt-2">
                            {selectedKeywords.length} of {keywordResults.availableKeywords.length} keywords selected
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <Zap className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p>Extract keywords first to see available options</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>

              {/* Stage 5: Review Changes */}
              <CarouselItem className="pl-2 md:pl-4">
                <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-green-700">Review Proposed Changes</CardTitle>
                    <CardDescription>Select which changes you want to apply to your resume</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {optimizationResult ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-slate-900">Proposed Changes</h4>
                            <div className="flex gap-2">
                              <Button
                                onClick={handleSelectAll}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                Select All
                              </Button>
                              <Button
                                onClick={handleSelectNone}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                Select None
                              </Button>
                              <Button
                                onClick={handleRetryOptimization}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                Try Again
                              </Button>
                            </div>
                          </div>
                          {selectedChanges.length > 0 ? (
                            <div className="space-y-4 max-h-80 overflow-y-auto">
                              {selectedChanges.map((change) => (
                                <div key={change.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                  <div className="flex items-center gap-3 p-3 bg-slate-50 border-b border-slate-200">
                                    <Checkbox
                                      checked={change.selected}
                                      onCheckedChange={(checked) => 
                                        handleChangeSelection(change.id, checked as boolean)
                                      }
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                      <Badge 
                                        variant={change.changeType === 'keyword' ? 'default' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {change.changeType}
                                      </Badge>
                                      <span className="text-sm text-slate-600 font-medium">{change.context}</span>
                                    </div>
                                    {change.keywords.length > 0 && (
                                      <div className="flex gap-1 flex-wrap">
                                        {change.keywords.map((keyword, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                            {keyword}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="font-mono text-sm">
                                    <div className="flex">
                                      <div className="w-8 bg-red-50 text-red-500 text-center py-2 text-xs">-</div>
                                      <div className="flex-1 bg-red-50 text-red-800 py-2 px-3 border-l-2 border-red-200">
                                        {change.originalText}
                                      </div>
                                    </div>
                                    
                                    <div className="flex">
                                      <div className="w-8 bg-green-50 text-green-500 text-center py-2 text-xs">+</div>
                                      <div className="flex-1 bg-green-50 text-green-800 py-2 px-3 border-l-2 border-green-200">
                                        {change.modifiedText}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-600">No detailed changes available</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p>Optimize your resume first to see proposed changes</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>

              {/* Stage 6: Completion */}
              <CarouselItem className="pl-2 md:pl-4">
                <Card className="shadow-sm border-0 bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-green-700 flex items-center gap-2">
                      <Download className="w-5 h-5" />
                      PDF Generated Successfully!
                    </CardTitle>
                    <CardDescription>Your optimized resume has been downloaded</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-6" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">Resume Optimized!</h3>
                      <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                        Your resume has been optimized with {selectedChanges.filter(c => c.selected).length} selected changes
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button onClick={handleDownloadPDF} variant="outline" disabled={isGeneratingPDF}>
                          {isGeneratingPDF ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Download Again
                            </>
                          )}
                        </Button>
                        <Button onClick={resetForm} variant="outline">
                          Start Over
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            </CarouselContent>
          </Carousel>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-6">
            <Button
              onClick={goToPreviousStep}
              disabled={currentStep === 1 || isProcessing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div className="text-sm text-slate-500">
              Step {currentStep} of 6
            </div>

            <Button
              onClick={getNextButtonAction()}
              disabled={!canGoNext() || isProcessing || isGeneratingPDF}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing || isGeneratingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {currentStep === 3 ? "Extracting..." : currentStep === 5 && isGeneratingPDF ? "Generating..." : "Processing..."}
                </>
              ) : (
                <>
                  {getNextButtonText()}
                  {currentStep < 6 && <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
