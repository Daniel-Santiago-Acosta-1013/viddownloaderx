import { useState, ReactNode, useEffect } from 'react';
import Head from 'next/head';
import styles from '../../styles/Home.module.scss';
import { useTheme } from '../context/ThemeContext';
import Icon from '../components/Icon';
import Modal from '../components/Modal/Modal';

interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: ReactNode;
  type?: 'success' | 'error' | 'loading' | 'info';
}

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
}

interface VideoFormatOptions {
  highest?: VideoFormatDetail | null;
  '1080p'?: VideoFormatDetail | null;
  '720p'?: VideoFormatDetail | null;
  '480p'?: VideoFormatDetail | null;
  '360p'?: VideoFormatDetail | null;
  audio?: VideoFormatDetail | null;
  [key: string]: VideoFormatDetail | null | undefined;
}

interface VideoQueueItem {
  id: string;
  title: string;
  thumbnail: string;
  duration?: number | string;
  webpage_url: string;
  formats: VideoFormatOptions;
  fileSize: string;

  selectedQuality: string;
  selectedFormat: string;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'skipped';
  progress?: number;
  error?: string;
  downloadUrl?: string;
  filename?: string;
}

interface ApiVideoInfoResponse {
  isPlaylist: boolean;
  playlistTitle: string | null;
  playlistThumbnail: string | null;
  videos: Array<{ 
    id: string;
    title: string;
    thumbnail: string;
    duration?: number | string;
    webpage_url: string;
    formats: VideoFormatOptions;
    fileSize: string;
  }>;
}

