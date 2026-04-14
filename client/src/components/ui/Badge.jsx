import { clsx } from 'clsx';

const colorMap = {
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
  indigo: 'bg-indigo-100 text-indigo-800',
};

export default function Badge({ children, color = 'gray', className = '' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorMap[color] || colorMap.gray,
        className
      )}
    >
      {children}
    </span>
  );
}
