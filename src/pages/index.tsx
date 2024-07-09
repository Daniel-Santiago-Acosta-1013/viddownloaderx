import { useState } from 'react';
import styles from '../../styles/Home.module.scss';
import { TextField, MenuItem, Select, InputLabel, FormControl, Button, Box, Typography, Container, LinearProgress } from '@mui/material';

const Home = () => {
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('highest');
    const [format, setFormat] = useState('video');
    const [progress, setProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

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
        <Container maxWidth="sm" className={styles.container}>
            <Typography variant="h4" gutterBottom >
                Download YouTube Video
            </Typography>
            
            <TextField
                label="Enter YouTube URL"
                variant="outlined"
                fullWidth
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                margin="normal"
                
            />
            <Box className={styles.inputsContainer}>
                <FormControl fullWidth margin="normal">
                    <InputLabel>Quality</InputLabel>
                    <Select
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        label="Quality"
                    >
                        <MenuItem value="highest">Highest</MenuItem>
                        <MenuItem value="1080p">1080p</MenuItem>
                        <MenuItem value="720p">720p</MenuItem>
                        <MenuItem value="480p">480p</MenuItem>
                        <MenuItem value="360p">360p</MenuItem>
                    </Select>
                </FormControl>
                <FormControl fullWidth margin="normal">
                    <InputLabel>Format</InputLabel>
                    <Select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        label="Format"
                    >
                        <MenuItem value="video">Video</MenuItem>
                        <MenuItem value="audio">Audio (MP3)</MenuItem>
                    </Select>
                </FormControl>
            </Box>
            <Box margin="normal" display="flex" justifyContent="center">
                <Button variant="contained" color="primary" onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? 'Downloading...' : 'Download'}
                </Button>
            </Box>
            {isDownloading && (
                <Box width="100%" marginTop="16px">
                    <LinearProgress variant="determinate" value={progress} />
                </Box>
            )}
        </Container>
    );
};

export default Home;
