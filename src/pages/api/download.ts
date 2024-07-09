import { NextApiRequest, NextApiResponse } from 'next';
import ytdl from 'ytdl-core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url, quality } = req.query;

    if (typeof url !== 'string' || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        const info = await ytdl.getInfo(url);
        let format;
        if (quality === 'highest') {
            format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });
        } else {
            format = ytdl.chooseFormat(info.formats, { quality: quality as string, filter: 'audioandvideo' });
        }
        res.setHeader('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);
        ytdl(url, { format: format }).pipe(res);
    } catch (error) {
        res.status(500).json({ error: 'Failed to download video' });
    }
}
