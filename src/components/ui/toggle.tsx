import * as React from 'react'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const toggleVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
				outline: 'border border-input bg-background shadow-sm hover:text-accent',
				ghost: cn(
					'border border-transparent hover:border hover:border-neutral-800 hover:text-neutral-50',
					'data-[state=on]:border-neutral-800 data-[state=on]:text-neutral-50 data-[state=on]:bg-neutral-800 '
				),
			},
			size: {
				default: 'h-9 px-4 py-2',
				sm: 'h-8 rounded-md px-3 text-sm',
				lg: 'h-10 rounded-md px-8',
				icon: 'h-9 w-9',
			},
		},
		defaultVariants: {
			variant: 'ghost',
			size: 'icon',
		},
	}
)

export interface ToggleProps
	extends React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>, VariantProps<typeof toggleVariants> {}

const Toggle = React.forwardRef<React.ElementRef<typeof TogglePrimitive.Root>, ToggleProps>(
	({ className, variant, size, ...props }, ref) => (
		<TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
	)
)
Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
