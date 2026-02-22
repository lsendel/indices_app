interface ClaimInput {
	claim: string
	supportingEvidence: string[]
	contradictingEvidence: string[]
}

interface ClaimResult {
	claim: string
	confidence: number // 0-1
	verdict: 'supported' | 'contradicted' | 'insufficient' | 'mixed'
	reasoning: string
}

/** Validate a claim based on supporting vs contradicting evidence (rule-based, Popper-inspired) */
export function validateClaim(input: ClaimInput): ClaimResult {
	const { claim, supportingEvidence, contradictingEvidence } = input
	const totalEvidence = supportingEvidence.length + contradictingEvidence.length

	if (totalEvidence === 0) {
		return { claim, confidence: 0, verdict: 'insufficient', reasoning: 'No evidence provided' }
	}

	const supportRatio = supportingEvidence.length / totalEvidence
	const confidence = supportRatio

	let verdict: ClaimResult['verdict']
	if (confidence > 0.7) verdict = 'supported'
	else if (confidence < 0.3) verdict = 'contradicted'
	else if (totalEvidence < 2) verdict = 'insufficient'
	else verdict = 'mixed'

	const reasoning = `${supportingEvidence.length} supporting vs ${contradictingEvidence.length} contradicting sources`

	return { claim, confidence, verdict, reasoning }
}
