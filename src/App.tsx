import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import {
  ArrowRight, ArrowUpRight, BarChart3, Camera, Check, ChevronLeft,
  CircleHelp, Clock3, Crosshair, Fingerprint, Github, Heart, Maximize2,
  MousePointer2, Pause, Play, RotateCcw, Settings2, ShieldCheck, Sparkles,
  Target, Trophy, VideoOff, X, Zap,
} from 'lucide-react';
import GameArena from './components/GameArena';
import { DEFAULT_SETTINGS, INITIAL_SNAPSHOT } from './game/types';
import type { ControlMode, GameMode, GameResult, GameSettings, GameSnapshot, LeaderboardEntry } from './game/types';
import './styles.css';

type Screen = 'home' | 'playing' | 'over' | 'stats';
const RUNS_KEY = 'katana-motion-runs-v1';
const LEADERS_KEY = 'katana-motion-leaders-v1';
const SETTINGS_KEY = 'katana-motion-settings-v1';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function permissionError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'O navegador não recebeu permissão para usar a webcam. Autorize o acesso à câmera na barra de endereços e tente novamente.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Nenhuma webcam foi encontrada neste dispositivo. Conecte uma câmera ou experimente o modo mouse.';
  if (name === 'NotReadableError') return 'A webcam pode estar sendo usada por outro aplicativo. Feche outros programas que utilizem a câmera.';
  if (!navigator.mediaDevices?.getUserMedia) return 'Seu navegador não oferece acesso à webcam neste endereço. Abra o jogo em HTTPS ou localhost.';
  return error instanceof Error ? `Não foi possível iniciar a câmera: ${error.message}` : 'Não foi possível iniciar a câmera. Tente o modo mouse.';
}

function Emblem({ compact = false }: { compact?: boolean }) {
  return <div className={`emblem ${compact ? 'emblem-small' : ''}`} aria-hidden="true"><span /><span /><i /></div>;
}

