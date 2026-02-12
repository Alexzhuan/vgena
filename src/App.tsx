import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAnnotationStore } from './stores/annotationStore'
import { TaskLoader } from './components/TaskLoader/TaskLoader'
import { PairAnnotation } from './components/PairAnnotation/PairAnnotation'
import { ScoreAnnotation } from './components/ScoreAnnotation/ScoreAnnotation'
import { Header } from './components/common/Header'
import { AnalysisLayout } from './components/analysis'
import { 
  AnalysisDashboard, 
  AnalysisResults, 
  AnalysisModels, 
  AnalysisConsistency,
  AnalysisQA,
  AnalysisQCResults,
} from './pages/analysis'
import type { PairSample, ScoreSample } from './types'

// Annotation Platform Home Page
function AnnotationHome() {
  const { taskPackage, currentSampleIndex } = useAnnotationStore()

  // No task loaded - show task loader
  if (!taskPackage) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-8">
          <TaskLoader />
        </main>
      </div>
    )
  }

  const currentSample = taskPackage.samples[currentSampleIndex]

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        {taskPackage.mode === 'pair' ? (
          <PairAnnotation sample={currentSample as PairSample} />
        ) : (
          <ScoreAnnotation sample={currentSample as ScoreSample} />
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter basename="/vgena">
      <Routes>
        {/* Annotation Platform */}
        <Route path="/" element={<AnnotationHome />} />
        
        {/* Analysis Dashboard */}
        <Route path="/analysis" element={<AnalysisLayout />}>
          <Route index element={<AnalysisDashboard />} />
          <Route path="results" element={<AnalysisResults />} />
          <Route path="models" element={<AnalysisModels />} />
          <Route path="consistency" element={<AnalysisConsistency />} />
          <Route path="qa" element={<AnalysisQA />} />
          <Route path="qc-results" element={<AnalysisQCResults />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
