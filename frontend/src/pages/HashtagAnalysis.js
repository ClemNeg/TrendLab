import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import Header from '../components/Header';
import '../styles/HashtagAnalysis.css';

const HashtagAnalysis = () => {
  const { hashtag } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [musicSearch, setMusicSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/analytics/${hashtag}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [hashtag]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toLocaleString() || 0;
  };

  const filteredMusics = analytics?.topMusics.filter(music => 
    music.name.toLowerCase().includes(musicSearch.toLowerCase()) ||
    music.artist.toLowerCase().includes(musicSearch.toLowerCase())
  ) || [];

  const filteredAccounts = analytics?.topAccounts.filter(account =>
    account.username.toLowerCase().includes(accountSearch.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="analysis-loading">
        <Header />
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Analyse en cours...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analysis-error">
        <Header />
        <div className="error-content">
          <p>Impossible de charger les données d'analyse</p>
          <Link to="/" className="back-link">← Retour</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-page">
      <Header />
      
      <div className="analysis-header">
        <Link to="/" className="back-button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Retour
        </Link>
        <h1 className="analysis-title">
          <span className="title-hash">#</span>
          {hashtag}
          <span className="title-badge">Analyse</span>
        </h1>
      </div>

      <div className="analysis-content">
        {/* Global Stats */}
        {analytics.globalStats && (
          <div className="global-stats-card">
            <div className="card-header">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18"/>
                <path d="M18 17V9"/>
                <path d="M13 17V5"/>
                <path d="M8 17v-3"/>
              </svg>
              <h2 className="card-title">Statistiques globales de la niche</h2>
            </div>
            <div className="global-stats-grid">
              <div className="global-stat-item">
                <div className="stat-icon views">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Vues moyennes</div>
                  <div className="stat-value">{formatNumber(analytics.globalStats.avgViews)}</div>
                </div>
              </div>

              <div className="global-stat-item">
                <div className="stat-icon likes">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Likes moyens</div>
                  <div className="stat-value">{formatNumber(analytics.globalStats.avgLikes)}</div>
                </div>
              </div>

              <div className="global-stat-item">
                <div className="stat-icon comments">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Commentaires moyens</div>
                  <div className="stat-value">{formatNumber(analytics.globalStats.avgComments)}</div>
                </div>
              </div>

              <div className="global-stat-item">
                <div className="stat-icon followers">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Abonnés moyens</div>
                  <div className="stat-value">{formatNumber(analytics.globalStats.avgFollowers)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="analytics-grid">
          {/* Top Musics */}
          <div className="analytics-card">
            <div className="card-header">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              <h2 className="card-title">Musiques les plus performantes</h2>
            </div>
            <div className="card-content">
              {analytics.topMusics.length > 0 ? (
                <>
                  <div className="search-container">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="Rechercher une musique..."
                      className="search-input"
                      value={musicSearch}
                      onChange={(e) => setMusicSearch(e.target.value)}
                    />
                  </div>
                  <div className="music-list scrollable-list">
                    {filteredMusics.map((music, index) => (
                      <div key={index} className="music-item">
                        <span className="music-rank">#{index + 1}</span>
                        <div className="music-info">
                          <div className="music-name">{music.name}</div>
                          <div className="music-artist">{music.artist}</div>
                        </div>
                        <div className="music-stats">
                          <span className="music-count">{music.count} posts</span>
                          <span className="music-score">Score: {(music.avgScore * 100).toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                    {filteredMusics.length === 0 && (
                      <p className="no-results">Aucune musique trouvée</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="no-data">Aucune donnée musicale disponible</p>
              )}
            </div>
          </div>

          {/* Top Accounts */}
          <div className="analytics-card">
            <div className="card-header">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <h2 className="card-title">Comptes les plus performants</h2>
            </div>
            <div className="card-content">
              {analytics.topAccounts.length > 0 ? (
                <>
                  <div className="search-container">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="Rechercher un compte..."
                      className="search-input"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                    />
                  </div>
                  <div className="account-list scrollable-list">
                    {filteredAccounts.map((account, index) => (
                      <div key={index} className="account-item">
                        <span className="account-rank">#{index + 1}</span>
                        <div className="account-info">
                          <a 
                            href={`https://instagram.com/${account.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="account-username"
                          >
                            @{account.username}
                          </a>
                          <span className="account-followers">
                            {account.followers >= 1000000 
                              ? (account.followers / 1000000).toFixed(1) + 'M' 
                              : (account.followers / 1000).toFixed(1) + 'K'} abonnés
                          </span>
                        </div>
                        <div className="account-stats">
                          <span className="account-count">{account.count} posts</span>
                          <span className="account-score">Score: {(account.avgScore * 100).toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <p className="no-results">Aucun compte trouvé</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="no-data">Aucune donnée de compte disponible</p>
              )}
            </div>
          </div>

          {/* Video Duration */}
          <div className="analytics-card">
            <div className="card-header">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <h2 className="card-title">Durées des vidéos</h2>
            </div>
            <div className="card-content">
              <p className="no-data">Données de durée non disponibles pour le moment</p>
            </div>
          </div>

          {/* Content Types */}
          <div className="analytics-card">
            <div className="card-header">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <h2 className="card-title">Types de publications</h2>
            </div>
            <div className="card-content">
              {analytics.contentTypes.length > 0 ? (
                <div className="type-list">
                  {analytics.contentTypes.map((type, index) => (
                    <div key={index} className="type-item">
                      <div className="type-info">
                        <span className="type-name">{type.type}</span>
                        <span className="type-count">{type.count} publications</span>
                      </div>
                      <div className="type-bar">
                        <div 
                          className="type-fill" 
                          style={{ width: `${type.percentage}%` }}
                        ></div>
                      </div>
                      <span className="type-percentage">{type.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">Aucune donnée de type disponible</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HashtagAnalysis;