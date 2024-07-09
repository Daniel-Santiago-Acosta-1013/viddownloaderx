import { useState } from 'react';
import styles from '../../styles/Home.module.scss';
import ProgressButton from '../components/ProgressButton/ProgressButton';

const Home = () => {
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('highest');
    const [progress, setProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!url) return alert('Please enter a YouTube URL');

        setIsDownloading(true);
        setProgress(0);

        const response = await fetch(`/api/download?url=${encodeURIComponent(url)}&quality=${quality}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
        });

        if (!response.ok) {
            setIsDownloading(false);
            return alert('Failed to download video');
        }

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
        link.setAttribute('download', 'video.mp4');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);

        setIsDownloading(false);
    };

    return (
        <div className={styles.container}>
            <h1>Download YouTube Video</h1>
            <div className={styles.inputsContainer}>
                <input
                    type="text"
                    placeholder="Enter YouTube URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
                <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                    <option value="highest">Highest</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                </select>
            </div>
            <ProgressButton 
                progress={progress} 
                isDownloading={isDownloading} 
                onClick={handleDownload} 
            />
        </div>
    );
};

export default Home;
