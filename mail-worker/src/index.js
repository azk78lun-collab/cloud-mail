import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import kvObjService from './service/kv-obj-service';
import oauthService from "./service/oauth-service";
import analysisService from './service/analysis-service';
export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		// 获取 base_path 配置，支持将邮箱系统部署在子路径下（如 /mail）
		// Get base_path config, supports deploying the mail system under a subpath (e.g., /mail)
		let basePath = env.base_path || '';
		if (basePath.endsWith('/')) {
			basePath = basePath.slice(0, -1);
		}

		// 如果配置了 base_path，剥离前缀后再进行路由处理
		// If base_path is configured, strip the prefix before routing
		if (basePath) {
			if (url.pathname === basePath) {
				url.pathname = '/';
			} else if (url.pathname.startsWith(basePath + '/')) {
				url.pathname = url.pathname.substring(basePath.length);
			} else {
				// 不在 base_path 下的请求，直接返回静态资源
				return env.assets.fetch(req);
			}
			req = new Request(url.toString(), req)
		}

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		 if (['/static/','/attachments/'].some(p => url.pathname.startsWith(p))) {
			 return await kvObjService.toObjResp( { env }, url.pathname.substring(1));
		 }

		return env.assets.fetch(req);
	},
	email: email,
	async scheduled(c, env, ctx) {
		if (c.cron === '*/30 * * * *') {
			await analysisService.refreshEchartsCache({ env })
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await oauthService.clearNoBindOathUser({ env })
		await analysisService.refreshEchartsCache({ env })
	},
};
