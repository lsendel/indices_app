import { createApp } from './app'
import { getConfig } from './config'
import { logger } from './utils/logger'

const config = getConfig()
const app = createApp()

logger.info({ port: config.PORT, env: config.ENVIRONMENT }, 'Starting com_mark_api')

export default {
	port: config.PORT,
	fetch: app.fetch,
}
