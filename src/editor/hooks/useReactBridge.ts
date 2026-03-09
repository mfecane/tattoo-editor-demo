import { ReactBridge } from '@/editor/main/ReactBridge'
import { useEditorStore } from '@/editor/store/editorStore'
import { createContext, useContext, useEffect, useState } from 'react'

export function useReactBridge(): ReactBridge | null {
	const editor = useEditorStore((state) => state.editor)
	const reactBridge = editor?.reactBridge ?? null

	const [, setTick] = useState(0)

	useEffect(() => {
		if (!reactBridge) return
		return reactBridge.subscribe(() => setTick((t) => t + 1))
	}, [reactBridge])

	return reactBridge
}

export const ReactBridgeContext = createContext<ReactBridge | null>(null)

export function useReactBridgeContext(): ReactBridge | null {
	return useContext(ReactBridgeContext)
}
