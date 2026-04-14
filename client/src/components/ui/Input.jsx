import { clsx } from 'clsx';
import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, error, className = '', type = 'text', id, ...props },
  ref
) {
  const inputId = id || label?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={clsx(
          'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
          'placeholder:text-gray-400',
          error
            ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 text-gray-900',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});

export default Input;
