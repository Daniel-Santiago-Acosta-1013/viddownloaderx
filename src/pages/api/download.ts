import { NextApiRequest, NextApiResponse } from 'next';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { Readable } from 'stream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url, quality, format } = req.query;

    if (typeof url !== 'string' || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        const info = await ytdl.getInfo(url);
        let chosenFormat;

        if (format === 'audio') {
            chosenFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
        } else {
            if (quality === 'highest') {
                chosenFormat = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
            } else {
                chosenFormat = info.formats.find(f => f.qualityLabel === quality && f.hasVideo && f.hasAudio);
            }
        }

        if (!chosenFormat) {
            return res.status(400).json({ error: 'Requested quality not available' });
        }

        const filename = format === 'audio' ? `${info.videoDetails.title}.mp3` : `${info.videoDetails.title}-${quality}.mp4`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Filename', filename);

        // Configura ffmpeg para usar la versión estática
        ffmpeg.setFfmpegPath(ffmpegPath);

        if (format === 'audio') {
            const audioStream = ytdl(url, { format: chosenFormat });
            const ffmpegStream = new Readable().wrap(audioStream);

            ffmpeg(ffmpegStream)
                .audioCodec('libmp3lame')
                .format('mp3')
                .pipe(res, { end: true });
        } else {
            ytdl(url, { format: chosenFormat }).pipe(res);
        }
    } catch (error) {
        res.status(500).json({ error: `Failed to download video: ${error.message}` });
    }
}
