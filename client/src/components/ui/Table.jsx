import { clsx } from 'clsx';

export default function Table({ children, className = '' }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }) {
  return <thead className="bg-gray-50">{children}</thead>;
}

export function Tbody({ children }) {
  return (
    <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
  );
}

export function Th({ children, className = '' }) {
  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return (
    <td
      className={clsx(
        'px-4 py-3 text-sm text-gray-700 whitespace-nowrap',
        className
      )}
    >
      {children}
    </td>
  );
}
