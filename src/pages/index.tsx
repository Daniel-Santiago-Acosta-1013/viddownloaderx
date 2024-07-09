import { useState } from 'react';
import styles from '../../styles/Home.module.scss';

const Home = () => {
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('highest');

    const handleDownload = async () => {
        if (!url) return alert('Please enter a YouTube URL');

        const response = await fetch(`/api/download?url=${encodeURIComponent(url)}&quality=${quality}`);
        if (!response.ok) {
            return alert('Failed to download video');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', 'video.mp4');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
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
            <button onClick={handleDownload}>Download</button>
        </div>
    );
};

export default Home;
