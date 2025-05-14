import React from 'react';
import styles from './Modal.module.scss';
import Icon from '../Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  type?: 'success' | 'error' | 'loading' | 'info';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, type }) => {
  if (!isOpen) {
    return null;
  }

  let iconName = '';
  let iconClass = '';

  if (type === 'success') {
    iconName = 'CheckCircleIcon';
    iconClass = styles.iconSuccess;
  } else if (type === 'error') {
    iconName = 'XCircleIcon';
    iconClass = styles.iconError;
  } else if (type === 'loading') {
    iconName = 'ArrowPathIcon';
    iconClass = styles.iconLoading;
  } else if (type === 'info') {
    iconName = 'InformationCircleIcon';
    iconClass = styles.iconInfo;
  }


  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          {iconName && <Icon name={iconName} className={`${styles.modalTypeIcon} ${iconClass}`} />}
          {title && <h2 className={styles.modalTitle}>{title}</h2>}
          <button onClick={onClose} className={styles.closeButton} aria-label="Close modal">
            <Icon name="XMarkIcon" />
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal; 