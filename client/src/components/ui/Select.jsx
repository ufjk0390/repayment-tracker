import { clsx } from 'clsx';
import { forwardRef } from 'react';

const Select = forwardRef(function Select(
  { label, error, options = [], className = '', id, placeholder, ...props },
  ref
) {
  const selectId = id || label?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={clsx(
          'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
          error
            ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 text-gray-900',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});

export default Select;
