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
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36']
        });

        const { stdout } = await videoInfoProcess;
        const videoInfo = JSON.parse(stdout);
        const title = videoInfo.title.replace(/[^\w\s]/gi, '').substring(0, 200); // Sanitizar título

        let downloadOptions: any = {
            output: '-',
            addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
        };

        // Si se proporciona formatId específico, usarlo
        if (formatId && typeof formatId === 'string') {
            downloadOptions.formatId = formatId;
        }
        // Si no, usar las opciones de calidad/formato
        else {
            if (format === 'audio') {
                downloadOptions.extractAudio = true;
                downloadOptions.audioFormat = 'mp3';
                downloadOptions.audioQuality = 0; // mejor calidad
            } else {
                // Determinar la calidad de video
                if (quality === 'highest') {
                    downloadOptions.formatSortingVp9Avc = '+bestvideo,+bestaudio/best';
                } else if (quality === '1080p') {
                    downloadOptions.formatSort = 'res:1080';
                } else if (quality === '720p') {
                    downloadOptions.formatSort = 'res:720';
                } else if (quality === '480p') {
                    downloadOptions.formatSort = 'res:480';
                } else if (quality === '360p') {
                    downloadOptions.formatSort = 'res:360';
                }
            }
        }

        // Determinar el nombre del archivo y tipo de contenido
        const filename = format === 'audio'
            ? `${title}.mp3`
            : `${title}.mp4`;
        
        const contentType = format === 'audio' ? 'audio/mp3' : 'video/mp4';
        
        // Configurar headers de respuesta
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Filename', filename);
        
        // Ejecutar la descarga
        const downloadProcess = exec(url, downloadOptions);
        
        // Configurar manejo de progreso y streaming
        let totalSize = 0;
        let downloadedSize = 0;
        
        if (downloadProcess.stdout) {
            // Crear un transform stream para el progreso
            const progressStream = new Transform({
                transform(chunk, encoding, callback) {
                    downloadedSize += chunk.length;
                    // Opcional: Calcular progreso si conocemos el tamaño total
                    if (totalSize > 0) {
                        const progress = Math.floor((downloadedSize / totalSize) * 100);
                    }
                    callback(null, chunk);
                }
            });

            // Configurar el pipeline
            downloadProcess.stdout.pipe(progressStream).pipe(res);
            
            // Manejar errores
            downloadProcess.on('error', (error) => {
                console.error('Download process error:', error);
                if (!res.writableEnded) {
                    res.status(500).end(`Download failed: ${error.message}`);
                }
            });
        } else {
            throw new Error('Failed to start download process');
        }
    } catch (error: any) {
        console.error('Download error:', error);
        
        // Si ya habíamos empezado a escribir la respuesta, no podemos enviar un error HTTP
        if (!res.writableEnded) {
            res.status(500).json({ error: `Download failed: ${error.message}` });
        }
    }
}
