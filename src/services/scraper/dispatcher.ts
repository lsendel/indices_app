import { createHmac, timingSafeEqual } from 'crypto'
import { getConfig } from '../../config'

export function signPayload(body: string, timestamp: string, secret: string): string {
	return createHmac('sha256', secret).update(`${timestamp}${body}`).digest('hex')
}

export function verifySignature(
	body: string,
	timestamp: string,
	signature: string,
	secret: string,
): boolean {
	const expected = signPayload(body, timestamp, secret)
	try {
		return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
	} catch {
		return false
	}
}

export async function dispatchScrapeJob(job: {
	jobId: string
	callbackUrl: string
	config: {
		seedUrls?: string[]
		subreddits?: string[]
		keywords?: string[]
		jobType: 'web_crawl' | 'social_scrape' | 'feed_ingest'
		maxPages?: number
	}
}) {
	const config = getConfig()
	const body = JSON.stringify(job)
	const timestamp = Math.floor(Date.now() / 1000).toString()
	const signature = signPayload(body, timestamp, config.SCRAPER_SHARED_SECRET)

	const endpoint = job.config.jobType === 'web_crawl'
		? '/api/v1/jobs'
		: job.config.jobType === 'social_scrape'
			? '/api/v1/social/scrape'
			: '/api/v1/feeds/ingest'

	const response = await fetch(`${config.SCRAPER_WORKER_URL}${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Signature': signature,
			'X-Timestamp': timestamp,
		},
		body,
	})

	if (!response.ok) {
		throw new Error(`Scraper dispatch failed: ${response.statusText}`)
	}

	return response.json()
}
