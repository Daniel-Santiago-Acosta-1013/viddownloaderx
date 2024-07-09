import React from 'react';
import styles from './ProgressButton.module.scss';

interface ProgressButtonProps {
    progress: number;
    isDownloading: boolean;
    onClick: () => void;
}

const ProgressButton: React.FC<ProgressButtonProps> = ({ progress, isDownloading, onClick }) => {
    return (
        <button 
            className={styles.progressButton} 
            onClick={onClick} 
            disabled={isDownloading}
        >
            <div 
                className={styles.progress} 
                style={{ width: `${progress}%` }}
            />
            <span className={styles.buttonText}>
                {isDownloading ? `Downloading... ${Math.round(progress)}%` : 'Download'}
            </span>
        </button>
    );
};

export default ProgressButton;
