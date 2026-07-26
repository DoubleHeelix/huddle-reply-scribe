import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const rootElement = document.documentElement;

try {
  const storedTheme = localStorage.getItem('theme_preference');
  rootElement.classList.add(storedTheme === 'dark' ? 'dark' : 'light');
} catch {
  rootElement.classList.add('light');
}

createRoot(document.getElementById("root")!).render(<App />);
