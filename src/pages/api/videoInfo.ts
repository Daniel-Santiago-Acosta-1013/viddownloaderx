import { NextApiRequest, NextApiResponse } from 'next';
import ytdl from 'ytdl-core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url } = req.query;

    if (typeof url !== 'string' || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        const info = await ytdl.getInfo(url);
        const thumbnail = info.videoDetails.thumbnails[0].url;
        const title = info.videoDetails.title;

        res.status(200).json({ thumbnail, title });
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch video info: ${error.message}` });
    }
}
