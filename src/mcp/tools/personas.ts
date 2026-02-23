import type { LLMProvider } from '../../adapters/llm/types'

export async function handleGeneratePersona(segmentId: string, provider: LLMProvider, tenantId: string) {
	const systemPrompt = 'You generate buyer personas. Return JSON: { "name": string, "description": string, "motivations": string[], "painPoints": string[], "preferredChannels": string[] }'
	const prompt = `Generate a detailed buyer persona for segment ${segmentId}.`

	try {
		const response = await provider.generateText(prompt, { systemPrompt })
		const persona = JSON.parse(response)
		return { segmentId, persona }
	} catch {
		return { segmentId, persona: { name: 'Unknown', description: 'Failed to generate persona' } }
	}
}
