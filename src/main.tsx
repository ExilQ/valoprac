import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './app/ErrorBoundary';
import { App } from './app/App';
import './ui/styles.css';
import './ui/tokens.css';
import './ui/tactical.css';
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
import './ui/premium.css';

import './ui/operator.css';
