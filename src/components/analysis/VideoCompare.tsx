interface VideoCompareProps {
  videoAUrl: string
  videoBUrl: string
  modelA: string
  modelB: string
}

export function VideoCompare({ videoAUrl, videoBUrl, modelA, modelB }: VideoCompareProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Video A */}
      <div className="relative">
        <video
          src={videoAUrl}
          controls
          className="w-full aspect-video rounded-xl bg-black"
          playsInline
        />
        <div className="absolute top-3 left-3 px-3 py-1.5 bg-accent-600/90 backdrop-blur-sm rounded-lg text-xs font-bold text-white shadow-lg">
          A: {modelA}
        </div>
      </div>
      
      {/* Video B */}
      <div className="relative">
        <video
          src={videoBUrl}
          controls
          className="w-full aspect-video rounded-xl bg-black"
          playsInline
        />
        <div className="absolute top-3 left-3 px-3 py-1.5 bg-orange-600/90 backdrop-blur-sm rounded-lg text-xs font-bold text-white shadow-lg">
          B: {modelB}
        </div>
      </div>
    </div>
  )
}
