import {initializeTheme} from './ui/theme/theme';
import {initializeKoreanInterface} from './i18n/locale';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './app/ErrorBoundary';
import { App } from './app/App';
import './ui/styles.css';
import './ui/tokens.css';
import './ui/tactical.css';
initializeTheme();
initializeKoreanInterface();
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
import './ui/premium.css';

import './ui/operator.css';

import './ui/precisionUtility.css';
import './ui/patchNotes.css';
import './ui/interfaceRefinement.css';
