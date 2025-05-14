import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'youtube-dl-exec';
import { Transform } from 'stream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url, quality, format, formatId } = req.query;

    if (typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        // Obtener información del video
        const videoInfoProcess = exec(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36']
        });

        const { stdout } = await videoInfoProcess;
        const videoInfo = JSON.parse(stdout);
        const title = videoInfo.title.replace(/[\W_]+/g, " ").trim().substring(0, 150) || 'video'; // Improved sanitization

        let downloadCommandOptions: any = {
            output: '-', // Stream to stdout
            addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
        };

        let finalFilename = `${title}.mp4`;
        let finalContentType = 'video/mp4';

        if (formatId && typeof formatId === 'string') {
            // User has selected a specific format ID
            if (format === 'audio') {
                downloadCommandOptions.format = formatId; // Use the audio formatId directly
                finalFilename = `${title}.mp3`;
                finalContentType = 'audio/mp3';
            } else {
                // For video, the formatId might be for a video-only stream.
                // Combine with bestaudio. If formatId itself is already a merged format, this is usually harmless.
                // For 'highest' quality special case, ensure it picks best video and audio
                if (quality === 'highest' && formatId === videoInfo.formats?.find((f:any) => f.format_note ==='highest' || f.height === videoInfo.height )?.format_id ) {
                    // if formatId for highest indeed points to a pre-merged or best video stream
                     downloadCommandOptions.format = `${formatId}+bestaudio/bestvideo+bestaudio/best`;
                } else {
                     downloadCommandOptions.format = `${formatId}+bestaudio/best`; // Combine selected video ID with best audio
                }
                // If the selected formatId (from videoInfo.ts) has extension info, use it
                const selectedFormatDetail = videoInfo.formats?.find((f:any) => f.format_id === formatId);
                if (selectedFormatDetail?.ext && selectedFormatDetail.ext !== 'unknown_video') {
                    finalFilename = `${title}.${selectedFormatDetail.ext}`;
                    finalContentType = selectedFormatDetail.ext === 'webm' ? 'video/webm' : `video/${selectedFormatDetail.ext}`;
                }
            }
        } else {
            // Legacy fallback if no formatId (should be less common with new UI)
            if (format === 'audio') {
                downloadCommandOptions.extractAudio = true;
                downloadCommandOptions.audioFormat = 'mp3';
                downloadCommandOptions.audioQuality = 0; // Best quality audio
                finalFilename = `${title}.mp3`;
                finalContentType = 'audio/mp3';
            } else {
                // Default to best mp4 if no specific quality/formatId
                downloadCommandOptions.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
            }
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalFilename)}"`);
        res.setHeader('Content-Type', finalContentType);
        res.setHeader('X-Filename', finalFilename); // Send clean filename for client-side use
        
        const downloadProcess = exec(url, downloadCommandOptions);
        
        if (downloadProcess.stdout) {
            downloadProcess.stdout.pipe(res);
            downloadProcess.on('error', (error) => {
                console.error('Download process error:', error);
                if (!res.writableEnded) {
                    res.status(500).end(JSON.stringify({ error: `Download failed: ${error.message}` }));
                }
            });
            downloadProcess.on('close', (code) => {
                if (code !== 0 && !res.writableEnded) {
                    console.error(`Download process exited with code ${code}`);
                } 
                res.end();
            });
        } else {
            throw new Error('Failed to start download process, stdout is not available.');
        }

    } catch (error: any) {
        console.error('Download error in API handler:', error.message);
        if (!res.headersSent && !res.writableEnded) {
            res.status(500).json({ error: `Download failed: ${error.message}` });
        } else if (!res.writableEnded) {
            // If headers were sent but we haven't finished, try to end with an error indication if possible
            // This is tricky because the stream might be ongoing.
            console.error('Error after headers sent, attempting to end response.');
            res.end(); 
        }
    }
}
