import { Editor } from './editor/components/Editor'
import { ContainerContext } from '@/editor/hooks/useContainer'
import { Container } from '@/lib/di/container'
import { useState } from 'react'

function App() {
	const [container] = useState<Container>(() => new Container())

	return (
		<ContainerContext.Provider value={container}>
			<Editor projectId="default-project" />
		</ContainerContext.Provider>
	)
}

export default App
