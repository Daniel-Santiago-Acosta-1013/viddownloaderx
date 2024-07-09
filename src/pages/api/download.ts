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
            format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
        } else {
            format = info.formats.find(f => f.qualityLabel === quality && f.hasVideo && f.hasAudio);
        }

        if (!format) {
            return res.status(400).json({ error: 'Requested quality not available' });
        }

        const filename = `${info.videoDetails.title}-${quality}.mp4`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Filename', filename);
        ytdl(url, { format: format }).pipe(res);
    } catch (error) {
        res.status(500).json({ error: `Failed to download video: ${error.message}` });
    }
}
