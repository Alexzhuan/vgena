import { useAnnotationStore } from './stores/annotationStore'
import { TaskLoader } from './components/TaskLoader/TaskLoader'
import { PairAnnotation } from './components/PairAnnotation/PairAnnotation'
import { ScoreAnnotation } from './components/ScoreAnnotation/ScoreAnnotation'
import { Header } from './components/common/Header'
import type { PairSample, ScoreSample } from './types'

function App() {
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

export default App
