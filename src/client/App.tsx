import {
  Archive,
  Check,
  ChevronRight,
  CircleAlert,
  Crown,
  Database,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  Users
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { ClanRosterPayload, CwlPayload, HistoryItem } from '../shared/cwl';
import { api } from './api';

type View = 'overview' | 'roster' | 'cwl' | 'history';

const LINEUP_KEY = 'central-cwl-lineup-v1';
const LINEUP_SIZE_KEY = 'central-cwl-lineup-size-v1';

function formatScore(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
}

function roleLabel(role: string) {
  return ({
    leader: 'Líder',
    coLeader: 'Colíder',
    admin: 'Ancião',
    member: 'Membro'
  } as Record<string, string>)[role] || 'Membro';
}

function statusLabel(status: string) {
  return ({
    attacked: 'Atacou',
    wo: 'W.O.',
    pending: 'Pendente',
    notSelected: 'Reserva',
    inWar: 'Em guerra',
    preparation: 'Preparação',
    warEnded: 'Encerrada',
    notStarted: 'Aguardando'
  } as Record<string, string>)[status] || status;
}

function Login({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onAuthenticated();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark" aria-hidden="true">
          <Swords size={34} strokeWidth={2.6} />
        </div>
        <p className="eyebrow">Centro de comando da Liga de Clãs</p>
        <h1>Central CWL</h1>
        <p className="login-copy">
          Escalação, sincronização oficial e histórico da temporada em um único painel.
        </p>

        <form onSubmit={submit} className="login-form">
          <label htmlFor="password">Senha do clã</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Digite a senha compartilhada"
            required
          />
          {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
          <button className="game-button game-button-primary" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={19} /> : <ShieldCheck size={19} />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: typeof Archive;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeView, setActiveView] = useState<View>('overview');
  const [appConfig, setAppConfig] = useState<{ clanTag: string; sheetsConfigured: boolean } | null>(null);
  const [roster, setRoster] = useState<ClanRosterPayload | null>(null);
  const [cwl, setCwl] = useState<CwlPayload | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyConfigured, setHistoryConfigured] = useState(false);
  const [lineupSize, setLineupSize] = useState(() => {
    const savedSize = Number(localStorage.getItem(LINEUP_SIZE_KEY));
    return [15, 30].includes(savedSize) ? savedSize : 15;
  });
  const [lineup, setLineup] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LINEUP_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const rosterBootstrapped = useRef(false);

  useEffect(() => {
    api.session()
      .then(result => setAuthenticated(result.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    api.config()
      .then(setAppConfig)
      .catch(reason => notify((reason as Error).message, true));
    if (!rosterBootstrapped.current) {
      rosterBootstrapped.current = true;
      void loadRoster();
    }
  }, [authenticated]);

  useEffect(() => {
    localStorage.setItem(LINEUP_KEY, JSON.stringify(lineup));
  }, [lineup]);

  useEffect(() => {
    localStorage.setItem(LINEUP_SIZE_KEY, String(lineupSize));
  }, [lineupSize]);

  useEffect(() => {
    if (lineup.length > lineupSize) setLineup(current => current.slice(0, lineupSize));
  }, [lineupSize, lineup.length]);

  const selectedMembers = useMemo(() => {
    if (!roster) return [];
    const selected = new Set(lineup);
    return roster.members.filter(member => selected.has(member.tag));
  }, [lineup, roster]);

  function notify(text: string, error = false) {
    setMessage({ text, error });
    window.setTimeout(() => setMessage(null), 4000);
  }

  async function loadRoster() {
    setBusy('roster');
    try {
      const result = await api.roster();
      setRoster(result);
      const validTags = new Set(result.members.map(member => member.tag));
      setLineup(current => current.filter(tag => validTags.has(tag)).slice(0, lineupSize));
      notify(`${result.memberCount} membros carregados da Supercell.`);
    } catch (reason) {
      notify((reason as Error).message, true);
    } finally {
      setBusy('');
    }
  }

  async function syncCwl() {
    setBusy('cwl');
    try {
      const result = await api.syncCwl();
      setCwl(result);
      setActiveView('cwl');
      notify(result.persisted
        ? 'CWL sincronizada e salva no Google Sheets.'
        : 'CWL carregada. Configure o Apps Script para salvar o histórico.'
      );
    } catch (reason) {
      notify((reason as Error).message, true);
    } finally {
      setBusy('');
    }
  }

  async function loadHistory() {
    setBusy('history');
    try {
      const result = await api.history();
      setHistoryConfigured(result.configured);
      setHistoryItems(result.items);
    } catch (reason) {
      notify((reason as Error).message, true);
    } finally {
      setBusy('');
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined);
    setAuthenticated(false);
    setRoster(null);
    setCwl(null);
  }

  function selectAutomaticLineup() {
    if (!roster) return;
    setLineup(roster.members.slice(0, lineupSize).map(member => member.tag));
  }

  function toggleMember(tag: string) {
    setLineup(current => {
      if (current.includes(tag)) return current.filter(item => item !== tag);
      if (current.length >= lineupSize) {
        notify(`A escalação ${lineupSize}x${lineupSize} já está completa.`, true);
        return current;
      }
      return [...current, tag];
    });
  }

  if (!authChecked) {
    return <div className="boot-screen"><LoaderCircle className="spin" size={34} /></div>;
  }

  if (!authenticated) {
    return <Login onAuthenticated={() => setAuthenticated(true)} />;
  }

  const clan = roster?.config;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {clan?.badgeUrl ? (
            <img className="sidebar-badge" src={clan.badgeUrl} alt="" aria-hidden="true" />
          ) : (
            <div className="mini-shield"><Swords size={23} /></div>
          )}
          <div>
            <span>Central</span>
            <strong>CWL</strong>
          </div>
        </div>

        <nav aria-label="Navegação principal">
          {([
            ['overview', LayoutDashboard, 'Visão geral'],
            ['roster', Users, 'Escalação'],
            ['cwl', Swords, 'CWL atual'],
            ['history', History, 'Histórico']
          ] as const).map(([view, Icon, label]) => (
            <button
              key={view}
              className="nav-button"
              aria-label={label}
              aria-current={activeView === view ? 'page' : undefined}
              onClick={() => {
                setActiveView(view);
                if (view === 'history') void loadHistory();
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
              <ChevronRight size={16} />
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className={appConfig?.sheetsConfigured ? 'status-dot online' : 'status-dot'} />
          <div>
            <strong>{appConfig?.sheetsConfigured ? 'Histórico ativo' : 'Planilha pendente'}</strong>
            <span>{appConfig?.clanTag || 'Carregando tag...'}</span>
          </div>
        </div>

        <button className="logout-button" onClick={() => void logout()}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="clan-identity">
            {clan?.badgeUrl ? (
              <img src={clan.badgeUrl} alt={`Escudo do clã ${clan.clanName}`} />
            ) : (
              <div className="badge-placeholder"><Shield size={26} /></div>
            )}
            <div>
              <p>{clan?.clanName || 'Clã autorizado'}</p>
              <span>{clan?.league || 'Aguardando dados oficiais'}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="game-button game-button-primary"
              onClick={() => void syncCwl()}
              disabled={busy === 'cwl'}
            >
              {busy === 'cwl' ? <LoaderCircle className="spin" size={18} /> : <RefreshCcw size={18} />}
              Sincronizar
            </button>
          </div>
        </header>

        {activeView === 'overview' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Operação da temporada</p>
                <h1>Visão geral</h1>
                <p>Acompanhe a preparação do elenco e a captura dos dados oficiais.</p>
              </div>
              <span className="season-chip"><Sparkles size={16} /> Junho 2026</span>
            </div>

            <div className="stat-grid">
              <article className="stat-block">
                <Users size={22} />
                <span>Membros do clã</span>
                <strong>{roster?.memberCount ?? '--'}</strong>
              </article>
              <article className="stat-block">
                <Target size={22} />
                <span>Escalação preparada</span>
                <strong>{lineup.length}/{lineupSize}</strong>
              </article>
              <article className="stat-block">
                <Trophy size={22} />
                <span>Vitórias registradas</span>
                <strong>{cwl?.config.warWins ?? '--'}</strong>
              </article>
              <article className="stat-block">
                <Database size={22} />
                <span>Google Sheets</span>
                <strong>{appConfig?.sheetsConfigured ? 'Ativo' : 'Pendente'}</strong>
              </article>
            </div>

            <div className="operation-grid">
              <div className="operation-main">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Próxima ação</p>
                    <h2>Prepare a próxima CWL</h2>
                  </div>
                  <Crown size={28} />
                </div>
                <div className="step-list">
                  <button onClick={() => void loadRoster()}>
                    <span className={roster ? 'step-index done' : 'step-index'}>
                      {roster ? <Check size={17} /> : '1'}
                    </span>
                    <span><strong>Carregar membros</strong><small>Consulta o elenco atual na Supercell.</small></span>
                    <ChevronRight size={18} />
                  </button>
                  <button onClick={() => setActiveView('roster')}>
                    <span className={lineup.length === lineupSize ? 'step-index done' : 'step-index'}>
                      {lineup.length === lineupSize ? <Check size={17} /> : '2'}
                    </span>
                    <span><strong>Montar escalação</strong><small>Escolha 15 ou 30 participantes.</small></span>
                    <ChevronRight size={18} />
                  </button>
                  <button onClick={() => void syncCwl()}>
                    <span className={cwl ? 'step-index done' : 'step-index'}>
                      {cwl ? <Check size={17} /> : '3'}
                    </span>
                    <span><strong>Sincronizar CWL</strong><small>Captura rodadas, ataques e reservas.</small></span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <aside className="notice-panel">
                <CircleAlert size={24} />
                <h2>Formatos da liga</h2>
                <p>
                  Monte a escalação oficial no formato 15x15 ou 30x30 antes de sincronizar a temporada.
                </p>
                <div className="format-badges">
                  <span>15x15</span><span>30x30</span>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeView === 'roster' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Membros oficiais</p>
                <h1>Montar escalação</h1>
                <p>Selecione quem ficará disponível para a Liga de Clãs.</p>
              </div>
              <button className="game-button" onClick={() => void loadRoster()} disabled={busy === 'roster'}>
                {busy === 'roster' ? <LoaderCircle className="spin" size={18} /> : <RefreshCcw size={18} />}
                Carregar membros
              </button>
            </div>

            <div className="lineup-toolbar">
              <div className="format-control">
                {[15, 30].map(size => (
                  <button
                    key={size}
                    aria-pressed={lineupSize === size}
                    onClick={() => setLineupSize(size)}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>
              <strong className={lineup.length === lineupSize ? 'count-complete' : ''}>
                {lineup.length} de {lineupSize}
              </strong>
              <button className="text-button" onClick={selectAutomaticLineup} disabled={!roster}>
                Maiores CVs
              </button>
              <button className="text-button" onClick={() => setLineup([])} disabled={!lineup.length}>
                Limpar
              </button>
            </div>

            {!roster ? (
              <EmptyState
                icon={Users}
                title="Elenco ainda não carregado"
                description="Busque os membros oficiais do clã para começar a escalação."
                action={<button className="game-button game-button-primary" onClick={() => void loadRoster()}>Carregar agora</button>}
              />
            ) : (
              <div className="member-grid">
                {roster.members.map(member => {
                  const selected = lineup.includes(member.tag);
                  return (
                    <button
                      key={member.tag}
                      className="member-row"
                      aria-pressed={selected}
                      onClick={() => toggleMember(member.tag)}
                    >
                      <span className="member-emblem">
                        {member.leagueIconUrl ? (
                          <img
                            src={member.leagueIconUrl}
                            alt={member.leagueName ? `Liga ${member.leagueName}` : 'Emblema de liga'}
                            loading="lazy"
                          />
                        ) : (
                          <Shield size={18} />
                        )}
                      </span>
                      <span className="member-rank">{member.clanRank}</span>
                      <span className="member-info">
                        <strong>{member.name}</strong>
                        <small>{member.tag} · {roleLabel(member.role)}</small>
                      </span>
                      <span className="th-badge">CV{member.th}</span>
                      <span className="selection-indicator">{selected && <Check size={18} />}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedMembers.length > 0 && (
              <div className="lineup-summary">
                <ShieldCheck size={22} />
                <span>
                  <strong>{selectedMembers.length} jogadores selecionados.</strong>
                  A escolha fica salva neste navegador até a sincronização oficial.
                </span>
              </div>
            )}
          </section>
        )}

        {activeView === 'cwl' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Dados oficiais</p>
                <h1>CWL atual</h1>
                <p>Rodadas e desempenho importados diretamente da Supercell.</p>
              </div>
              {cwl && <span className="season-chip"><Swords size={16} /> {cwl.config.format}</span>}
            </div>

            {!cwl ? (
              <EmptyState
                icon={Swords}
                title="Nenhuma CWL sincronizada"
                description="Use o botão Sincronizar para consultar a temporada disponível."
                action={<button className="game-button game-button-primary" onClick={() => void syncCwl()}>Sincronizar CWL</button>}
              />
            ) : (
              <>
                <div className="round-strip">
                  {cwl.rounds.map(round => (
                    <div key={round.day} className="round-item">
                      <span>Rodada {round.day}</span>
                      <strong>{statusLabel(round.state)}</strong>
                      <small>{round.warTag || 'Sem warTag'}</small>
                    </div>
                  ))}
                </div>

                <div className="ranking-section">
                  <div className="section-title">
                    <div>
                      <p className="eyebrow">Pontuação atual</p>
                      <h2>Ranking individual</h2>
                    </div>
                    <Trophy size={27} />
                  </div>
                  <div className="ranking-table">
                    <div className="ranking-head">
                      <span>#</span><span>Jogador</span><span>Pontos</span><span>Estrelas</span><span>W.O.</span>
                    </div>
                    {cwl.ranking.map((row, index) => (
                      <div className="ranking-row" key={row.player.tag}>
                        <strong className={index < 3 ? 'podium-rank' : ''}>{index + 1}</strong>
                        <span><strong>{row.player.name}</strong><small>CV{row.player.th}</small></span>
                        <strong>{formatScore(row.stats.score)}</strong>
                        <span><Star size={15} />{row.stats.stars}</span>
                        <span>{row.stats.misses}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {activeView === 'history' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Google Sheets</p>
                <h1>Histórico das CWLs</h1>
                <p>Temporadas preservadas mesmo após deixarem a API oficial.</p>
              </div>
              <button className="game-button" onClick={() => void loadHistory()} disabled={busy === 'history'}>
                {busy === 'history' ? <LoaderCircle className="spin" size={18} /> : <RefreshCcw size={18} />}
                Atualizar
              </button>
            </div>

            {!historyConfigured ? (
              <EmptyState
                icon={Database}
                title="Google Sheets ainda não configurado"
                description="Publique o Apps Script e configure a URL e o segredo no backend da Render."
              />
            ) : historyItems.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="Nenhuma temporada armazenada"
                description="A primeira CWL aparecerá aqui depois da sincronização."
              />
            ) : (
              <div className="history-list">
                {historyItems.map(item => (
                  <article key={item.cwlId}>
                    <div className="history-icon"><History size={21} /></div>
                    <div>
                      <strong>{item.cwlId}</strong>
                      <span>{item.league} · {item.format}</span>
                    </div>
                    <span className="history-state">{statusLabel(item.state)}</span>
                    <time>{new Date(item.updatedAt).toLocaleString('pt-BR')}</time>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="fan-note">
          Este material não é oficial e não é endossado pela Supercell.
          <a href="https://supercell.com/en/fan-content-policy/" target="_blank" rel="noreferrer">
            Política de Conteúdo de Fãs
          </a>
        </footer>
      </main>

      {message && (
        <div className={message.error ? 'toast toast-error' : 'toast'}>
          {message.error ? <CircleAlert size={18} /> : <Check size={18} />}
          {message.text}
        </div>
      )}
    </div>
  );
}

export default App;
