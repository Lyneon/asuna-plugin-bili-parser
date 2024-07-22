import { Context, h, Schema, Session } from 'koishi'
import { VideoInfo, VideoInfoAPI } from './api';

export const name = 'bili-parser'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

// B站视频链接正则
const biliAVIDRegex = /av(\d+)|https?:\/\/(?:www\.)?bilibili\.com\/video\/av(\d+)/i;
const biliBVIDRegex = /BV(\w+)|https?:\/\/(?:www\.)?bilibili\.com\/video\/BV(\w+)/i;
const biliShortLinkRegex = /https?:\/\/(?:www\.)?b23\.tv\/(\w+)/i;

class BiliParser {
	constructor(ctx: Context) {
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
	}

	static sendVideoInfoMessage(session: Session, res: VideoInfo) {
		session.send(
			h('message',
				h('p', res.data.title),
				h('p', `UP主: ${res.data.owner.name}`),
				h('p', `${res.data.stat.view} 播放  ${res.data.stat.like} 点赞  ${res.data.stat.favorite} 收藏`),
				h('img', { src: res.data.pic }),
				h('p', res.data.desc),
				h('a', `https://www.bilibili.com/video/${res.data.avid ? res.data.avid : res.data.bvid}`)
			)
		)
	}
}

export function apply(ctx: Context) {
	ctx.plugin(BiliParser)
}
