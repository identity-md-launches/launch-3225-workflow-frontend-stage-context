import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadDeployment, type Config } from './config';
import './style.css';

function Root() {
  const [config, setConfig] = useState<Config>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setError(''); loadDeployment().then((value) => { if (active) setConfig(value); }).catch((e) => { if (active) setError(e.message); }); return () => { active = false; }; }, [retry]);
  if (config) return <App config={config} />;
  return <main className="wrap boot"><img src="./favicon.svg" alt="" width="48" height="48" /><h1>GTA 6 in 2026?</h1><p>Bet ETH on a full release by December 31.</p><p role="status">{error || 'Loading the verified deployment…'}</p>{error && <button className="primary" onClick={() => setRetry(retry + 1)}>Retry configuration</button>}</main>;
}
createRoot(document.getElementById('root')!).render(<Root />);
