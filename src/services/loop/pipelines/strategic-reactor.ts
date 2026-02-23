import type { LoopEvent } from '../event-bus'

export interface ReactorDeps {
	generateContent: (brief: { goal: string; tone: string; keywords: string[]; channels: string[] }) => Promise<unknown>
	resolveChannels: (direction: string) => string[]
}

export function createStrategicReactorHandler(deps: ReactorDeps) {
	return async (event: LoopEvent, _configOverrides: Record<string, unknown>) => {
		const { brand, direction, themes } = event.payload as {
			brand: string; direction: string; themes: string[]
		}

		const tone = direction === 'negative' ? 'empathetic' : 'celebratory'
		const channels = deps.resolveChannels(direction)

		await deps.generateContent({
			goal: `Address ${direction} sentiment about ${brand}: ${(themes ?? []).join(', ')}`,
			tone,
			keywords: themes ?? [],
			channels,
		})
	}
}
