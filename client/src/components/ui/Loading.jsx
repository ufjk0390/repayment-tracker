import { Loader2 } from 'lucide-react';

export default function Loading({ message = '載入中...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
