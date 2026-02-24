import { createHmac, timingSafeEqual } from 'crypto'
import { logger } from '../../utils/logger'
import type { ScrapeJobDispatch } from '../../types/api'

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
	} catch (e) {
		logger.warn('verifySignature: timing-safe comparison failed', {
			error: e instanceof Error ? e.message : String(e),
			signatureLength: signature?.length,
			expectedLength: expected?.length,
		})
		return false
	}
}

export async function dispatchScrapeJob(
	job: {
		jobId: string
		callbackUrl: string
		config: ScrapeJobDispatch
	},
	opts: { scraperWorkerUrl: string; scraperSharedSecret: string },
) {
	const body = JSON.stringify(job)
	const timestamp = Math.floor(Date.now() / 1000).toString()
	const signature = signPayload(body, timestamp, opts.scraperSharedSecret)

	const endpoint = job.config.jobType === 'web_crawl'
		? '/api/v1/jobs'
		: job.config.jobType === 'social_scrape'
			? '/api/v1/social/scrape'
			: '/api/v1/feeds/ingest'

	const response = await fetch(`${opts.scraperWorkerUrl}${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Signature': signature,
			'X-Timestamp': timestamp,
		},
		body,
	})

	if (!response.ok) {
		let detail = response.statusText
		try {
			const errorBody = await response.text()
			if (errorBody) detail = `${response.status} ${response.statusText}: ${errorBody.slice(0, 500)}`
		} catch { /* ignore read failure */ }
		throw new Error(`Scraper dispatch failed: ${detail}`)
	}

	try {
		return await response.json()
	} catch {
		return { status: 'dispatched' }
	}
}
