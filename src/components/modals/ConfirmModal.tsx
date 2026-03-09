import { Button } from '@/components/ui/button'
import React from 'react'

interface ConfirmModalProps {
	isOpen: boolean
	title: string
	description: string
	confirmText: string
	cancelText: string
	confirmVariant?: 'danger' | 'default'
	onConfirm: () => void
	onCancel: () => void
}

export default function ConfirmModal({
	isOpen,
	title,
	description,
	confirmText,
	cancelText,
	confirmVariant = 'default',
	onConfirm,
	onCancel,
}: ConfirmModalProps) {
	if (!isOpen) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div className="fixed inset-0 bg-black/50" onClick={onCancel} />

			{/* Modal */}
			<div className="relative z-50 w-full max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-lg">
				<h2 className="mb-2 text-lg font-semibold text-gray-100">{title}</h2>
				<p className="mb-6 text-sm text-gray-400">{description}</p>

				<div className="flex justify-end gap-3">
					<Button variant="outline" onClick={onCancel}>
						{cancelText}
					</Button>
					<Button variant={confirmVariant === 'danger' ? 'destructive' : 'default'} onClick={onConfirm}>
						{confirmText}
					</Button>
				</div>
			</div>
		</div>
	)
}
