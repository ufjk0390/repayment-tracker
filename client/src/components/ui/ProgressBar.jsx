import { clsx } from 'clsx';

const colorClasses = {
  indigo: 'bg-indigo-600',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  blue: 'bg-blue-500',
};

export default function ProgressBar({
  value = 0,
  max = 100,
  color = 'indigo',
  showLabel = true,
  className = '',
  size = 'md',
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-4' : 'h-2.5';

  return (
    <div className={clsx('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className={clsx('w-full bg-gray-200 rounded-full', heightClass)}>
        <div
          className={clsx(
            'rounded-full transition-all duration-500',
            heightClass,
            colorClasses[color] || colorClasses.indigo
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
