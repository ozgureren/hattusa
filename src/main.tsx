import { installSafeWindowFetchGuard } from './utils/safeWindowFetch';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

installSafeWindowFetchGuard();

createRoot(document.getElementById('root')!).render(<App />);
