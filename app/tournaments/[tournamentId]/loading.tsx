export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-gray-200 rounded w-1/3"></div>
        <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}