function ModeCard({
  mode, selected, title, description, icon: Icon, onClick,
}: { mode: ControlMode; selected: boolean; title: string; description: string; icon: typeof Camera; onClick: () => void }) {
  return (
    <button type="button" className={`mode-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={onClick}>
      <span className="mode-icon"><Icon size={23} strokeWidth={1.7} /></span>
      <span className="mode-copy"><strong>{title}</strong><small>{description}</small></span>
      <span className="mode-indicator">{selected ? <Check size={13} /> : mode === 'camera' ? '01' : '02'}</span>
    </button>
  );
}

function SettingsModal({ settings, onChange, onClose }: {
  settings: GameSettings;
  onChange: (value: GameSettings) => void;
  onClose: () => void;
}) {
  const settingsOptions: Array<{ key: keyof GameSettings; title: string; subtitle: string }> = [
    { key: 'mirror', title: 'Espelhar câmera', subtitle: 'O movimento fica igual ao de um espelho.' },
    { key: 'showVideo', title: 'Mostrar imagem da câmera', subtitle: 'Exibir o vídeo ao fundo da partida.' },
    { key: 'showLandmarks', title: 'Mostrar pontos das mãos', subtitle: 'Visualizar as articulações detectadas pela IA.' },
    { key: 'showTrail', title: 'Rastro da lâmina', subtitle: 'Exibir o traço brilhante durante os cortes.' },
    { key: 'sound', title: 'Efeitos sonoros', subtitle: 'Sons de cortes, bombas e vidas.' },
    { key: 'reducedEffects', title: 'Efeitos reduzidos', subtitle: 'Menos partículas para máquinas mais lentas.' },
  ];
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-head"><div><span className="eyebrow">PERSONALIZE SUA EXPERIÊNCIA</span><h2 id="settings-title">AJUSTES <span>DO JOGO.</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar ajustes"><X size={22} /></button></div>
        <div className="settings-list">
          {settingsOptions.map(option => (
            <label className="settings-row" key={option.key}>
              <span><strong>{option.title}</strong><small>{option.subtitle}</small></span>
              <input type="checkbox" checked={settings[option.key]} onChange={event => onChange({ ...settings, [option.key]: event.target.checked })} />
              <span className="toggle" aria-hidden="true"><i /></span>
            </label>
          ))}
        </div>
        <div className="modal-foot"><ShieldCheck size={17} /><span>Seu vídeo é processado localmente. Nenhuma imagem da câmera é enviada ou armazenada.</span></div>
        <button className="button-primary full-width" onClick={onClose}>SALVAR PREFERÊNCIAS <ArrowRight size={18} /></button>
      </section>
    </div>
  );
}

function Scoreboard({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <div className="hud-stats" aria-label="Placar">
      <div className="hud-stat"><span>PONTUAÇÃO</span><strong>{snapshot.score.toLocaleString('pt-BR')}</strong></div>
      <div className="hud-divider" />
      <div className="hud-stat"><span>COMBO</span><strong className="accent-number">x{snapshot.combo}</strong></div>
      <div className="hud-divider" />
      <div className="hud-stat lives-stat"><span>VIDAS</span><div className="lives-hearts">{Array.from({ length: 5 }, (_, index) => <Heart key={index} size={19} fill={index < snapshot.lives ? 'currentColor' : 'none'} className={index < snapshot.lives ? 'heart-active' : 'heart-empty'} />)}</div></div>
    </div>
  );
}

function StatsScreen({ runs, leaderboard, onBack }: {
  runs: GameResult[];
  leaderboard: LeaderboardEntry[];
  onBack: () => void;
}) {
  const best = Math.max(0, ...runs.map(run => run.score));
  const average = runs.length ? Math.round(runs.reduce((sum, run) => sum + run.score, 0) / runs.length) : 0;
  const accuracy = runs.length ? Math.round(runs.reduce((sum, run) => sum + run.accuracy, 0) / runs.length) : 0;
  const graph = runs.slice(0, 10).reverse();
  const maxGraph = Math.max(10, ...graph.map(run => run.score));
  return (
    <main className="stats-page page-enter">
      <div className="page-heading"><div><span className="eyebrow">SEU HISTÓRICO // SALVO NESTE NAVEGADOR</span><h1>O CAMINHO <em>DO NINJA.</em></h1><p>Acompanhe seus recordes e evolua golpe após golpe.</p></div><button className="button-outline" onClick={onBack}><ChevronLeft size={18} /> VOLTAR AO INÍCIO</button></div>
      <div className="stats-summary">
        {[{ label: 'PARTIDAS', value: runs.length, icon: <Play size={19} /> }, { label: 'RECORDE', value: best, icon: <Trophy size={19} /> }, { label: 'MÉDIA DE PONTOS', value: average, icon: <BarChart3 size={19} /> }, { label: 'PRECISÃO MÉDIA', value: `${accuracy}%`, icon: <Target size={19} /> }].map(item => <div className="stats-tile" key={item.label}><div><span>{item.label}</span>{item.icon}</div><strong>{item.value}</strong></div>)}
      </div>
      <div className="stats-columns">
        <section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">EVOLUÇÃO</span><h2>ÚLTIMAS PARTIDAS</h2></div><span className="muted-small">{graph.length} REGISTROS</span></div>
          {graph.length ? <div className="chart-bars" aria-label="Gráfico de pontos por partida">{graph.map((run, index) => <div className="chart-col" key={`${run.createdAt}-${index}`} title={`${run.score} pontos`}><span>{run.score}</span><div className="chart-bar" style={{ height: `${Math.max(5, (run.score / maxGraph) * 100)}%` }} /><small>{index + 1}ª</small></div>)}</div> : <div className="empty-state"><BarChart3 size={38} /><p>Seu histórico começa na primeira partida.</p></div>}
        </section>
        <section className="panel rank-panel"><div className="panel-heading"><div><span className="eyebrow">HALL DA FAMA</span><h2>RANKING LOCAL</h2></div><Trophy size={22} className="icon-accent" /></div>
          {leaderboard.length ? <ol className="rank-list">{leaderboard.slice(0, 7).map((entry, index) => <li key={entry.id}><span className="rank-position">{String(index + 1).padStart(2, '0')}</span><span className="rank-name">{entry.name}<small>{entry.mode === 'camera' ? 'WEBCAM' : 'MOUSE'}</small></span><strong>{entry.score}</strong></li>)}</ol> : <div className="empty-state"><Trophy size={37} /><p>Nenhum resultado salvo no ranking ainda.</p></div>}
        </section>
      </div>
      <div className="privacy-line"><ShieldCheck size={15} /> Dados gravados somente no armazenamento deste navegador, sem conta e sem servidor.</div>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<ControlMode>('camera');
  const [gameMode, setGameMode] = useState<GameMode>('arcade');
  const [settings, setSettings] = useState<GameSettings>(() => ({ ...DEFAULT_SETTINGS, ...loadJSON(SETTINGS_KEY, {}) }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('PREPARANDO A ARENA');
  const [error, setError] = useState('');
  const [gameError, setGameError] = useState('');
  const [snapshot, setSnapshot] = useState<GameSnapshot>({ ...INITIAL_SNAPSHOT });
  const [finalResult, setFinalResult] = useState<GameResult | null>(null);
  const [runs, setRuns] = useState<GameResult[]>(() => loadJSON(RUNS_KEY, []));
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadJSON(LEADERS_KEY, []));
  const [playerName, setPlayerName] = useState('');
  const [savedResult, setSavedResult] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    landmarkerRef.current?.close();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  function backHome() {
    stopCamera();
    setPaused(false);
    setError('');
    setGameError('');
    setScreen('home');
  }

  async function startGame() {
    if (loading) return;
    setLoading(true);
    setError('');
    setGameError('');
    setPaused(false);
    setSnapshot({ ...INITIAL_SNAPSHOT });
    setSavedResult(false);
    setPlayerName('');
    stopCamera();
    try {
      if (mode === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('A webcam requer um endereço HTTPS ou localhost.');
        setLoadingLabel('SOLICITANDO ACESSO À CÂMERA');
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        if (!landmarkerRef.current) {
          setLoadingLabel('CARREGANDO VISÃO COMPUTACIONAL');
          const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
          const vision = await FilesetResolver.forVisionTasks('/wasm');
          const baseOptions = { modelAssetPath: '/models/hand_landmarker.task' };
          try {
            landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
              baseOptions: { ...baseOptions, delegate: 'GPU' },
              runningMode: 'VIDEO', numHands: 2,
              minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.55, minTrackingConfidence: 0.55,
            });
          } catch {
            landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
              baseOptions: { ...baseOptions, delegate: 'CPU' },
              runningMode: 'VIDEO', numHands: 2,
              minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.55, minTrackingConfidence: 0.55,
            });
          }
        }
      }
      setLoadingLabel('PARTIDA PRONTA');
      setScreen('playing');
    } catch (caught) {
      stopCamera();
      setError(permissionError(caught));
      setScreen('home');
    } finally { setLoading(false); }
  }

  function finishGame(result: GameSnapshot) {
    const final: GameResult = {
      ...result,
      accuracy: result.swings ? Math.min(100, Math.round(result.fruitHits / result.swings * 100)) : 0,
      mode, gameMode, createdAt: new Date().toISOString(),
    };
    setFinalResult(final);
    setRuns(previous => {
      const updated = [final, ...previous].slice(0, 100);
      localStorage.setItem(RUNS_KEY, JSON.stringify(updated));
      return updated;
    });
    stopCamera();
    setScreen('over');
  }

  function saveResult() {
    if (!finalResult || savedResult) return;
    const entry: LeaderboardEntry = {
      ...finalResult,
      id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
      name: playerName.trim().slice(0, 24) || 'Ninja',
    };
    setLeaderboard(previous => {
      const updated = [...previous, entry].sort((a, b) => b.score - a.score).slice(0, 30);
      localStorage.setItem(LEADERS_KEY, JSON.stringify(updated));
      return updated;
    });
    setSavedResult(true);
  }

  function openSettings() {
    if (screen === 'playing') setPaused(true);
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    if (screen === 'playing' && !gameError) setPaused(false);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={backHome} aria-label="Katana Motion, voltar ao início"><Emblem /><span><strong>KATANA<span className="brand-dot">.</span></strong><small>MOTION LAB</small></span></button>
          <div className="header-status"><span className="status-pulse" /> HAND TRACKING <b>ENGINE ONLINE</b></div>
          <nav className="header-nav" aria-label="Navegação">
            <button onClick={() => { stopCamera(); setScreen('stats'); }}><Trophy size={17} /> <span>RANKING</span></button>
            <button onClick={openSettings}><Settings2 size={17} /> <span>AJUSTES</span></button>
            <a href="https://github.com/Mart1nsHiago" target="_blank" rel="noreferrer"><Github size={18} /> <span>GITHUB</span> <ArrowUpRight size={14} /></a>
          </nav>
        </div>
      </header>

      {screen === 'home' && (
        <main className="home-page page-enter">
          <section className="hero">
            <div className="hero-content">
              <div className="eyebrow-with-line"><span className="mini-spark">✳</span> ARCADE EXPERIMENTAL <span className="tiny-line" /> EXPERIÊNCIA #001</div>
              <h1>SUA MÃO<br />É A <span>LÂMINA<span className="title-stop">.</span></span></h1>
              <p>Esqueça o controle. Use seus movimentos para cortar frutas, criar combos e desafiar seus reflexos. <strong>Você é o jogador e a arma.</strong></p>
              <div className="hero-badges"><span><Fingerprint size={16} /> VISÃO COMPUTACIONAL</span><span><Zap size={16} /> TEMPO REAL</span><span><Crosshair size={16} /> 2 MÃOS</span></div>
              <div className="hero-line"><span>01 / 03</span><div /><strong>EXPLORE UM NOVO JEITO DE JOGAR</strong></div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-halo art-halo-one" /><div className="art-halo art-halo-two" /><div className="art-halo art-halo-three" />
              <div className="art-corner top-left" /><div className="art-corner top-right" /><div className="art-corner bottom-left" /><div className="art-corner bottom-right" />
              <div className="art-slasher"><span className="slash-cut slash-cut-a" /><span className="slash-cut slash-cut-b" /><i className="slash-core" /></div>
              <div className="art-fruit art-fruit-orange"><span /></div>
              <div className="art-fruit art-fruit-red"><span /></div>
              <div className="art-fruit art-fruit-lime"><span /></div>
              <div className="art-caption"><span>CAM 01 // MOTION DETECTED</span><b>✳</b></div>
              <div className="art-crosshair">+</div>
            </div>
          </section>

          <section className="game-setup" aria-label="Configuração da partida">
            <div className="setup-title"><div><span className="eyebrow">PRONTO PARA O DESAFIO?</span><h2>ESCOLHA SEU <em>ESTILO.</em></h2></div><p>Dois jeitos de jogar. Uma missão: não deixar nenhuma fruta escapar.</p></div>
            <div className="setup-grid">
              <div className="setup-main">
                <div className="setup-label">01 <span>COMO VOCÊ VAI JOGAR</span></div>
                <div className="mode-grid">
                  <ModeCard mode="camera" selected={mode === 'camera'} title="PELA WEBCAM" description="Corte as frutas com a ponta do seu dedo." icon={Camera} onClick={() => setMode('camera')} />
                  <ModeCard mode="mouse" selected={mode === 'mouse'} title="COM O MOUSE" description="Clique e arraste para usar a lâmina." icon={MousePointer2} onClick={() => setMode('mouse')} />
                </div>
                <div className="setup-label setup-second-label">02 <span>TIPO DE PARTIDA</span></div>
                <div className="challenge-options">
                  <button onClick={() => setGameMode('arcade')} className={gameMode === 'arcade' ? 'active' : ''}><Sparkles size={16} /> MODO LIVRE <span>↗</span></button>
                  <button onClick={() => setGameMode('daily')} className={gameMode === 'daily' ? 'active' : ''}><Clock3 size={16} /> DESAFIO DIÁRIO <span>↗</span></button>
                </div>
              </div>
              <div className="start-panel">
                <div className="start-panel-top"><span className="panel-kicker">SUA PRÓXIMA PARTIDA</span><Maximize2 size={18} /></div>
                <div className="start-symbol"><Emblem compact /></div>
                <p>{mode === 'camera' ? 'Posicione-se diante da webcam, mantenha uma boa iluminação e prepare sua mão.' : 'Seu mouse virou uma katana. Segure o botão e atravesse as frutas.'}</p>
                <button className="button-primary start-button" disabled={loading} onClick={() => void startGame()}>{loading ? loadingLabel : 'COMEÇAR A JOGAR'} <ArrowRight size={20} /></button>
                <span className="start-disclaimer"><ShieldCheck size={14} /> {mode === 'camera' ? 'Sua câmera é processada localmente.' : 'Não precisa de câmera nem de cadastro.'}</span>
                {error && <div className="error-banner" role="alert"><VideoOff size={19} /><span>{error}</span><button onClick={() => { setMode('mouse'); setError(''); }}>MODO MOUSE</button></div>}
              </div>
            </div>
          </section>

          <section className="how-strip"><div><span className="how-index">01</span><Crosshair size={25} /><span><strong>ENCONTRE O ALVO</strong><small>As frutas aparecem aleatoriamente na arena.</small></span></div><div><span className="how-index">02</span><Zap size={26} /><span><strong>MOVA PARA CORTAR</strong><small>Use o indicador ou arraste o mouse.</small></span></div><div><span className="how-index">03</span><Heart size={26} /><span><strong>SOBREVIVA</strong><small>Evite bombas e proteja suas cinco vidas.</small></span></div></section>
        </main>
      )}

      {screen === 'playing' && (
        <main className="play-page page-enter">
          <div className="game-header"><div className="game-heading"><span className="eyebrow">{gameMode === 'daily' ? 'DESAFIO DO DIA' : 'MODO LIVRE'} // {mode === 'camera' ? 'HAND TRACKING' : 'MOUSE CONTROL'}</span><h1>CORTE. COMBINE. <em>SOBREVIVA.</em></h1></div><div className="hud-controls"><button className="button-outline smaller" onClick={() => setPaused(value => !value)}>{paused ? <Play size={17} /> : <Pause size={17} />}{paused ? 'CONTINUAR' : 'PAUSAR'}</button><button className="icon-button outlined" onClick={openSettings} aria-label="Abrir ajustes"><Settings2 size={20} /></button><button className="icon-button outlined" onClick={backHome} aria-label="Encerrar partida"><X size={20} /></button></div></div>
          <div className="hud"><Scoreboard snapshot={snapshot} /><div className="hud-timer"><Clock3 size={16} /> {formatTime(snapshot.elapsed)}</div></div>
          <div className="arena-holder">
            <GameArena mode={mode} gameMode={gameMode} settings={settings} stream={streamRef.current} landmarker={landmarkerRef.current} paused={paused} onSnapshot={setSnapshot} onEnd={finishGame} onVisionError={message => { setGameError(message); setPaused(true); }} />
            {paused && <div className="pause-overlay"><span className="eyebrow">PARTIDA INTERROMPIDA</span><h2>{gameError ? 'CÂMERA INDISPONÍVEL' : 'RESPIRA. FOCA.'}</h2><p>{gameError || 'Seus reflexos podem descansar por um instante.'}</p><button className="button-primary" onClick={() => { if (gameError) backHome(); else setPaused(false); }}>{gameError ? 'VOLTAR AO INÍCIO' : 'CONTINUAR PARTIDA'} <ArrowRight size={19} /></button></div>}
          </div>
          <div className="game-footer"><span><span className="live-dot" /> {mode === 'camera' ? 'CÂMERA EM TEMPO REAL' : 'CONTROLE POR MOUSE'}</span><span><CircleHelp size={15} /> {mode === 'camera' ? 'Movimente rapidamente o dedo indicador para cortar.' : 'Clique, segure e arraste o cursor sobre as frutas.'}</span><span><ShieldCheck size={15} /> PRIVACIDADE LOCAL</span></div>
        </main>
      )}

      {screen === 'over' && finalResult && (
        <main className="results-page page-enter"><div className="result-main"><div className="result-left"><span className="eyebrow">SESSÃO FINALIZADA // JOGO ENCERRADO</span><div className="result-symbol">✳</div><h1>FIM DE <em>JOGO.</em></h1><p>Todo mestre já foi um iniciante. Afie os reflexos e volte para a arena.</p><div className="result-stats"><div><span>PONTUAÇÃO</span><strong>{finalResult.score}</strong></div><div><span>MELHOR COMBO</span><strong>x{finalResult.maxCombo}</strong></div><div><span>PRECISÃO</span><strong>{finalResult.accuracy}%</strong></div><div><span>FRUTAS CORTADAS</span><strong>{finalResult.fruitHits}</strong></div></div><div className="result-actions"><button className="button-primary" onClick={() => void startGame()}>JOGAR NOVAMENTE <RotateCcw size={19} /></button><button className="button-outline" onClick={backHome}>VOLTAR AO INÍCIO</button></div></div>
          <div className="result-right"><div className="result-right-top"><Trophy size={24} /><span>HALL DA FAMA</span></div><h2>DEIXE SUA <em>MARCA.</em></h2><p>Salve sua pontuação no ranking deste navegador.</p><label htmlFor="player-name">NOME DO JOGADOR</label><input id="player-name" maxLength={24} placeholder="Ex.: Ninja" value={playerName} onChange={event => setPlayerName(event.target.value)} disabled={savedResult} /><button className="button-secondary full-width" disabled={savedResult} onClick={saveResult}>{savedResult ? 'RESULTADO SALVO' : 'SALVAR NO RANKING'} {savedResult ? <Check size={18} /> : <ArrowRight size={18} />}</button><div className="ranking-preview"><strong>TOP 3 LOCAL</strong>{leaderboard.slice(0, 3).map((entry, index) => <div key={entry.id}><span>{index + 1}. {entry.name}</span><b>{entry.score} PTS</b></div>)}{!leaderboard.length && <small>Seja o primeiro a aparecer aqui.</small>}</div><button className="text-link" onClick={() => setScreen('stats')}>VER MEU DESEMPENHO <ArrowUpRight size={15} /></button></div></div></main>
      )}

      {screen === 'stats' && <StatsScreen runs={runs} leaderboard={leaderboard} onBack={backHome} />}

      <footer className="site-footer"><div><Emblem compact /><span>KATANA MOTION <b>© {new Date().getFullYear()}</b></span></div><p>FEITO PARA MOVER. CRIADO PARA JOGAR.</p><span>BUILD 0.1 / <span className="footer-accent">HIAGO MARTINS</span></span></footer>
      {settingsOpen && <SettingsModal settings={settings} onChange={setSettings} onClose={closeSettings} />}
    </div>
  );
}
