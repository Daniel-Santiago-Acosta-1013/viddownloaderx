import { useState } from 'react';
import styles from '../../styles/Home.module.scss';

const Home = () => {
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('highest');
    const [format, setFormat] = useState('video');
    const [progress, setProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [videoInfo, setVideoInfo] = useState<any>(null);

    const handleSearch = async () => {
        if (!url) return alert('Please enter a YouTube URL');

        // Fetch video info from API
        const response = await fetch(`/api/videoInfo?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        if (data.error) {
            return alert(data.error);
        }
        setVideoInfo(data);
    };

    const handleDownload = async () => {
        if (!url) return alert('Please enter a YouTube URL');

        setIsDownloading(true);
        setProgress(0);

        const response = await fetch(`/api/download?url=${encodeURIComponent(url)}&quality=${quality}&format=${format}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
        });

        if (!response.ok) {
            setIsDownloading(false);
            return alert('Failed to download video');
        }

        const filename = response.headers.get('X-Filename') || (format === 'audio' ? 'audio.mp3' : 'video.mp4');

        const reader = response.body?.getReader();
        const contentLength = response.headers.get('Content-Length');
        const totalLength = contentLength ? parseInt(contentLength, 10) : 0;
        let receivedLength = 0;
        const chunks = [];

        while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            setProgress(totalLength > 0 ? (receivedLength / totalLength) * 100 : 0);
        }

        const blob = new Blob(chunks);
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);

        setIsDownloading(false);
    };

    return (
        <div className={styles.container}>
            <h1>Download videos from <span className={styles.youtube}>youtube</span></h1>
            <p>On Wiltube you can download long videos, shorts and even gigantic playlists in just one click.</p>
            <input
                type="text"
                placeholder="Paste the url of the video, shorts or playlist here"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
            />
            <button onClick={handleSearch}>Search</button>

            {videoInfo && (
                <div className={styles.videoDetails}>
                    <img src={videoInfo.thumbnail} alt={videoInfo.title} />
                    <p>{videoInfo.title}</p>
                    <div>
                        <label>Resolution</label>
                        <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                            <option value="highest">Highest</option>
                            <option value="1080p">1080p</option>
                            <option value="720p">720p</option>
                            <option value="480p">480p</option>
                            <option value="360p">360p</option>
                        </select>
                    </div>
                    <div>
                        <label>Format</label>
                        <select value={format} onChange={(e) => setFormat(e.target.value)}>
                            <option value="video">Video</option>
                            <option value="audio">Audio (MP3)</option>
                        </select>
                    </div>
                    <button onClick={handleDownload} disabled={isDownloading}>
                        {isDownloading ? 'Downloading...' : 'Download'}
                    </button>
                </div>
            )}

            {isDownloading && (
                <div>
                    <progress value={progress} max="100" />
                </div>
            )}
        </div>
    );
};

export default Home;
