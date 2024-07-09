import { useState } from 'react';
import { FaSearch, FaDownload } from 'react-icons/fa';
import Head from 'next/head';
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
            <Head>
                <title>Descargar Videos</title>
            </Head>
            <h1>Download videos from <span className={styles.youtube}>youtube</span></h1>
            <p>On Wiltube you can download long videos, shorts and even gigantic playlists in just one click.</p>
            <div className={styles.searchContainer}>
                <div className={styles.inputContainer}>
                    <FaSearch className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Paste the url of the video, shorts or playlist here"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                </div>
                <button onClick={handleSearch}>Search</button>
            </div>

            {videoInfo && (
                <div className={styles.videoDetails}>
                    <div className={styles.imgAndTitle}>
                        <img src={videoInfo.thumbnail} alt={videoInfo.title} />
                        <p>{videoInfo.title}</p>
                    </div>
                    <div className={styles.mainOptionsContainer}>
                        <div className={styles.optionsContainer}>
                            <label>Resolution</label>
                            <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                                <option value="highest">Highest</option>
                                <option value="1080p">1080p</option>
                                <option value="720p">720p</option>
                                <option value="480p">480p</option>
                                <option value="360p">360p</option>
                            </select>
                        </div>
                        <div className={styles.optionsContainer}>
                            <label>Format</label>
                            <select value={format} onChange={(e) => setFormat(e.target.value)}>
                                <option value="video">Video</option>
                                <option value="audio">Audio (MP3)</option>
                            </select>
                        </div>

                        <div className={styles.downloadContainer}>
                            <p className={styles.fileSize}>Total: {videoInfo.fileSize}</p>
                            <button onClick={handleDownload} disabled={isDownloading} className={styles.downloadButton}>
                                {isDownloading ? 'Downloading...' : 'Download'} <FaDownload />
                            </button>
                        </div>
                    </div>
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
