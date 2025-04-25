import { Context, h, Schema, Session } from 'koishi'
import { VideoInfo, VideoInfoAPI } from './api';

export const name = 'bili-parser'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

// B站视频链接正则
const biliAVIDRegex = /av(\d+)|https?:\/\/(?:www\.)?bilibili\.com\/video\/av(\d+)/i;
const biliBVIDRegex = /BV(\w+)|https?:\/\/(?:www\.)?bilibili\.com\/video\/BV(\w+)/i;
const biliShortLinkRegex = /https?:\/\/(?:www\.)?b23\.tv\/(\w+)/i;
const miniAppShareRegex = /b23\.tv\\\/([\w]+)/

class BiliParser {
	constructor(ctx: Context) {
		// AV BV 号解析
		ctx.middleware(async (session, next) => {
			let videoID = { AVID: null, BVID: null }

			if (biliAVIDRegex.test(session.content)) {
				const match = session.content.match(biliAVIDRegex)
				videoID.AVID = parseInt(match[1] || match[2])
			}
			if (biliBVIDRegex.test(session.content)) {
				const match = session.content.match(biliBVIDRegex)
				videoID.BVID = match[1] || match[2]
			}

			if (!videoID.AVID && !videoID.BVID) return next()

			const api = new VideoInfoAPI(videoID)
			try {
				const res = await api.getVideoInfo(ctx)
				if (res.code !== 0) return next()

				BiliParser.sendVideoInfoMessage(session, res)
			} catch (e) {
				return next()
			}

			return next()
		})

		// 短链接解析
		ctx.middleware(async (session, next) => {
			if (biliShortLinkRegex.test(session.content)) {
				const rawPage = await ctx.http.get(session.content.match(biliShortLinkRegex)[0], {
					redirect: 'manual',
				})
				const match = rawPage.match(biliBVIDRegex)
				const api = new VideoInfoAPI({ BVID: match[1] || match[2] })

				try {
					const res = await api.getVideoInfo(ctx)
					if (res.code !== 0) return next()

					BiliParser.sendVideoInfoMessage(session, res)
				} catch (e) {
					return next()
				}
			}

			return next()
		})

		// 小程序解析
		ctx.middleware(async (session, next) => {
			try {
				const miniAppJsonData = session.toJSON().message.content
				if (miniAppShareRegex.test(miniAppJsonData)) {
					const rawPage = await ctx.http.get(`https://b23.tv/${miniAppJsonData.match(miniAppShareRegex)[1]}`, {
						redirect: 'manual',
					})
					const match = rawPage.match(biliBVIDRegex)
					const api = new VideoInfoAPI({ BVID: match[1] || match[2] })

					const res = await api.getVideoInfo(ctx)
					if (res.code !== 0) return next()

					BiliParser.sendVideoInfoMessage(session, res)
				}
			} catch (e) {
				return next()
			}

			return next()
		})
	}

	static sendVideoInfoMessage(session: Session, res: VideoInfo) {
    const descLength = res.data.desc.length
    let simplifiedDesc = res.data.desc.substring(0, Math.min(descLength, 100));
    if (descLength > 100) {
      simplifiedDesc += "..."
    }
		session.send(
			h('message',
        h('a', `https://www.bilibili.com/video/${res.data.avid ? res.data.avid : res.data.bvid}`),
				h('p', res.data.title),
				h('p', `UP主: ${res.data.owner.name}`),
				h('p', `${res.data.stat.view} 播放  ${res.data.stat.like} 点赞  ${res.data.stat.favorite} 收藏`),
				h('img', { src: res.data.pic }),
				h('p', simplifiedDesc)
			)
		)
	}
}

export function apply(ctx: Context) {
	ctx.plugin(BiliParser)
}