const Home = () => {
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('highest');
    const [format, setFormat] = useState('video');
    const [progress, setProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [videoInfo, setVideoInfo] = useState<ApiVideoInfoResponse | null>(null);
    const [downloadQueue, setDownloadQueue] = useState<VideoQueueItem[]>([]);
    const [currentlyDownloadingVideoId, setCurrentlyDownloadingVideoId] = useState<string | null>(null);
    const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
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
        setVideoInfo(null);
        setDownloadQueue([]);
        setCurrentlyDownloadingVideoId(null);

        try {
            const response = await fetch(`/api/videoInfo?url=${encodeURIComponent(url)}`);
            const data: ApiVideoInfoResponse = await response.json();
            
            hideModal();

            if (!response.ok || !data || (data as any).error) {
                showModal('Error', (data as any).error || 'No se pudo obtener la información del video.', 'error');
                return;
            }
            
            setVideoInfo(data);

            const initialQueue: VideoQueueItem[] = data.videos.map(video => ({
                ...video,
                selectedQuality: format === 'audio' ? 'audio' : quality,
                selectedFormat: format,   
                status: 'pending',
                progress: 0,
            }));
            setDownloadQueue(initialQueue);

        } catch (error: any) {
            hideModal();
            showModal('Error', 'Hubo un problema al buscar el video. Intente de nuevo.', 'error');
            console.error("Search error:", error);
        }
    };

    const handleDownload = async () => {
        if (!url || !videoInfo) {
            showModal('Error', 'Por favor, primero busque un video e ingrese una URL de YouTube.', 'error');
            return;
        }

        setIsDownloading(true);
        setProgress(0);

        try {
            let selectedFormatId = null;
            if (videoInfo?.videos) {
                if (format === 'audio' && videoInfo.videos[0].formats.audio) {
                    selectedFormatId = videoInfo.videos[0].formats.audio.formatId;
                } else if (quality === 'highest' && videoInfo.videos[0].formats.highest) {
                    selectedFormatId = videoInfo.videos[0].formats.highest.formatId;
                } else if (videoInfo.videos[0].formats[quality]) {
                    selectedFormatId = videoInfo.videos[0].formats[quality].formatId;
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

    // Renamed and refactored from processDownloadQueue
    const executeDownloadForItem = async (itemToDownload: VideoQueueItem) => {
        if (!itemToDownload || itemToDownload.status !== 'pending') {
            console.warn("executeDownloadForItem called with invalid item or item not pending:", itemToDownload);
            setCurrentlyDownloadingVideoId(null); // Ensure we can proceed if called incorrectly
            return;
        }

        setIsDownloading(true);
        setCurrentlyDownloadingVideoId(itemToDownload.id);
        setDownloadQueue(prevQueue => 
            prevQueue.map(item => 
                item.id === itemToDownload.id ? { ...item, status: 'downloading', progress: 0, error: undefined } : item
            )
        );
        setProgress(0); // Reset global progress for the new item

        // Resolve formatId for the specific video and its selected quality/format
        let formatIdToUse: string | undefined = undefined;
        const { formats: itemFormats, selectedQuality: itemQuality, selectedFormat: itemFormat } = itemToDownload;

        if (itemFormat === 'audio') {
            formatIdToUse = itemFormats.audio?.formatId;
        } else {
            if (itemQuality === 'highest') {
                formatIdToUse = itemFormats.highest?.formatId;
            } else if (itemFormats[itemQuality]) {
                formatIdToUse = itemFormats[itemQuality]?.formatId;
            } else {
                // Fallback to highest if selected quality not found (e.g. after global change)
                formatIdToUse = itemFormats.highest?.formatId; 
            }
        }

        if (!formatIdToUse) {
            const errorMsg = `No se encontró formato para '${itemQuality}' (${itemFormat}) en: ${itemToDownload.title}`;
            showModal('Error de Formato', errorMsg, 'error');
            setDownloadQueue(prevQueue => 
                prevQueue.map(item => 
                    item.id === itemToDownload.id ? { ...item, status: 'error', error: errorMsg } : item
                )
            );
            setCurrentlyDownloadingVideoId(null); // Signal completion of this attempt
            return;
        }

        try {
            const videoUrlToDownload = itemToDownload.webpage_url;
            let downloadUrlPath = `/api/download?url=${encodeURIComponent(videoUrlToDownload)}&quality=${itemQuality}&format=${itemFormat}&formatId=${formatIdToUse}`;

            const response = await fetch(downloadUrlPath, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'No se pudo iniciar la descarga del video.');
            }

            const fetchedFilename = response.headers.get('X-Filename') || 
                                  (itemFormat === 'audio' ? `${itemToDownload.title}.mp3` : `${itemToDownload.title}.mp4`);

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No se pudo obtener el lector de la respuesta.");

            const contentLength = response.headers.get('Content-Length');
            const totalLength = contentLength ? parseInt(contentLength, 10) : 0;
            let receivedLength = 0;
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                if (totalLength > 0) {
                    const currentItemProgress = (receivedLength / totalLength) * 100;
                    setProgress(currentItemProgress); // Update global progress for UI
                    setDownloadQueue(prevQueue => 
                        prevQueue.map(item => 
                            item.id === itemToDownload.id ? { ...item, progress: currentItemProgress } : item
                        )
                    );
                }
            }

            const blob = new Blob(chunks);
            const downloadUrlBlob = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrlBlob;
            link.setAttribute('download', fetchedFilename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(downloadUrlBlob);

            // Modal is shown only for a short time
            setModalState({ isOpen: true, title: 'Descarga Completada', content: `${fetchedFilename} se ha descargado con éxito.`, type: 'success'});
            setDownloadQueue(prevQueue => 
                prevQueue.map(item => 
                    item.id === itemToDownload.id ? { ...item, status: 'completed', progress: 100 } : item
                )
            );
            setTimeout(hideModal, 2000);

        } catch (error: any) {
            console.error(`Error downloading ${itemToDownload.title}:`, error);
            // Modal is shown only for a short time
            setModalState({ isOpen: true, title: 'Error de Descarga', content: `Error al descargar ${itemToDownload.title}: ${error.message}`, type: 'error'});
            setDownloadQueue(prevQueue => 
                prevQueue.map(item => 
                    item.id === itemToDownload.id ? { ...item, status: 'error', error: error.message } : item
                )
            );
            setTimeout(hideModal, 3000); // Longer display for errors
        } finally {
            setCurrentlyDownloadingVideoId(null); // Signal completion of this item's download attempt
            
            const nextItemInQueue = downloadQueue.find(item => item.status === 'pending');
            
            if (isProcessingQueue && nextItemInQueue) {
                // Only continue if actively processing the queue and there's a next item
                executeDownloadForItem(nextItemInQueue);
            } else {
                // Stop processing or no more pending items
                setIsDownloading(false);
                setIsProcessingQueue(false); // Ensure this is reset if queue stops for any reason
                if (!nextItemInQueue && downloadQueue.length > 0 && downloadQueue.every(v => v.status === 'completed' || v.status === 'error' || v.status === 'skipped')) {
                    showModal('Cola Finalizada', 'Todos los videos en la cola han sido procesados.', 'info');
                }
            }
        }
    };
    
    const handleGlobalQualityChange = (newQuality: string) => {
        setQuality(newQuality);
        setDownloadQueue(prevQueue => prevQueue.map(item => 
            item.status === 'pending' ? { ...item, selectedQuality: newQuality } : item
        ));
    };

    const handleGlobalFormatChange = (newFormat: string) => {
        setFormat(newFormat);
        const newQuality = newFormat === 'audio' ? 'audio' : quality; // if format is audio, quality must be audio too
        if (newFormat === 'audio' && quality !== 'audio') setQuality('audio');

        setDownloadQueue(prevQueue => prevQueue.map(item =>
            item.status === 'pending' ? { ...item, selectedFormat: newFormat, selectedQuality: newQuality } : item
        ));
    };

    // Handlers for single item quality/format change (when classic view is shown)
    const handleSingleItemQualityChange = (itemId: string, newQuality: string) => {
        setDownloadQueue(prevQueue => prevQueue.map(item => 
            item.id === itemId ? { ...item, selectedQuality: newQuality } : item
        ));
    };

    const handleSingleItemFormatChange = (itemId: string, newFormat: string) => {
        const newQuality = newFormat === 'audio' ? 'audio' : (downloadQueue.find(i=>i.id===itemId)?.selectedQuality || 'highest');
        setDownloadQueue(prevQueue => prevQueue.map(item => 
            item.id === itemId ? { ...item, selectedFormat: newFormat, selectedQuality: newQuality } : item
        ));
    };

    const handleRemoveFromQueue = (videoId: string) => {
        if (currentlyDownloadingVideoId === videoId) {
            showModal('Aviso', 'No se puede remover un video mientras se está descargando.', 'info');
            return;
        }
        setDownloadQueue(prevQueue => prevQueue.filter(item => item.id !== videoId));
        if (downloadQueue.length -1 === 0) setVideoInfo(null);
    };

    const showClassicSingleVideoView = videoInfo && !videoInfo.isPlaylist && downloadQueue.length === 1;
    const singleVideoItem = showClassicSingleVideoView ? downloadQueue[0] : null;

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
                        disabled={(modalState.isOpen && modalState.type === 'loading') || isDownloading}
                    />
                </div>
                <button 
                    onClick={handleSearch} 
                    className={styles.searchButton}
                    disabled={(modalState.isOpen && modalState.type === 'loading') || isDownloading}
                >
                    <span>Buscar</span>
                    <Icon name="MagnifyingGlassIcon" solid className={styles.buttonIcon} />
                </button>
            </div>

            {showClassicSingleVideoView && singleVideoItem && (
                <div className={styles.videoDetails}>
                    <div className={styles.imgAndTitle}>
                        <img src={singleVideoItem.thumbnail} alt={singleVideoItem.title} />
                        <p>{singleVideoItem.title}</p>
                    </div>
                    <div className={styles.mainOptionsContainer}>
                        <div className={styles.optionsContainer}>
                            <label htmlFor={`qualitySelect-${singleVideoItem.id}`}>
                                <Icon name="AdjustmentsHorizontalIcon" className={styles.optionIcon} />
                                Resolución
                            </label>
                            <div className={styles.selectWrapper}>
                                <select 
                                    id={`qualitySelect-${singleVideoItem.id}`}
                                    value={singleVideoItem.selectedFormat === 'audio' ? 'audio' : singleVideoItem.selectedQuality}
                                    onChange={(e) => handleSingleItemQualityChange(singleVideoItem.id, e.target.value)}
                                    disabled={isDownloading || singleVideoItem.selectedFormat === 'audio'}
                                >
                                    {singleVideoItem.formats.highest && (
                                        <option value="highest">
                                            {singleVideoItem.formats.highest.quality} {singleVideoItem.formats.highest.resolution ? `(${singleVideoItem.formats.highest.resolution})` : ''} {singleVideoItem.formats.highest.note ? `[${singleVideoItem.formats.highest.note}]` : ''} - {singleVideoItem.formats.highest.size}
                                        </option>
                                    )}
                                    {Object.entries(singleVideoItem.formats)
                                        .filter(([key, formatDetail]) => 
                                            key !== 'highest' && 
                                            key !== 'audio' && 
                                            formatDetail && 
                                            formatDetail.vcodec !== 'none' &&
                                            formatDetail.resolution 
                                        )
                                        .map(([key, formatDetail]) => {
                                            let height = 0;
                                            const keyMatch = key.match(/^(\d+)p$/);
                                            if (keyMatch) {
                                                height = parseInt(keyMatch[1]);
                                            } else if (formatDetail?.resolution) {
                                                const resolutionMatch = formatDetail.resolution.match(/\d+x(\d+)/);
                                                if (resolutionMatch) {
                                                    height = parseInt(resolutionMatch[1]);
                                                }
                                            }
                                            return {
                                                key: key,
                                                label: `${formatDetail!.quality} ${formatDetail!.resolution ? `(${formatDetail!.resolution})` : ''} ${formatDetail!.note ? `[${formatDetail!.note}]` : ''} - ${formatDetail!.size}`,
                                                height: height 
                                            };
                                        })
                                        .sort((a, b) => b.height - a.height)
                                        .map(format => (
                                            <option key={format.key} value={format.key}>
                                                {format.label}
                                            </option>
                                        ))}
                                </select>
                                <Icon name="ChevronDownIcon" className={styles.selectIcon} />
                            </div>
                        </div>
                        <div className={styles.optionsContainer}>
                            <label htmlFor={`formatSelect-${singleVideoItem.id}`}>
                                <Icon name="FilmIcon" className={styles.optionIcon} />
                                Formato
                            </label>
                            <div className={styles.selectWrapper}>
                                <select 
                                    id={`formatSelect-${singleVideoItem.id}`}
                                    value={singleVideoItem.selectedFormat}
                                    onChange={(e) => handleSingleItemFormatChange(singleVideoItem.id, e.target.value)}
                                    disabled={isDownloading}
                                >
                                    <option value="video">Video (MP4)</option>
                                    {singleVideoItem.formats.audio && <option value="audio">Audio (MP3) - {singleVideoItem.formats.audio.size}</option>}
                                </select>
                                <Icon name="ChevronDownIcon" className={styles.selectIcon} />
                            </div>
                        </div>
                        <div className={styles.downloadContainer}>
                            <p className={styles.fileSize}>
                                <Icon name="DocumentIcon" className={styles.infoIcon} />
                                Tamaño estimado: {singleVideoItem.selectedFormat === 'audio' ? singleVideoItem.formats.audio?.size : singleVideoItem.formats[singleVideoItem.selectedQuality]?.size || singleVideoItem.formats.highest?.size}
                            </p>
                            <button 
                                onClick={() => { 
                                    if (singleVideoItem && singleVideoItem.status === 'pending' && !currentlyDownloadingVideoId) {
                                        setIsProcessingQueue(false); // Explicitly not processing a queue
                                        executeDownloadForItem(singleVideoItem);
                                    }
                                }}
                                disabled={isDownloading || singleVideoItem.status !== 'pending'} 
                                className={styles.downloadButton}
                            >
                                <span>{isDownloading && currentlyDownloadingVideoId === singleVideoItem.id ? 'Descargando...' : 'Descargar Video'}</span>
                                <Icon name="ArrowDownTrayIcon" solid className={styles.buttonIcon} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!showClassicSingleVideoView && downloadQueue.length > 0 && (
                <>
                    <div className={styles.globalOptionsContainer}>
                        <div className={styles.optionsContainer}>
                            <label htmlFor="globalQualitySelect">
                                <Icon name="AdjustmentsHorizontalIcon" className={styles.optionIcon} />
                                Calidad (videos pendientes)
                            </label>
                            <div className={styles.selectWrapper}>
                                <select 
                                    id="globalQualitySelect"
                                    value={format === 'audio' ? 'audio' : quality} 
                                    onChange={(e) => handleGlobalQualityChange(e.target.value)}
                                    disabled={isDownloading || format === 'audio' || downloadQueue.length === 0}
                                >
                                    {format === 'audio' ? (
                                        <option value="audio">Audio (según selección de formato)</option>
                                    ) : downloadQueue.length > 0 && downloadQueue[0] && downloadQueue[0].formats ? (
                                        <>
                                            {downloadQueue[0].formats.highest && (
                                                <option value="highest">
                                                    {`${downloadQueue[0].formats.highest.quality}${downloadQueue[0].formats.highest.resolution ? ` (${downloadQueue[0].formats.highest.resolution})` : ''}${downloadQueue[0].formats.highest.note ? ` [${downloadQueue[0].formats.highest.note}]` : ''} - ${downloadQueue[0].formats.highest.size}`}
                                                </option>
                                            )}
                                            {Object.entries(downloadQueue[0].formats)
                                                .filter(([key, formatDetail]) => 
                                                    key !== 'highest' && 
                                                    key !== 'audio' && 
                                                    formatDetail && 
                                                    formatDetail.vcodec !== 'none' &&
                                                    formatDetail.resolution 
                                                )
                                                .map(([key, formatDetail]) => {
                                                    let height = 0;
                                                    const keyMatch = key.match(/^(\d+)p$/);
                                                    if (keyMatch) {
                                                        height = parseInt(keyMatch[1]);
                                                    } else if (formatDetail?.resolution) {
                                                        const resolutionMatch = formatDetail.resolution.match(/\d+x(\d+)/);
                                                        if (resolutionMatch) {
                                                            height = parseInt(resolutionMatch[1]);
                                                        }
                                                    }
                                                    return {
                                                        key: key,
                                                        label: `${formatDetail!.quality}${formatDetail!.resolution ? ` (${formatDetail!.resolution})` : ''}${formatDetail!.note ? ` [${formatDetail!.note}]` : ''} - ${formatDetail!.size}`,
                                                        height: height 
                                                    };
                                                })
                                                .sort((a, b) => b.height - a.height)
                                                .map(format => (
                                                    <option key={format.key} value={format.key}>
                                                        {format.label}
                                                    </option>
                                                ))}
                                        </>
                                    ) : (
                                        <option value="highest">Máxima Video (predeterminado)</option> // Fallback if queue is empty
                                    )}
                                </select>
                                <Icon name="ChevronDownIcon" className={styles.selectIcon} />
                            </div>
                        </div>
                        <div className={styles.optionsContainer}>
                            <label htmlFor="globalFormatSelect">
                                <Icon name="FilmIcon" className={styles.optionIcon} />
                                Formato (videos pendientes)
                            </label>
                            <div className={styles.selectWrapper}>
                                <select 
                                    id="globalFormatSelect"
                                    value={format} 
                                    onChange={(e) => handleGlobalFormatChange(e.target.value)}
                                    disabled={isDownloading}
                                >
                                    <option value="video">Video (MP4)</option>
                                    <option value="audio">Audio (MP3)</option>
                                </select>
                                <Icon name="ChevronDownIcon" className={styles.selectIcon} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.queueContainer}>
                        {videoInfo?.isPlaylist && videoInfo.playlistTitle && (
                            <div className={styles.playlistHeader}>
                                {videoInfo.playlistThumbnail && 
                                    <img src={videoInfo.playlistThumbnail} alt={`Miniatura de ${videoInfo.playlistTitle}`} className={styles.playlistThumbnail} />
                                }
                                <h2>Playlist: {videoInfo.playlistTitle} ({downloadQueue.filter(v => v.status === 'pending' || v.status === 'downloading').length} videos restantes)</h2>
                            </div>
                        )}
                        {!videoInfo?.isPlaylist && downloadQueue.length > 1 && (
                             <h3>Videos en Cola:</h3>
                        )}

                        <ul className={styles.queueList}>
                            {downloadQueue.map((item) => (
                                <li key={item.id} className={`${styles.queueItem} ${styles[item.status]}`}>
                                    <img src={item.thumbnail} alt={item.title} className={styles.itemThumbnail} />
                                    <div className={styles.itemInfo}>
                                        <p className={styles.itemTitle}>{item.title}</p>
                                        <p className={styles.itemStatus}>
                                            Estado: {item.status} 
                                            {item.status === 'downloading' && ` (${Math.round(item.progress || 0)}%)`}
                                            {item.status === 'error' && item.error && ` - ${item.error}`}
                                        </p>
                                        <p className={styles.itemDetails}>Calidad: {item.selectedQuality === 'audio' ? 'N/A' : item.selectedQuality}, Formato: {item.selectedFormat}</p>
                                    </div>
                                    {item.status === 'pending' && (
                                        <button 
                                            onClick={() => handleRemoveFromQueue(item.id)} 
                                            className={styles.removeItemButton}
                                            disabled={isDownloading} 
                                            aria-label="Eliminar de la cola"
                                        >
                                            <Icon name="TrashIcon" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <button 
                            onClick={() => { 
                                const firstPendingItem = downloadQueue.find(item => item.status === 'pending');
                                if (firstPendingItem && !currentlyDownloadingVideoId) {
                                    setIsProcessingQueue(true); // Start processing the whole queue
                                    executeDownloadForItem(firstPendingItem);
                                }
                            }} 
                            className={styles.downloadButton} 
                            disabled={isDownloading || downloadQueue.every(v => v.status !== 'pending')}
                        >
                            <Icon name="ArrowDownTrayIcon" solid className={styles.buttonIcon} />
                            <span>
                                {isDownloading 
                                    ? `Descargando (${downloadQueue.filter(v=>v.status === 'downloading').length} de ${downloadQueue.length})` 
                                    : `Descargar ${downloadQueue.filter(v => v.status === 'pending').length} ${videoInfo?.isPlaylist ? 'Videos de Playlist' : (downloadQueue.length > 1 ? 'Videos en Cola' : 'Video')}`}
                            </span>
                        </button>
                    </div>
                </>
            )}

            {isDownloading && currentlyDownloadingVideoId && (
                <div className={styles.progressContainer}>
                    <p>
                        <Icon name="CloudArrowDownIcon" className={styles.progressIcon} />
                        Descargando: {downloadQueue.find(v => v.id === currentlyDownloadingVideoId)?.title || 'video'}... {Math.round(progress)}%
                    </p>
                    <progress value={progress} max="100" />
                </div>
            )}

            <Modal
                isOpen={modalState.isOpen}
                onClose={modalState.type === 'loading' ? () => {} : hideModal}
                title={modalState.title}
                type={modalState.type}
            >
                {modalState.content}
            </Modal>
        </div>
    );
};

export default Home;
