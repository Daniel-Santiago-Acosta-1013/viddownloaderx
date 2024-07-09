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

        // Estimate file size for different formats and qualities
        const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });
        const fileSize = format.contentLength ? (parseInt(format.contentLength) / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown';

        res.status(200).json({ thumbnail, title, fileSize });
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch video info: ${error.message}` });
    }
}
