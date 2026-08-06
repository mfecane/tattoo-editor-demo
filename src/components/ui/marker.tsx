import * as React from 'react'

import { cn } from '@/lib/utils'

const Marker = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				'inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs',
				className
			)}
			{...props}
		/>
	)
)
Marker.displayName = 'Marker'

const MarkerIcon = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
	({ className, ...props }, ref) => (
		<span
			ref={ref}
			className={cn('flex items-center justify-center text-green-500 [&_svg]:size-3.5', className)}
			{...props}
		/>
	)
)
MarkerIcon.displayName = 'MarkerIcon'

const MarkerContent = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
	({ className, ...props }, ref) => (
		<span ref={ref} className={cn('text-neutral-300', className)} {...props} />
	)
)
MarkerContent.displayName = 'MarkerContent'

export { Marker, MarkerIcon, MarkerContent }
