import { NextApiRequest, NextApiResponse } from 'next';
import youtubedl from 'youtube-dl-exec';

interface VideoFormatDetail {
  formatId: string;
  quality: string;
  size: string;
  resolution?: string;
  fps?: number;
  tbr?: number;
  ext?: string;
  vcodec?: string;
  acodec?: string;
  note?: string;
  isAudioOnly?: boolean;
  isVideoOnly?: boolean;
  isSizeEstimated?: boolean;
}

const getFormattedSize = (params: {
    formatFilesize?: number | string;
    formatFilesizeApprox?: number | string;
    videoDuration?: number;
    formatTbr?: number;
    formatAbr?: number;
    formatVbr?: number;
}): { sizeStr: string; isEstimated: boolean } => {
    let sizeInBytes: number | undefined;
    let isEstimated = false;
    const parse = (val: any) => (typeof val === 'string' ? parseInt(val, 10) : typeof val === 'number' ? val : undefined);

    let fs = parse(params.formatFilesize);
    let fs_approx = parse(params.formatFilesizeApprox);

    if (fs && !isNaN(fs) && fs > 0) {
        sizeInBytes = fs;
    } else if (fs_approx && !isNaN(fs_approx) && fs_approx > 0) {
        sizeInBytes = fs_approx;
    }
    
    if ((!sizeInBytes || sizeInBytes === 0) && params.videoDuration && params.videoDuration > 0) {
        const durationSec = params.videoDuration;
        const tbr = parse(params.formatTbr);
        const abr = parse(params.formatAbr);
        const vbr = parse(params.formatVbr);
        
        const bitrateKbps = (tbr && tbr > 0) ? tbr : ((abr && abr > 0) ? abr : ((vbr && vbr > 0) ? vbr : undefined));

        if (bitrateKbps && bitrateKbps > 0) {
            sizeInBytes = (bitrateKbps * 1000 / 8) * durationSec;
            isEstimated = true;
        }
    }

    if (sizeInBytes && sizeInBytes > 0) {
        if (sizeInBytes < 1000) return { sizeStr: `${sizeInBytes.toFixed(0)} B`, isEstimated };
        const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024));
        const humanReadableSize = parseFloat((sizeInBytes / Math.pow(1024, i)).toFixed(2));
        return { sizeStr: `${humanReadableSize} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`, isEstimated };
    }
    
    return { sizeStr: '~0.1 MB', isEstimated: true };
};

