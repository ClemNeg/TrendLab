import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import PublicationCard from '../components/PublicationCard';
import Header from '../components/Header';
import '../styles/HomePage.css';

const HomePage = () => {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('score');
  const [order, setOrder] = useState('DESC');
  const [hashtags, setHashtags] = useState([]);
  const [selectedHashtag, setSelectedHashtag] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [showUsed, setShowUsed] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('reels');
  const [hashtagsReady, setHashtagsReady] = useState(false);
  const sourceDropdownRef = useRef(null);

  const fetchHashtags = useCallback(async () => {
    try {
      const response = await api.get('/api/hashtags');
      setHashtags(response.data);
      if (response.data.length > 0) {
        setSelectedHashtag(response.data[0]);
      }
      setHashtagsReady(true);
    } catch (error) {
      console.error('Error fetching hashtags:', error);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const response = await api.get('/api/sources');
      setSources(response.data);
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  }, []);

  const fetchPublications = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/publications?sortBy=${sortBy}&order=${order}`;
      if (selectedHashtag) {
        url += `&hashtag=${selectedHashtag}`;
      }
      if (selectedSources.length > 0) {
        url += `&sources=${selectedSources.join(',')}`;
      }
      // Always filter by alreadyUsed status
      url += `&alreadyUsed=${showUsed ? 1 : 0}`;
      const response = await api.get(url);
      setPublications(response.data);
    } catch (error) {
      console.error('Error fetching publications:', error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, order, selectedHashtag, selectedSources, showUsed]);

  useEffect(() => {
    fetchHashtags();
    fetchSources();
  }, [fetchHashtags, fetchSources]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target)) {
        setShowSourceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (hashtagsReady) {
      fetchPublications();
    }
  }, [fetchPublications, hashtagsReady]);

  const handleSourceToggle = (source) => {
    if (selectedSources.includes(source)) {
      setSelectedSources(selectedSources.filter(s => s !== source));
    } else {
      setSelectedSources([...selectedSources, source]);
    }
  };

  const toggleAlreadyUsed = async (publicationId, currentValue) => {
    try {
      await api.patch(`/api/publications/${publicationId}/toggle-used`);
      // Refresh publications
      fetchPublications();
    } catch (error) {
      console.error('Error toggling alreadyUsed:', error);
    }
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setOrder(order === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setSortBy(field);
      setOrder('DESC');
    }
  };

  return (
    <div className="home-page">
      <Header />

      {selectedHashtag && (
        <div className="hashtag-section">
          <div className="hashtag-selector-container">
            <div className="hashtag-button-wrapper">
              <button
                className="hashtag-selector-main"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <span className="hashtag-hash">#</span>
                <span className="hashtag-name">{selectedHashtag}</span>
                <svg
                  className={`hashtag-dropdown-icon ${showDropdown ? 'open' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showDropdown && (
                <div className="hashtag-dropdown-menu">
                  {hashtags.map((tag) => (
                    <button
                      key={tag}
                      className={`hashtag-dropdown-item ${tag === selectedHashtag ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedHashtag(tag);
                        setShowDropdown(false);
                      }}
                    >
                      <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ visibility: tag === selectedHashtag ? 'visible' : 'hidden' }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className="dropdown-hashtag"># {tag}</span>
                      <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link to={`/analyze/${encodeURIComponent(selectedHashtag)}`} className="analyze-button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18"/>
                <path d="M18 17V9"/>
                <path d="M13 17V5"/>
                <path d="M8 17v-3"/>
              </svg>
              Analyser
            </Link>
          </div>

          <div className="publications-count">{publications.length} publications</div>
        </div>
      )}

      <div className={`controls${!selectedHashtag ? ' no-hashtag' : ''}`}>
        <div className="filter-row">
          <div className="filter-group">
            <div className="filter-label">Trier par :</div>
            <div className="sort-buttons">
              <button
                className={`sort-btn ${sortBy === 'score' ? 'active' : ''}`}
                onClick={() => handleSortChange('score')}
              >
                Score {sortBy === 'score' && (order === 'DESC' ? '↓' : '↑')}
              </button>
              <button
                className={`sort-btn ${sortBy === 'published_at' ? 'active' : ''}`}
                onClick={() => handleSortChange('published_at')}
              >
                Date {sortBy === 'published_at' && (order === 'DESC' ? '↓' : '↑')}
              </button>
              <button
                className={`sort-btn ${sortBy === 'normalized_engagement_rate' ? 'active' : ''}`}
                onClick={() => handleSortChange('normalized_engagement_rate')}
              >
                Engagement {sortBy === 'normalized_engagement_rate' && (order === 'DESC' ? '↓' : '↑')}
              </button>
              <button
                className={`sort-btn ${sortBy === 'popularity' ? 'active' : ''}`}
                onClick={() => handleSortChange('popularity')}
              >
                Popularité {sortBy === 'popularity' && (order === 'DESC' ? '↓' : '↑')}
              </button>
            </div>
          </div>

          <button
            className={`used-filter-btn ${showUsed ? 'active' : ''}`}
            onClick={() => setShowUsed(!showUsed)}
            title={showUsed ? 'Masquer les publications déjà utilisées' : 'Afficher les publications déjà utilisées'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </button>

          <div className="filter-group source-dropdown-container" ref={sourceDropdownRef}>
            <div className="filter-label">Source :</div>
            <button
              className={`source-dropdown-btn ${showSourceDropdown ? 'open' : ''} ${selectedSources.length > 0 ? 'has-selection' : ''}`}
              onClick={() => setShowSourceDropdown(!showSourceDropdown)}
            >
              <span>
                {selectedSources.length === 0
                  ? 'Toutes'
                  : selectedSources.length === 1
                  ? selectedSources[0]
                  : `${selectedSources.length} sélectionnées`}
              </span>
              <svg
                className={`source-dropdown-icon ${showSourceDropdown ? 'open' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showSourceDropdown && (
              <div className="source-dropdown-menu">
                <button
                  className={`source-dropdown-item ${selectedSources.length === 0 ? 'active' : ''}`}
                  onClick={() => setSelectedSources([])}
                >
                  <svg className="source-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ visibility: selectedSources.length === 0 ? 'visible' : 'hidden' }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>Toutes</span>
                </button>
                {sources.map((source) => (
                  <button
                    key={source}
                    className={`source-dropdown-item ${selectedSources.includes(source) ? 'active' : ''}`}
                    onClick={() => handleSourceToggle(source)}
                  >
                    <svg className="source-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ visibility: selectedSources.includes(source) ? 'visible' : 'hidden' }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>{source}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement des publications...</p>
        </div>
      ) : (
        <>
          {(() => {
            const reels  = publications.filter(p => p.type === 'reels');
            const others = publications.filter(p => p.type !== 'reels');
            const displayed = activeTab === 'reels' ? reels : others;
            return (
              <>
                <div className="publications-section">
                  <div className="section-tabs">
                    <button
                      className={`section-tab ${activeTab === 'reels' ? 'active' : ''}`}
                      onClick={() => setActiveTab('reels')}
                    >
                      Réels <span>{reels.length}</span>
                    </button>
                    <button
                      className={`section-tab ${activeTab === 'others' ? 'active' : ''}`}
                      onClick={() => setActiveTab('others')}
                    >
                      Images & Carousels <span>{others.length}</span>
                    </button>
                  </div>
                  <div className="publications-grid">
                    {displayed.map(pub => (
                      <PublicationCard key={pub.id} publication={pub} onToggleUsed={toggleAlreadyUsed} />
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
};

export default HomePage;