import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';

// Placeholder App - will be replaced by ui-shell teammate
function App() {
  return React.createElement('div', { id: 'app' }, 'self-review loading...');
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(React.createElement(App));
}
