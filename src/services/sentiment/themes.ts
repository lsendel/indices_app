const THEME_PATTERNS: Record<string, RegExp[]> = {
	'Product Launch': [/product launch/i, /new release/i, /launched/i, /unveil/i, /debut/i],
	'Innovation': [/innovat/i, /breakthrough/i, /cutting.?edge/i, /pioneer/i, /revolutionary/i],
	'Financial': [/revenue/i, /earnings/i, /profit/i, /growth\s+\d/i, /market\s+cap/i, /valuation/i],
	'Issues': [/outage/i, /bug/i, /recall/i, /lawsuit/i, /breach/i, /vulnerability/i, /scandal/i],
	'Legal/Regulatory': [/regulat/i, /compliance/i, /antitrust/i, /gdpr/i, /fine\b/i, /penalty/i],
	'Privacy/Security': [/privacy/i, /data\s+protection/i, /security/i, /encrypt/i, /hack/i],
	'Competition': [/compet/i, /market\s+share/i, /rival/i, /disrupt/i, /overtake/i],
	'Leadership': [/ceo/i, /leadership/i, /executive/i, /board\b/i, /appoint/i, /resign/i],
	'Customer Issues': [/customer\s+(complain|issue|problem)/i, /support\s+ticket/i, /refund/i],
}

/** Extract themes from text by matching known patterns */
export function extractThemes(text: string): string[] {
	const matched: string[] = []
	for (const [theme, patterns] of Object.entries(THEME_PATTERNS)) {
		if (patterns.some((p) => p.test(text))) {
			matched.push(theme)
		}
	}
	return matched
}
