import type { LoopEvent } from '../event-bus'

export interface ReactorDeps {
	generateContent: (brief: { goal: string; tone: string; keywords: string[]; channels: string[] }) => Promise<unknown>
	resolveChannels: (direction: string) => string[]
}

export function createStrategicReactorHandler(deps: ReactorDeps) {
	return async (event: LoopEvent, configOverrides: Record<string, unknown>) => {
		const { brand, direction, themes } = event.payload as {
			brand: string; direction: string; themes: string[]
		}

		const defaultTone = direction === 'negative' ? 'empathetic' : 'celebratory'
		const tone = (configOverrides.tone as string) ?? defaultTone
		const channels = (configOverrides.channels as string[]) ?? deps.resolveChannels(direction)
		const extraKeywords = (configOverrides.keywords as string[]) ?? []

		await deps.generateContent({
			goal: `Address ${direction} sentiment about ${brand}: ${(themes ?? []).join(', ')}`,
			tone,
			keywords: [...(themes ?? []), ...extraKeywords],
			channels,
		})
	}
}
