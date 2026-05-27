// [Enhancement #7] Loading skeleton — giữ layout ổn định khi đang fetch
export function LoadingSkeleton() {
  return (
    <div className="mt-8 space-y-4" aria-busy="true" aria-label="Đang tải kết quả...">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 border-l-4 border-gray-200 dark:border-gray-700 animate-pulse"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
          </div>
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
