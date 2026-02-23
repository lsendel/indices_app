import type { LLMProvider } from './types'

export interface LLMRouter {
	resolve(task: string): LLMProvider
	listProviders(): LLMProvider[]
}

export function createLLMRouter(
	providers: Record<string, LLMProvider>,
	routing: Record<string, string>,
): LLMRouter {
	const providerList = Object.values(providers)
	if (providerList.length === 0) {
		throw new Error('No LLM providers configured')
	}

	return {
		resolve(task: string): LLMProvider {
			const preferredName = routing[task]
			if (preferredName && providers[preferredName]) {
				return providers[preferredName]
			}
			return providerList[0]
		},

		listProviders(): LLMProvider[] {
			return providerList
		},
	}
}
