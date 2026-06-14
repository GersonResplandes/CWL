import {
  Archive,
  Check,
  ChevronRight,
  CircleAlert,
  Crown,
  Database,
  Eye,
  EyeOff,
  History,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCcw,
  Shield,
  ShieldCheck,
  Star,
  Swords,
  Target,
  Trophy,
  Users,
  X
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import type { ClanMemberDetail, ClanRosterPayload, CwlPayload, HistoryItem } from '../shared/cwl';
import { api } from './api';

type View = 'overview' | 'roster' | 'cwl' | 'history';
type ApiBootStatus = 'checking' | 'waking' | 'ready' | 'failed';

function formatScore(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
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

function warPreferenceLabel(preference: string) {
  return preference === 'in' ? 'Disponível para guerras' : 'Fora das guerras';
}

function clearClientSessionData() {
  const cookieNames = document.cookie
    .split(';')
    .map(cookie => cookie.split('=')[0]?.trim())
    .filter(Boolean);
  const hostParts = window.location.hostname.split('.');
  const domainCandidates = hostParts.flatMap((_, index) => {
    const domain = hostParts.slice(index).join('.');
    return domain.includes('.') ? [domain, `.${domain}`] : [domain];
  });

  for (const name of cookieNames) {
    const encodedName = encodeURIComponent(name);
    document.cookie = `${encodedName}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    for (const domain of domainCandidates) {
      document.cookie = `${encodedName}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
    }
  }

  localStorage.clear();
  sessionStorage.clear();
}

function Login({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="login-atmosphere" aria-hidden="true" />
      <section className="login-panel">
        <img
          className="login-emblem"
          src="/images/cwl-trophy-emblem-transparent.png"
          alt=""
          aria-hidden="true"
        />

        <div className="login-heading">
          <span>Central</span>
          <h1>CWL</h1>
          <p>Centro de comando da Liga de Clãs</p>
        </div>

        <form onSubmit={submit} className="login-form">
          <div className="login-section-label" aria-hidden="true">
            <span />
            <strong>Acesso restrito</strong>
            <span />
          </div>
          <label className="sr-only" htmlFor="password">Senha do clã</label>
          <div className="login-input">
            <LockKeyhole size={20} aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Digite a senha do clã"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(current => !current)}
            >
              {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
            </button>
          </div>
          {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
          <button className="login-submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={19} /> : <ShieldCheck size={19} />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-access-note">
          <ShieldCheck size={19} />
          <span>Acesso exclusivo para líderes e colíderes</span>
        </div>
      </section>

      <div className="login-system-note">
        <Swords size={18} />
        <span>Sincronize, escale e lidere seu clã rumo à vitória</span>
      </div>
    </main>
  );
}

function ServerWakeScreen({
  status,
  attempts,
  onRetry
}: {
  status: ApiBootStatus;
  attempts: number;
  onRetry: () => void;
}) {
  const failed = status === 'failed';

  return (
    <main className="wake-shell">
      <section className="wake-panel" aria-live="polite">
        <img
          className="wake-emblem"
          src="/images/cwl-trophy-emblem-transparent.png"
          alt=""
          aria-hidden="true"
        />
        <p className="eyebrow">Servidor Render</p>
        <h1>{failed ? 'Servidor indisponível' : 'Acordando servidor'}</h1>
        <p>
          {failed
            ? 'A API demorou mais que o esperado para responder. Tente novamente em alguns segundos.'
            : 'No plano gratuito o backend pode dormir. Estamos tentando reconectar automaticamente.'}
        </p>

        <div className="wake-status">
          <span className={failed ? 'wake-rune failed' : 'wake-rune'}>
            {failed ? <CircleAlert size={28} /> : <LoaderCircle className="spin" size={30} />}
          </span>
          <div>
            <strong>{failed ? 'Tentativas pausadas' : 'Conectando com a API'}</strong>
            <small>{attempts > 0 ? `Tentativa ${attempts}` : 'Preparando primeira consulta'}</small>
          </div>
        </div>

        <button className="game-button game-button-primary" onClick={onRetry}>
          <RefreshCcw size={18} />
          Tentar novamente
        </button>
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

function MemberDetail({
  detail,
  loading,
  onClose
}: {
  detail: ClanMemberDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="member-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="member-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={detail ? `Perfil de ${detail.name}` : 'Carregando perfil do jogador'}
      >
        <button className="member-dialog-close" onClick={onClose} aria-label="Fechar perfil">
          <X size={22} />
        </button>

        {loading || !detail ? (
          <div className="member-detail-loading">
            <LoaderCircle className="spin" size={34} />
            <strong>Consultando perfil oficial...</strong>
          </div>
        ) : (
          <>
            <header className="member-detail-header">
              <div className="member-detail-league">
                {detail.leagueIconUrl ? (
                  <img src={detail.leagueIconUrl} alt="" aria-hidden="true" />
                ) : (
                  <Shield size={34} />
                )}
              </div>
              <div>
                <p>{roleLabel(detail.role)} · Nível {detail.expLevel}</p>
                <h2>{detail.name}</h2>
                <span>{detail.tag}</span>
              </div>
              <div className="member-detail-th">
                <small>Centro de Vila</small>
                <strong>CV{detail.th}</strong>
                {detail.townHallWeaponLevel > 0 && <span>Arma nível {detail.townHallWeaponLevel}</span>}
              </div>
            </header>

            <div className="member-detail-status">
              <span><Trophy size={17} />{detail.leagueName || 'Sem liga'}</span>
              <span className={detail.warPreference === 'in' ? 'war-ready' : ''}>
                <Swords size={17} />{warPreferenceLabel(detail.warPreference)}
              </span>
            </div>

            <div className="member-detail-stats">
              <article><Trophy size={20} /><span>Troféus</span><strong>{formatNumber(detail.trophies)}</strong><small>Recorde {formatNumber(detail.bestTrophies)}</small></article>
              <article><Star size={20} /><span>Estrelas de guerra</span><strong>{formatNumber(detail.warStars)}</strong></article>
              <article><Target size={20} /><span>Vitórias no ataque</span><strong>{formatNumber(detail.attackWins)}</strong></article>
              <article><ShieldCheck size={20} /><span>Vitórias na defesa</span><strong>{formatNumber(detail.defenseWins)}</strong></article>
              <article><Users size={20} /><span>Doações</span><strong>{formatNumber(detail.donations)}</strong><small>Recebidas {formatNumber(detail.donationsReceived)}</small></article>
              <article><Crown size={20} /><span>Contribuição da capital</span><strong>{formatNumber(detail.clanCapitalContributions)}</strong></article>
            </div>

            <section className="hero-levels">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Poder ofensivo</p>
                  <h3>Heróis da vila principal</h3>
                </div>
                <Crown size={24} />
              </div>
              {detail.heroes.length ? (
                <div className="hero-level-grid">
                  {detail.heroes.map(hero => (
                    <div key={hero.name}>
                      <span>{hero.name}</span>
                      <strong>{hero.level}</strong>
                      <small>de {hero.maxLevel}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="member-detail-empty">A Supercell não retornou heróis para este perfil.</p>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}

function App() {
  const [apiBootStatus, setApiBootStatus] = useState<ApiBootStatus>('checking');
  const [apiBootAttempts, setApiBootAttempts] = useState(0);
  const [apiBootRetry, setApiBootRetry] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeView, setActiveView] = useState<View>('overview');
  const [appConfig, setAppConfig] = useState<{ clanTag: string; sheetsConfigured: boolean } | null>(null);
  const [roster, setRoster] = useState<ClanRosterPayload | null>(null);
  const [cwl, setCwl] = useState<CwlPayload | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyConfigured, setHistoryConfigured] = useState(false);
  const [memberDetail, setMemberDetail] = useState<ClanMemberDetail | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const rosterBootstrapped = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = 0;

    async function checkHealth(attempt: number) {
      setApiBootAttempts(attempt);
      setApiBootStatus(attempt === 1 ? 'checking' : 'waking');

      try {
        await api.health(attempt === 1 ? 4500 : 9000);
        if (cancelled) return;
        setApiBootStatus('ready');
      } catch {
        if (cancelled) return;
        if (attempt >= 20) {
          setApiBootStatus('failed');
          return;
        }
        setApiBootStatus('waking');
        retryTimer = window.setTimeout(() => void checkHealth(attempt + 1), 3000);
      }
    }

    void checkHealth(1);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, [apiBootRetry]);

  useEffect(() => {
    if (apiBootStatus !== 'ready') return;
    api.session()
      .then(result => setAuthenticated(result.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthChecked(true));
  }, [apiBootStatus]);

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
    if (!memberDialogOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMemberDialogOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [memberDialogOpen]);

  function notify(text: string, error = false) {
    setMessage({ text, error });
    window.setTimeout(() => setMessage(null), 4000);
  }

  async function loadRoster() {
    setBusy('roster');
    try {
      const result = await api.roster();
      setRoster(result);
      notify(`${result.memberCount} membros carregados da Supercell.`);
    } catch (reason) {
      notify((reason as Error).message, true);
    } finally {
      setBusy('');
    }
  }

  async function loadMemberDetail(playerTag: string) {
    setMemberDetail(null);
    setMemberDialogOpen(true);
    setBusy('member');
    try {
      setMemberDetail(await api.member(playerTag));
    } catch (reason) {
      setMemberDialogOpen(false);
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
    clearClientSessionData();
    setAuthenticated(false);
    setRoster(null);
    setCwl(null);
    setHistoryItems([]);
    setHistoryConfigured(false);
    setMemberDetail(null);
    setMemberDialogOpen(false);
    rosterBootstrapped.current = false;
  }

  if (apiBootStatus !== 'ready') {
    return (
      <ServerWakeScreen
        status={apiBootStatus}
        attempts={apiBootAttempts}
        onRetry={() => setApiBootRetry(current => current + 1)}
      />
    );
  }

  if (!authChecked) {
    return <div className="boot-screen"><LoaderCircle className="spin" size={34} /></div>;
  }

  if (!authenticated) {
    return <Login onAuthenticated={() => setAuthenticated(true)} />;
  }

  const clan = roster?.config;
  const cwlSyncedRounds = cwl?.rounds.filter(round => round.warTag).length ?? 0;
  const cwlEndedRounds = cwl?.rounds.filter(round => round.state === 'warEnded').length ?? 0;
  const cwlAttackCount = cwl?.ranking.reduce((total, row) => total + row.stats.attacks, 0) ?? 0;
  const cwlTopPlayer = cwl?.ranking[0];

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
            ['roster', Users, 'Membros'],
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
          <section className="page-section" aria-label="Visão geral" />
        )}

        {activeView === 'roster' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <h1>Membros do clã</h1>
              </div>
            </div>

            {!roster ? (
              <EmptyState
                icon={Users}
                title="Membros ainda não carregados"
                description="Busque a lista oficial do clã na Supercell."
                action={<button className="game-button game-button-primary" onClick={() => void loadRoster()}>Carregar agora</button>}
              />
            ) : (
              <div className="roster-layout">
                <div className="member-grid">
                  {roster.members.map(member => (
                    <button
                      key={member.tag}
                      className="member-row"
                      onClick={() => void loadMemberDetail(member.tag)}
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
                        <small>{member.tag}</small>
                      </span>
                      <span className="th-badge">CV{member.th}</span>
                      <span className="member-meta">
                        <strong>{roleLabel(member.role)}</strong>
                        <small>{member.leagueName || 'Sem liga'}</small>
                      </span>
                      <ChevronRight className="member-open-icon" size={20} />
                    </button>
                  ))}
                </div>
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
              <div className="cwl-layout">
                <section className="cwl-summary-panel">
                  <div>
                    <p className="eyebrow">Temporada ativa</p>
                    <h2>{cwl.season}</h2>
                    <span>{cwl.config.league} · {statusLabel(cwl.groupState)}</span>
                  </div>
                  <div className="cwl-metrics">
                    <span><Swords size={20} /><strong>{cwlSyncedRounds}/7</strong><small>Rodadas</small></span>
                    <span><Trophy size={20} /><strong>{cwl.config.warWins}</strong><small>Vitórias</small></span>
                    <span><Star size={20} /><strong>{cwlAttackCount}</strong><small>Ataques</small></span>
                    <span><Crown size={20} /><strong>{cwlTopPlayer?.player.name ?? '--'}</strong><small>Líder atual</small></span>
                  </div>
                </section>

                <section className="round-strip" aria-label="Rodadas da CWL">
                  {cwl.rounds.map(round => (
                    <div key={round.day} className={round.warTag ? 'round-item round-item-ready' : 'round-item'}>
                      <span>Rodada {round.day}</span>
                      <strong>{statusLabel(round.state)}</strong>
                      <small>{round.warTag || 'Sem warTag'}</small>
                    </div>
                  ))}
                </section>

                <section className="ranking-section">
                  <div className="section-title">
                    <div>
                      <p className="eyebrow">Pontuação atual</p>
                      <h2>Ranking individual</h2>
                    </div>
                    <span className="ranking-counter">{cwlEndedRounds} encerrada(s)</span>
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
                </section>
              </div>
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
              <div className="history-layout">
                <section className="history-summary-panel">
                  <div>
                    <p className="eyebrow">Arquivo de guerra</p>
                    <h2>{historyItems.length} temporada(s) salva(s)</h2>
                    <span>Dados preservados fora da janela da API oficial.</span>
                  </div>
                  <Archive size={34} />
                </section>

                <div className="history-list">
                  {historyItems.map(item => (
                    <article key={item.cwlId}>
                      <div className="history-icon"><History size={21} /></div>
                      <div>
                        <strong>{item.season || item.cwlId}</strong>
                        <span>{item.league} · {item.format}</span>
                      </div>
                      <span className="history-state">{statusLabel(item.state)}</span>
                      <time>{new Date(item.updatedAt).toLocaleString('pt-BR')}</time>
                    </article>
                  ))}
                </div>
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

      {memberDialogOpen && (
        <MemberDetail
          detail={memberDetail}
          loading={busy === 'member'}
          onClose={() => setMemberDialogOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