function extractFormatOptions(videoData: any): { [key: string]: VideoFormatDetail } {
    const rawFormats = videoData.formats || [];
    const videoDuration = typeof videoData.duration === 'number' ? videoData.duration : undefined;

    const createFormatEntry = (format: any, qualityLabel?: string): VideoFormatDetail | null => {
        if (!format) return null;
        const isVideo = format.vcodec && format.vcodec !== 'none';
        const isAudio = format.acodec && format.acodec !== 'none';
        let defaultQualityLabel = 'Unknown Quality';
        if (isVideo) {
            defaultQualityLabel = format.height ? `${format.height}p` : (format.resolution || 'Video');
        } else if (isAudio) {
            defaultQualityLabel = format.abr ? `${format.abr}k Audio` : 'Audio';
        }

        let note = format.format_note;
        if (note === 'Premium') note = undefined;
        if (!note) {
             note = format.vcodec && format.vcodec.startsWith('vp09') ? 'VP9' : 
                    (format.vcodec && format.vcodec.startsWith('av01') ? 'AV1' : 
                    (format.dynamic_range && format.dynamic_range !== 'SDR' ? format.dynamic_range : undefined));
        }
        
        const sizeInfo = getFormattedSize({
            formatFilesize: format.filesize,
            formatFilesizeApprox: format.filesize_approx,
            videoDuration: videoDuration,
            formatTbr: format.tbr,
            formatAbr: format.abr,
            formatVbr: format.vbr
        });

        return {
            formatId: format.format_id,
            quality: qualityLabel || defaultQualityLabel,
            size: sizeInfo.sizeStr,
            isSizeEstimated: sizeInfo.isEstimated,
            resolution: format.resolution,
            fps: format.fps,
            tbr: format.tbr,
            ext: format.ext,
            vcodec: format.vcodec, 
            acodec: format.acodec,
            note: note,
            isAudioOnly: isAudio && !isVideo,
            isVideoOnly: isVideo && !isAudio,
        };
    };

    const availableFormats: { [key: string]: VideoFormatDetail } = {};

    // --- Audio Formats --- 
    const audioOnlyStreams = rawFormats
        .filter((f: any) => f.vcodec === 'none' && f.acodec !== 'none' && f.abr)
        .sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));

    if (audioOnlyStreams.length > 0) {
        const bestAudio = createFormatEntry(audioOnlyStreams[0], 'Audio (MP3)');
        if (bestAudio) availableFormats['audio'] = bestAudio;
    }

    // --- Video Formats (including those with and without audio) ---
    const allVideoStreams = rawFormats
        .filter((f: any) => f.vcodec !== 'none' && f.height && f.resolution)
        .sort((a: any, b: any) => 
            (b.height || 0) - (a.height || 0) || 
            (b.fps || 0) - (a.fps || 0) ||
            (b.tbr || 0) - (a.tbr || 0) ||
            (a.vcodec && a.vcodec.startsWith('av01') ? -1 : (b.vcodec && b.vcodec.startsWith('av01') ? 1 : 0)) || 
            (a.vcodec && a.vcodec.startsWith('vp09') ? -1 : (b.vcodec && b.vcodec.startsWith('vp09') ? 1 : 0))    
        );

    // 1. "highest" - Representing the best visual quality. 
    // For download, this will imply combining with best audio if it's video-only.
    if (allVideoStreams.length > 0) {
        const bestOverallVideo = allVideoStreams[0];
        // Find if there's a pre-merged version of this exact quality, otherwise use the video-only stream details
        const premergedBest = rawFormats.find((f:any) => 
            f.vcodec !== 'none' && f.acodec !== 'none' && 
            f.height === bestOverallVideo.height && 
            f.width === bestOverallVideo.width &&
            (f.fps === bestOverallVideo.fps || !bestOverallVideo.fps) && // match fps if bestOverallVideo has it
            Math.abs((f.tbr || 0) - (bestOverallVideo.tbr || 0)) < 100 // allow some tbr variance
        );
        
        const formatForHighest = premergedBest || bestOverallVideo;
        const highestEntry = createFormatEntry(formatForHighest, 'Máxima');
        if (highestEntry) {
            availableFormats['highest'] = highestEntry; 
        }
    }
    
    // 2. Populate all unique video resolutions as distinct options
    const addedResolutions = new Set<string>(); // To store keys like "1080p", "720p"

    allVideoStreams.forEach((vf: any) => {
        const qualityKey = `${vf.height}p`;
        if (!addedResolutions.has(qualityKey)) {
            const entry = createFormatEntry(vf); // Label will be like "1080p" or "720p"
            if (entry) {
                // Ensure we don't overwrite 'highest' if it happens to be this resolution *unless* this is a better pre-merged format
                // Or, always add the specific P-value if it's not already there by the same formatId as highest.
                const isSameAsHighest = availableFormats['highest'] && availableFormats['highest'].formatId === entry.formatId;
                if (!availableFormats[qualityKey] || !isSameAsHighest) {
                    availableFormats[qualityKey] = entry;
                }
            }
            addedResolutions.add(qualityKey);
        }
    });

    return availableFormats;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url } = req.query;

    if (typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const rawVideoInfo: any = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            // preferFreeFormats: true, // Removed this as it might be too restrictive
            addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
        });

        if (rawVideoInfo.entries && Array.isArray(rawVideoInfo.entries)) {
            const playlistVideos = rawVideoInfo.entries.map((entry: any) => {
                const entryFormats = extractFormatOptions(entry);
                return {
                    id: entry.id,
                    title: entry.title,
                    thumbnail: entry.thumbnail, 
                    duration: entry.duration,
                    webpage_url: entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
                    formats: entryFormats,
                    fileSize: entryFormats.highest?.size || entryFormats.audio?.size || '~0.1 MB'
                };
            });

            res.status(200).json({
                isPlaylist: true,
                playlistTitle: rawVideoInfo.title, 
                playlistThumbnail: rawVideoInfo.thumbnail, 
                videos: playlistVideos
            });
        } else {
            const singleVideoFormats = extractFormatOptions(rawVideoInfo);
            const singleVideo = {
                id: rawVideoInfo.id,
                title: rawVideoInfo.title,
                thumbnail: rawVideoInfo.thumbnail,
                duration: rawVideoInfo.duration,
                webpage_url: rawVideoInfo.webpage_url || `https://www.youtube.com/watch?v=${rawVideoInfo.id}`,
                formats: singleVideoFormats,
                fileSize: singleVideoFormats.highest?.size || singleVideoFormats.audio?.size || '~0.1 MB'
            };
            res.status(200).json({
                isPlaylist: false,
                playlistTitle: null,
                playlistThumbnail: null,
                videos: [singleVideo] 
            });
        }

    } catch (error: any) {
        console.error('Error fetching video info:', error.message);
        res.status(500).json({ error: `Failed to fetch video info: ${error.message}` });
    }
}
