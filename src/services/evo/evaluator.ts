import type { LLMProvider } from '../../adapters/llm/types'

export interface CampaignStats {
	sent: number
	delivered: number
	opened: number
	clicked: number
	bounced: number
	complained: number
}

export interface EvaluationResult {
	metricScore: number
	qualityScore: number
	combinedScore: number
	feedback: string
}

const METRIC_WEIGHT = 0.6
const QUALITY_WEIGHT = 0.4

/**
 * Compute a 0-1 score from campaign delivery stats.
 * @param stats - Campaign delivery metrics (sent, opened, clicked, etc.)
 * @returns Weighted score in [0, 1] combining positive signals and penalties
 */
export function computeMetricScore(stats: CampaignStats): number {
	if (stats.sent === 0) return 0

	const deliveryRate = stats.delivered / stats.sent
	const openRate = stats.opened / stats.sent
	const clickRate = stats.clicked / stats.sent
	const bounceRate = stats.bounced / stats.sent
	const complaintRate = stats.complained / stats.sent

	const positiveSignal = deliveryRate * 0.2 + openRate * 0.35 + clickRate * 0.45
	const penalty = bounceRate * 0.5 + complaintRate * 1.5

	return Math.max(0, Math.min(1, positiveSignal - penalty))
}

/**
 * Evaluate a campaign using both metrics and LLM quality assessment.
 * @param adapter - OpenAI adapter for LLM calls
 * @param stats - Campaign delivery metrics
 * @param goal - Campaign goal for LLM quality assessment
 * @returns Combined evaluation with metric score, quality score, and feedback
 */
export async function evaluateCampaign(
	provider: LLMProvider,
	stats: CampaignStats,
	goal: string,
): Promise<EvaluationResult> {
	const metricScore = computeMetricScore(stats)

	const systemPrompt = `You evaluate marketing campaign quality. Return JSON: { "qualityScore": number (0-1), "feedback": "brief assessment" }`
	const prompt = `Evaluate this campaign:
Goal: ${goal}
Stats: ${JSON.stringify(stats)}
Metric score: ${metricScore.toFixed(3)}`

	let qualityScore = 0
	let feedback = ''

	try {
		const response = await provider.generateText(prompt, { systemPrompt })
		const parsed = JSON.parse(response) as { qualityScore: number; feedback: string }
		qualityScore = Math.max(0, Math.min(1, parsed.qualityScore))
		feedback = parsed.feedback
	} catch (e) {
		if (!(e instanceof SyntaxError)) throw e
		console.warn('evaluateCampaign: failed to parse LLM quality assessment, using metrics only', { goal, error: e.message })
	}

	const combinedScore = qualityScore > 0
		? metricScore * METRIC_WEIGHT + qualityScore * QUALITY_WEIGHT
		: metricScore

	return { metricScore, qualityScore, combinedScore, feedback }
}
