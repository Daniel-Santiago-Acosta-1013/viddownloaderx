import '../../styles/globals.scss';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '../context/ThemeContext';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }: AppProps) {
  // Prevenir problemas de hidratación eliminando la clase aplicada por el servidor
  useEffect(() => {
    document.body.dataset.theme = localStorage.getItem('theme') || 'light';
  }, []);

  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default MyApp;
