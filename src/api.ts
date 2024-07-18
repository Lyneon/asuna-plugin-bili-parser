import { Context } from "koishi";

interface VideoInfo {
    code: number;
    message: string;
    ttl: number;
    data: {
        bvid: string;
        avid: number;
        title: string;
        pic: string;
        pubDate: number;
        desc: string;
        stat: {
            view: number;
            like: number;
            favorite: number;
            coin: number;
            share: number;
        };
        owner: {
            name: string;
        };
    };
}

interface VideoID {
    AVID?: number,
    BVID?: string
}

class VideoInfoAPI {
    private avid: number = null;
    private bvid: string = null;

    constructor(id: VideoID) {
        if (!id.AVID && !id.BVID) throw new Error('Invalid video ID.')

        if (id.AVID !== undefined) this.setAVID(id.AVID)
        if (id.BVID !== undefined) this.setBVID(id.BVID)
    }

    setAVID(avid: number) {
        this.avid = avid
        this.bvid = null
    }

    setBVID(bvid: string) {
        this.bvid = bvid
        this.avid = null
    }

    async getVideoInfo(ctx: Context): Promise<VideoInfo> {
        let requestURL = 'http://api.bilibili.com/x/web-interface/view?'

        if (this.avid) requestURL += `aid=${this.avid}`
        else if (this.bvid !== null) requestURL += `bvid=${this.bvid}`
        else throw new Error('Invalid video ID.')

        const req = ctx.http.get(requestURL) as Promise<VideoInfo>

        return req
    }
}

export { VideoInfoAPI, VideoInfo }