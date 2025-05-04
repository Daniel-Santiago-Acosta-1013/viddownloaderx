import { NextApiRequest, NextApiResponse } from 'next';
import youtubedl from 'youtube-dl-exec';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url } = req.query;

    if (typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        // Obtener información detallada del video usando youtube-dl-exec
        const videoInfo: any = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36']
        });

        // Obtener las opciones de calidad disponibles
        const formatOptions = extractFormatOptions(videoInfo);

        // Responder con la información necesaria
        res.status(200).json({
            id: videoInfo.id,
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration,
            uploadDate: videoInfo.upload_date,
            description: videoInfo.description,
            author: videoInfo.uploader,
            formats: formatOptions,
            fileSize: formatOptions.highest?.size || 'Unknown'
        });
    } catch (error: any) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: `Failed to fetch video info: ${error.message}` });
    }
}

// Función para extraer y organizar las opciones de formato disponibles
function extractFormatOptions(videoInfo: any) {
    const formats = videoInfo.formats || [];
    
    // Filtrar y organizar los formatos por calidad
    const videoFormats = formats.filter((format: any) => 
        format.vcodec !== 'none' && 
        format.acodec !== 'none'
    );

    const audioFormats = formats.filter((format: any) => 
        format.vcodec === 'none' && 
        format.acodec !== 'none'
    );

    // Ordenar por calidad
    videoFormats.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
    audioFormats.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));

    // Obtener el tamaño aproximado de los archivos
    const getFormattedSize = (bytes: string | number) => {
        if (!bytes) return 'Unknown';
        const size = typeof bytes === 'string' ? parseInt(bytes) : bytes;
        return (size / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Preparar opciones de formato
    const formatOptions = {
        highest: videoFormats[0] ? {
            formatId: videoFormats[0].format_id,
            quality: `${videoFormats[0].height}p`,
            size: getFormattedSize(videoFormats[0].filesize || videoFormats[0].filesize_approx || 0)
        } : null,
        '1080p': videoFormats.find((f: any) => f.height === 1080) ? {
            formatId: videoFormats.find((f: any) => f.height === 1080).format_id,
            quality: '1080p',
            size: getFormattedSize(videoFormats.find((f: any) => f.height === 1080).filesize || videoFormats.find((f: any) => f.height === 1080).filesize_approx || 0)
        } : null,
        '720p': videoFormats.find((f: any) => f.height === 720) ? {
            formatId: videoFormats.find((f: any) => f.height === 720).format_id,
            quality: '720p',
            size: getFormattedSize(videoFormats.find((f: any) => f.height === 720).filesize || videoFormats.find((f: any) => f.height === 720).filesize_approx || 0)
        } : null,
        '480p': videoFormats.find((f: any) => f.height === 480) ? {
            formatId: videoFormats.find((f: any) => f.height === 480).format_id,
            quality: '480p',
            size: getFormattedSize(videoFormats.find((f: any) => f.height === 480).filesize || videoFormats.find((f: any) => f.height === 480).filesize_approx || 0)
        } : null,
        '360p': videoFormats.find((f: any) => f.height === 360) ? {
            formatId: videoFormats.find((f: any) => f.height === 360).format_id,
            quality: '360p',
            size: getFormattedSize(videoFormats.find((f: any) => f.height === 360).filesize || videoFormats.find((f: any) => f.height === 360).filesize_approx || 0)
        } : null,
        audio: audioFormats[0] ? {
            formatId: audioFormats[0].format_id,
            quality: 'audio',
            size: getFormattedSize(audioFormats[0].filesize || audioFormats[0].filesize_approx || 0)
        } : null
    };

    return formatOptions;
}
