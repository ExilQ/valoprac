import {initializeTheme} from './ui/theme/theme';
import {initializeLocale} from './i18n/locale';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './app/ErrorBoundary';
import { App } from './app/App';
import './ui/styles.css';
import './ui/tokens.css';
import './ui/tactical.css';
initializeTheme();
const root=createRoot(document.getElementById('root')!);
void initializeLocale().then(()=>root.render(<ErrorBoundary><App/></ErrorBoundary>));
import './ui/premium.css';

import './ui/operator.css';

import './ui/precisionUtility.css';
import './ui/patchNotes.css';
import './ui/interfaceRefinement.css';
import './ui/designRefresh.css';
