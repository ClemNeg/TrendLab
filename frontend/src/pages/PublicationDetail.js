import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import Header from '../components/Header';
import '../styles/PublicationDetail.css';

const PublicationDetail = () => {
  const { id } = useParams();
  const [publication, setPublication] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPublication = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/publications/${id}`);
      setPublication(response.data);
    } catch (error) {
      console.error('Error fetching publication:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPublication();
  }, [fetchPublication]);

  const toggleAlreadyUsed = async () => {
    try {
      await api.patch(`/api/publications/${id}/toggle-used`);
      fetchPublication(); // Refresh data
    } catch (error) {
      console.error('Error toggling alreadyUsed:', error);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
  };

  const formatScore = (score) => {
    return (score * 100).toFixed(0);
  };

  if (loading) {
    return (
      <div className="detail-loading">
        <div className="spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="detail-error">
        <p>Publication introuvable</p>
        <Link to="/" className="back-link">← Retour</Link>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <Header />
      <header className="detail-header">
        <Link to="/" className="back-button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Retour
        </Link>
        <div className="header-right">
          <button 
            className={`toggle-used-detail ${publication.alreadyUsed ? 'used' : ''}`}
            onClick={toggleAlreadyUsed}
            title={publication.alreadyUsed ? 'Marquer comme non utilisée' : 'Marquer comme utilisée'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {publication.alreadyUsed ? (
                <polyline points="20 6 9 17 4 12"/>
              ) : (
                <circle cx="12" cy="12" r="10"/>
              )}
            </svg>
            <span>{publication.alreadyUsed ? 'Utilisée' : 'Non utilisée'}</span>
          </button>
          <div className={`detail-score score-${publication.scoreColor}`}>
            Score: {formatScore(publication.score)}
          </div>
        </div>
      </header>

      <div className="detail-content">
        <div className="video-section">
          <video 
            src={publication.videoUrl} 
            controls
            loop
            className="detail-video"
          />
        </div>

        <div className="info-section">
          <div className="info-block general-info">
            <h2 className="section-title">Informations générales</h2>
            
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Créateur</span>
                <a 
                  href={`https://instagram.com/${publication.ownerUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-value username"
                >
                  @{publication.ownerUsername}
                </a>
              </div>

              <div className="info-item">
                <span className="info-label">Abonnés</span>
                <span className="info-value">{formatNumber(publication.followersCount)}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Date de publication</span>
                <span className="info-value">{formatDate(publication.timestamp)}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Type</span>
                <span className="info-value">{publication.type}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Source</span>
                <span className="info-value">{publication.source}</span>
              </div>

              {publication.hashtag && (
                <div className="info-item">
                  <span className="info-label">Hashtag</span>
                  <span className="info-value">#{publication.hashtag}</span>
                </div>
              )}

              <div className="info-item">
                <span className="info-label">Partages</span>
                <span className="info-value">
                  {publication.reshareCount ? formatNumber(publication.reshareCount) : 'Non connu'}
                </span>
              </div>

              {publication.musicName && (
                <div className="info-item">
                  <span className="info-label">Musique</span>
                  <span className="info-value">{publication.musicName}</span>
                </div>
              )}

              {publication.musicArtist && (
                <div className="info-item">
                  <span className="info-label">Artiste</span>
                  <span className="info-value">{publication.musicArtist}</span>
                </div>
              )}

              <div className="info-item highlight">
                <span className="info-label">Likes</span>
                <span className="info-value big">{formatNumber(publication.likesCount)}</span>
              </div>

              <div className="info-item highlight">
                <span className="info-label">Commentaires</span>
                <span className="info-value big">{formatNumber(publication.commentsCount)}</span>
              </div>

              <div className="info-item highlight">
                <span className="info-label">Vues</span>
                <span className="info-value big">{formatNumber(publication.videoPlayCount)}</span>
              </div>
            </div>

            <div className="action-buttons">
              <a 
                href={publication.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="view-instagram"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Voir sur Instagram
              </a>

              {publication.videoUrl && (
                <a 
                  href={publication.videoUrl}
                  download
                  className="download-video-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Télécharger la vidéo"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </a>
              )}
            </div>
          </div>

          <div className="info-block performance-info">
            <h2 className="section-title">Comprendre la performance</h2>
            
            <div className="performance-grid">
              <div className="perf-item">
                <div className="perf-header">
                  <span className="perf-label">Fraîcheur</span>
                  <span className="perf-score">{formatScore(publication.normalizedRecency)}%</span>
                </div>
                <div className="perf-bar">
                  <div 
                    className="perf-fill" 
                    style={{ width: `${publication.normalizedRecency * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="perf-item">
                <div className="perf-header">
                  <span className="perf-label">Taux d'engagement global</span>
                  <span className="perf-score">{formatScore(publication.normalizedEngagementRate)}%</span>
                </div>
                <div className="perf-bar">
                  <div 
                    className="perf-fill" 
                    style={{ width: `${publication.normalizedEngagementRate * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="perf-item">
                <div className="perf-header">
                  <span className="perf-label">Convertion de vue en like</span>
                  <span className="perf-score">{formatScore(publication.normalizedViewToLike)}%</span>
                </div>
                <div className="perf-bar">
                  <div 
                    className="perf-fill" 
                    style={{ width: `${publication.normalizedViewToLike * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="perf-item">
                <div className="perf-header">
                  <span className="perf-label">Tendance à commenter</span>
                  <span className="perf-score">{formatScore(publication.normalizedCommentToLike)}%</span>
                </div>
                <div className="perf-bar">
                  <div 
                    className="perf-fill" 
                    style={{ width: `${publication.normalizedCommentToLike * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="raw-metrics">
              <h3 className="subsection-title">Métriques brutes</h3>
              <div className="raw-grid">
                <div className="raw-item">
                  <span className="raw-label">Engagement Rate</span>
                  <span className="raw-value">{(publication.engagementRate * 100).toFixed(2)}</span>
                </div>
                <div className="raw-item">
                  <span className="raw-label">View to Like</span>
                  <span className="raw-value">{publication.viewToLike?.toFixed(2)}</span>
                </div>
                <div className="raw-item">
                  <span className="raw-label">Comment to Like</span>
                  <span className="raw-value">{(publication.commentToLike * 1000).toFixed(2)}</span>
                </div>
                <div className="raw-item">
                  <span className="raw-label">Lived Time</span>
                  <span className="raw-value">{publication.livedTime?.toFixed(0)}</span>
                </div>
                <div className="raw-item">
                  <span className="raw-label">Recency</span>
                  <span className="raw-value">{publication.recency?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicationDetail;