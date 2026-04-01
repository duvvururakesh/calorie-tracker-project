import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  fullWidth?: boolean
}

export default function Button({
  loading,
  loadingText = 'Saving…',
  fullWidth = true,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`${fullWidth ? 'w-full' : ''} py-3 rounded-xl font-bold bg-lime text-black
        hover:brightness-110 transition-all
        disabled:opacity-60 disabled:cursor-not-allowed
        ${className}`}
      {...props}
    >
      {loading ? loadingText : children}
    </button>
  )
}
