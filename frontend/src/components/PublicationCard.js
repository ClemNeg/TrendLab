import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/PublicationCard.css';

const PublicationCard = ({ publication, onToggleUsed }) => {
  const [showMetrics, setShowMetrics] = useState(false);
  const metricsTimeoutRef = React.useRef(null);

  const handleMetricEnter = () => {
    clearTimeout(metricsTimeoutRef.current);
    setShowMetrics(true);
  };

  const handleMetricLeave = () => {
    metricsTimeoutRef.current = setTimeout(() => setShowMetrics(false), 150);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatNumber = (n) => {
    if (n == null) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  };

  const formatScore = (score) => (score * 100).toFixed(0);

  const handleToggleUsed = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleUsed(publication.id, publication.alreadyUsed);
  };

  const mediaType = publication.type || publication.mediaType || '';
  const mediaTypeLabel = {
    reels: 'REEL',
    image: 'IMAGE',
    carousel: 'CAROUSEL',
  }[mediaType] || mediaType.toUpperCase();

  return (
    <Link to={`/publication/${publication.id}`} className="publication-card">
      {/* Score */}
      <div className={`pc-score score-${publication.scoreColor}`}>
        {formatScore(publication.score)}
      </div>

      {/* Type */}
      <div className={`pc-type pc-type--${mediaType}`} title={mediaTypeLabel}>
        {mediaType === 'reels' && (
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="50" height="50" rx="10" fill="#4CAF50"/>
            <rect x="12" y="8" width="26" height="34" rx="4" fill="#ffffff" opacity="0.2"/>
            <polygon points="22,18 22,32 34,25" fill="#ffffff"/>
          </svg>
        )}
        {mediaType === 'image' && (
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="50" height="50" rx="8" fill="#2196F3"/>
            <polygon points="5,40 20,20 35,40" fill="#ffffff"/>
            <circle cx="38" cy="12" r="5" fill="#ffffff"/>
          </svg>
        )}
        {mediaType === 'carousel' && (
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="50" height="50" rx="8" fill="#FF9800"/>
            <rect x="8" y="10" width="20" height="30" fill="#ffffff" opacity="0.7"/>
            <rect x="18" y="10" width="20" height="30" fill="#ffffff" opacity="0.5"/>
            <polygon points="5,25 10,20 10,30" fill="#ffffff"/>
            <polygon points="45,25 40,20 40,30" fill="#ffffff"/>
          </svg>
        )}
        {!['reels','image','carousel'].includes(mediaType) && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        )}
      </div>

      {/* Main content */}
      <div className="pc-body">
        <div className="pc-meta">
          <span className="pc-username">
            {publication.ownerUsername || publication.username || '—'}
          </span>
          <span className="pc-dot">·</span>
          <span className="pc-date">{formatDate(publication.timestamp)}</span>
          {(publication.musicName || publication.musicArtist) && (
            <>
              <span className="pc-dot">·</span>
              <span className="pc-music">
                ♪ {[publication.musicName, publication.musicArtist].filter(Boolean).join(' — ')}
              </span>
            </>
          )}
        </div>

        {publication.caption && (
          <div className="pc-caption">{publication.caption}</div>
        )}
      </div>

      {/* Stats */}
      <div className="pc-stats">
        <div className="pc-stat">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <span>{formatNumber(publication.likesCount)}</span>
        </div>
        <div className="pc-stat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>{formatNumber(publication.commentsCount)}</span>
        </div>
        {publication.sharesCount != null && (
          <div className="pc-stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>{formatNumber(publication.sharesCount)}</span>
          </div>
        )}
        {publication.videoPlayCount != null && (
          <div className="pc-stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>{formatNumber(publication.videoPlayCount)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pc-actions">
        <div
          className="pc-action-btn"
          onMouseEnter={handleMetricEnter}
          onMouseLeave={handleMetricLeave}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18M7 16l4-4 4 4 5-5"/>
          </svg>

          {showMetrics && (
            <div
              className="metrics-tooltip"
              onMouseEnter={handleMetricEnter}
              onMouseLeave={handleMetricLeave}
              onClick={(e) => e.preventDefault()}
            >
              {[
                ['Récence',      publication.normalizedRecency],
                ['Engagement',   publication.normalizedEngagementRate],
                ['Eng. relatif', publication.normalizedRelativeEngagementRate],
                ['View/Like',    publication.normalizedViewToLike],
                ['Comm/Like',    publication.normalizedCommentToLike],
              ].map(([label, val]) => (
                <div className="metric-item" key={label}>
                  <span className="metric-label">{label}</span>
                  <span className="metric-value">
                    {val != null ? (val * 100).toFixed(0) + '%' : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          className={`pc-action-btn used-toggle-btn ${publication.alreadyUsed ? 'used' : ''}`}
          onClick={handleToggleUsed}
          title={publication.alreadyUsed ? 'Marquer comme non utilisée' : 'Marquer comme utilisée'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {publication.alreadyUsed
              ? <polyline points="20 6 9 17 4 12"/>
              : <circle cx="12" cy="12" r="10"/>}
          </svg>
        </button>

        <a
          href={publication.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pc-action-btn instagram-icon"
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </a>
      </div>
    </Link>
  );
};

export default PublicationCard;
