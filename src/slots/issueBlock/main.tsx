import { createRoot } from 'react-dom/client';

import { TrackerPluginProvider } from '@weavix/tracker-plugin-sdk-react';

import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';

import App from './App';

createRoot(document.getElementById('root')!).render(
    <TrackerPluginProvider>
        <App />
    </TrackerPluginProvider>,
);
