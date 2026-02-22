import { ZelutoApiError } from '../../types/errors'
import { withRetry } from '../../utils/retry'
import type {
	ZelutoTemplateCreate,
	ZelutoTemplate,
	ZelutoCampaignCreate,
	ZelutoCampaign,
	ZelutoCampaignStats,
	ZelutoContactCreate,
	ZelutoContactImportResult,
	ZelutoAbTestCreate,
	ZelutoAbTest,
	ZelutoWebhookCreate,
	ZelutoWebhook,
	ZelutoTenantContext,
} from '../../types/zeluto'

export interface ZelutoClientConfig {
	baseUrl: string
	tenantContext: ZelutoTenantContext
	apiKey?: string
}

export class ZelutoClient {
	private baseUrl: string
	private headers: Record<string, string>

	constructor(config: ZelutoClientConfig) {
		this.baseUrl = config.baseUrl
		this.headers = {
			'Content-Type': 'application/json',
			'X-Tenant-Context': btoa(JSON.stringify(config.tenantContext)),
		}
		if (config.apiKey) {
			this.headers['X-API-Key'] = config.apiKey
		}
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		return withRetry(
			async () => {
				const response = await fetch(`${this.baseUrl}${path}`, {
					method,
					headers: this.headers,
					body: body ? JSON.stringify(body) : undefined,
				})

				if (!response.ok) {
					const error = await response.json().catch(() => ({
						code: 'UNKNOWN',
						message: `HTTP ${response.status}`,
					}))
					throw new ZelutoApiError(
						error.code ?? 'UNKNOWN',
						error.message ?? `HTTP ${response.status}`,
						response.status,
					)
				}

				return response.json() as Promise<T>
			},
			{
				maxRetries: 2,
				baseDelayMs: 500,
				shouldRetry: (err) => {
					if (err instanceof ZelutoApiError) {
						return err.statusCode >= 500 || err.statusCode === 429
					}
					return true
				},
			},
		)
	}

	// Templates
	async createTemplate(data: ZelutoTemplateCreate): Promise<ZelutoTemplate> {
		return this.request('POST', '/content/templates', data)
	}

	async updateTemplate(id: number, data: Partial<ZelutoTemplateCreate>): Promise<ZelutoTemplate> {
		return this.request('PATCH', `/content/templates/${id}`, data)
	}

	// Campaigns
	async createCampaign(data: ZelutoCampaignCreate): Promise<ZelutoCampaign> {
		return this.request('POST', '/campaign/campaigns', data)
	}

	async sendCampaign(id: number): Promise<ZelutoCampaign> {
		return this.request('POST', `/campaign/campaigns/${id}/send`)
	}

	async scheduleCampaign(id: number, scheduledAt: string): Promise<ZelutoCampaign> {
		return this.request('POST', `/campaign/campaigns/${id}/schedule`, { scheduledAt })
	}

	async getCampaignStats(id: number): Promise<ZelutoCampaignStats> {
		return this.request('GET', `/campaign/campaigns/${id}/stats`)
	}

	// Contacts
	async importContacts(contacts: ZelutoContactCreate[]): Promise<ZelutoContactImportResult> {
		return this.request('POST', '/crm/contacts/import', { contacts })
	}

	// A/B Tests
	async createAbTest(data: ZelutoAbTestCreate): Promise<ZelutoAbTest> {
		return this.request('POST', '/campaign/ab-tests', data)
	}

	async getAbTestResults(id: number): Promise<ZelutoAbTest> {
		return this.request('GET', `/campaign/ab-tests/${id}/results`)
	}

	async selectAbTestWinner(id: number, winnerVariant: number): Promise<ZelutoAbTest> {
		return this.request('POST', `/campaign/ab-tests/${id}/select-winner`, { winnerVariant })
	}

	// Webhooks
	async registerWebhook(data: ZelutoWebhookCreate): Promise<ZelutoWebhook> {
		return this.request('POST', '/integrations/webhooks', data)
	}
}
