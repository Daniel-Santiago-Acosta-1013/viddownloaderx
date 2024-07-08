import { useState } from 'react';
import styles from '../../styles/Home.module.scss';

const Home = () => {
    const [url, setUrl] = useState('');

    const handleDownload = async () => {
        if (!url) return alert('Please enter a YouTube URL');

        const response = await fetch(`/api/download?url=${encodeURIComponent(url)}`);
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
            <input
                type="text"
                placeholder="Enter YouTube URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
            />
            <button onClick={handleDownload}>Download</button>
        </div>
    );
};

export default Home;
