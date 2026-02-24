export interface OAuthParams {
	clientId: string
	redirectUri: string
	scopes: string[]
	state: string
}

const OAUTH_URLS: Record<string, string> = {
	meta: 'https://www.facebook.com/v21.0/dialog/oauth',
	linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
	tiktok: 'https://www.tiktok.com/v2/auth/authorize/',
}

const TOKEN_URLS: Record<string, string> = {
	meta: 'https://graph.facebook.com/v21.0/oauth/access_token',
	linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
	tiktok: 'https://open.tiktokapis.com/v2/oauth/token/',
}

export function buildOAuthUrl(provider: string, params: OAuthParams): string {
	const baseUrl = OAUTH_URLS[provider]
	if (!baseUrl) throw new Error(`Unknown OAuth provider: ${provider}`)

	const searchParams = new URLSearchParams({
		client_id: params.clientId,
		redirect_uri: params.redirectUri,
		scope: params.scopes.join(','),
		response_type: 'code',
		state: params.state,
	})

	if (provider === 'tiktok') {
		searchParams.delete('client_id')
		searchParams.set('client_key', params.clientId)
	}

	return `${baseUrl}?${searchParams.toString()}`
}

export async function exchangeCodeForTokens(
	provider: string,
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
	const tokenUrl = TOKEN_URLS[provider]
	if (!tokenUrl) throw new Error(`Unknown token provider: ${provider}`)

	const body = new URLSearchParams({
		client_id: provider === 'tiktok' ? '' : clientId,
		client_secret: clientSecret,
		code,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri,
	})

	if (provider === 'tiktok') {
		body.set('client_key', clientId)
	}

	const res = await fetch(tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	})

	const data = (await res.json()) as Record<string, unknown>
	return {
		accessToken: (data.access_token as string) ?? '',
		refreshToken: data.refresh_token as string | undefined,
		expiresIn: data.expires_in as number | undefined,
	}
}

const ACCOUNT_INFO_URLS: Record<string, string> = {
	meta: 'https://graph.facebook.com/v21.0/me?fields=id,name',
	linkedin: 'https://api.linkedin.com/v2/userinfo',
	tiktok: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
}

export async function fetchAccountInfo(
	provider: string,
	accessToken: string,
): Promise<Record<string, unknown>> {
	const url = ACCOUNT_INFO_URLS[provider]
	if (!url) return {}

	try {
		const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }
		const res = await fetch(url, { headers })
		if (!res.ok) return {}
		const data = (await res.json()) as Record<string, unknown>

		if (provider === 'meta') {
			return { accountId: data.id, accountName: data.name }
		}
		if (provider === 'linkedin') {
			return { accountId: data.sub, accountName: data.name, email: data.email }
		}
		if (provider === 'tiktok') {
			const user = (data.data as Record<string, unknown>)?.user as Record<string, unknown> | undefined
			return { accountId: user?.open_id, accountName: user?.display_name, avatarUrl: user?.avatar_url }
		}
		return data
	} catch {
		return {}
	}
}
