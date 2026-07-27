import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { syncNativeTheme, type AppTheme } from './utils/nativeApp.ts'

const rootElement = document.documentElement;
let initialTheme: AppTheme = 'light';

try {
  const storedTheme = localStorage.getItem('theme_preference');
  initialTheme = storedTheme === 'dark' ? 'dark' : 'light';
  rootElement.classList.add(initialTheme);
} catch {
  rootElement.classList.add('light');
}

void syncNativeTheme(initialTheme);

createRoot(document.getElementById("root")!).render(<App />);
