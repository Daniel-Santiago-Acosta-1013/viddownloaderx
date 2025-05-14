import { useState, ReactNode } from 'react';
import Head from 'next/head';
import styles from '../../styles/Home.module.scss';
import { useTheme } from '../context/ThemeContext';
import Icon from '../components/Icon';
import Modal from '../components/Modal/Modal';

// Define ModalState interface
interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: ReactNode;
  type?: 'success' | 'error' | 'loading' | 'info';
}

const Home = () => {
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('highest');
    const [format, setFormat] = useState('video');
    const [progress, setProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [videoInfo, setVideoInfo] = useState<any>(null);
    const { theme, toggleTheme } = useTheme();

    const [modalState, setModalState] = useState<ModalState>({ isOpen: false });

    const showModal = (title: string, content: ReactNode, type: ModalState['type']) => {
      setModalState({ isOpen: true, title, content, type });
    };

    const hideModal = () => {
      setModalState({ isOpen: false, title: '', content: '', type: undefined });
    };

    const handleSearch = async () => {
        if (!url) {
            showModal('Error', 'Por favor, ingrese una URL de YouTube.', 'error');
            return;
        }

        showModal('Buscando Información...', 'Por favor espere, estamos obteniendo los detalles del video.', 'loading');

        try {
            const response = await fetch(`/api/videoInfo?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            
            hideModal(); // Hide loading modal

            if (data.error) {
                showModal('Error', data.error, 'error');
                return;
            }
            setVideoInfo(data);
        } catch (error) {
            hideModal(); // Hide loading modal
            showModal('Error', 'Hubo un problema al buscar el video. Intente de nuevo.', 'error');
        }
    };

    const handleDownload = async () => {
        if (!url || !videoInfo) { // also check for videoInfo
            showModal('Error', 'Por favor, primero busque un video e ingrese una URL de YouTube.', 'error');
            return;
        }

        setIsDownloading(true);
        setProgress(0);

        try {
            let selectedFormatId = null;
            if (videoInfo?.formats) {
                if (format === 'audio' && videoInfo.formats.audio) {
                    selectedFormatId = videoInfo.formats.audio.formatId;
                } else if (quality === 'highest' && videoInfo.formats.highest) {
                    selectedFormatId = videoInfo.formats.highest.formatId;
                } else if (videoInfo.formats[quality]) {
                    selectedFormatId = videoInfo.formats[quality].formatId;
                }
            }

            let downloadUrlPath = `/api/download?url=${encodeURIComponent(url)}&quality=${quality}&format=${format}`;
            
            if (selectedFormatId) {
                downloadUrlPath += `&formatId=${selectedFormatId}`;
            }

            const response = await fetch(downloadUrlPath, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
            });

            if (!response.ok) {
                setIsDownloading(false);
                const errorData = await response.json();
                showModal('Error de Descarga', errorData.error || 'No se pudo descargar el video. Intente de nuevo.', 'error');
                return;
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
            const downloadUrl2 = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl2;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);

            showModal('¡Descarga Completada!', `${filename} se ha descargado con éxito.`, 'success');
            setTimeout(() => {
                hideModal();
            }, 3000);


            setIsDownloading(false);
        } catch (error) {
            setIsDownloading(false);
            showModal('Error de Descarga', 'Hubo un problema al descargar el video. Intente de nuevo.', 'error');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>VidDownloaderX - Descarga Videos</title>
                <meta name="description" content="Descarga videos, shorts y playlists de YouTube con un solo clic" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            
            <button 
                className={styles.themeToggle} 
                onClick={toggleTheme} 
                aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
                <div className={`${styles.toggleTrack} ${theme === 'dark' ? styles.darkActive : styles.lightActive}`}>
                    <div className={styles.toggleIcon}>
                        <Icon name="SunIcon" solid className={styles.sunIcon} />
                    </div>
                    <div className={styles.toggleIcon}>
                        <Icon name="MoonIcon" solid className={styles.moonIcon} />
                    </div>
                    <div className={`${styles.toggleThumb} ${theme === 'dark' ? styles.thumbRight : styles.thumbLeft}`} />
                </div>
            </button>

            <h1>Descarga videos de <span className={styles.youtube}>YouTube</span></h1>
            <p>Con VidDownloaderX puedes descargar videos largos, shorts e incluso playlists gigantes con un solo clic.</p>
            
            <div className={styles.searchContainer}>
                <div className={styles.inputContainer}>
                    <Icon name="MagnifyingGlassIcon" className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Pega la URL del video, shorts o playlist aquí"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={modalState.isOpen && modalState.type === 'loading'}
                    />
                </div>
                <button 
                    onClick={handleSearch} 
                    className={styles.searchButton}
                    disabled={modalState.isOpen && modalState.type === 'loading'}
                >
                    <span>Buscar</span>
                    <Icon name="MagnifyingGlassIcon" solid className={styles.buttonIcon} />
                </button>
            </div>

            {videoInfo && !modalState.isOpen && (
                <div className={styles.videoDetails}>
                    <div className={styles.imgAndTitle}>
                        <img src={videoInfo.thumbnail} alt={videoInfo.title} />
                        <p>{videoInfo.title}</p>
                    </div>
                    <div className={styles.mainOptionsContainer}>
                        <div className={styles.optionsContainer}>
                            <label>
                                <Icon name="AdjustmentsHorizontalIcon" className={styles.optionIcon} />
                                Resolución
                            </label>
                            <div className={styles.selectWrapper}>
                                <select value={quality} onChange={(e) => setQuality(e.target.value)} disabled={isDownloading}>
                                    <option value="highest">Máxima</option>
                                    <option value="1080p">1080p</option>
                                    <option value="720p">720p</option>
                                    <option value="480p">480p</option>
                                    <option value="360p">360p</option>
                                </select>
                                <Icon name="ChevronDownIcon" className={styles.selectIcon} />
                            </div>
                        </div>
                        <div className={styles.optionsContainer}>
                            <label>
                                <Icon name="FilmIcon" className={styles.optionIcon} />
                                Formato
                            </label>
                            <div className={styles.selectWrapper}>
                                <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={isDownloading}>
                                    <option value="video">Video</option>
                                    <option value="audio">Audio (MP3)</option>
                                </select>
                                <Icon name="ChevronDownIcon" className={styles.selectIcon} />
                            </div>
                        </div>

                        <div className={styles.downloadContainer}>
                            {videoInfo.fileSize && // Check if fileSize exists
                                <p className={styles.fileSize}>
                                    <Icon name="DocumentIcon" className={styles.infoIcon} />
                                    Tamaño estimado: {videoInfo.fileSize}
                                </p>
                            }
                            <button 
                                onClick={handleDownload} 
                                disabled={isDownloading} 
                                className={styles.downloadButton}
                            >
                                <span>{isDownloading ? 'Descargando...' : 'Descargar'}</span>
                                <Icon name="ArrowDownTrayIcon" solid className={styles.buttonIcon} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDownloading && (
                <div className={styles.progressContainer}>
                    <p>
                        <Icon name="CloudArrowDownIcon" className={styles.progressIcon} />
                        Descargando... {Math.round(progress)}%
                    </p>
                    <progress value={progress} max="100" />
                </div>
            )}

            <Modal
                isOpen={modalState.isOpen}
                onClose={hideModal}
                title={modalState.title}
                type={modalState.type}
            >
                {modalState.content}
            </Modal>
        </div>
    );
};

export default Home;
