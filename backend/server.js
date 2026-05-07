const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = new sqlite3.Database('./publications.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    ensureColumns();
  }
});

// Ajoute les colonnes manquantes issues du JSON Burp
function ensureColumns() {
  const newCols = [
    { name: 'code',           def: 'TEXT' },
    { name: 'video_duration', def: 'REAL' },
    { name: 'caption',          def: 'TEXT' },
    { name: 'image_url',        def: 'TEXT' },
    { name: 'session_hashtag',  def: 'TEXT' },
  ];
  db.all('PRAGMA table_info(publications)', [], (err, cols) => {
    if (err) return;
    const existing = cols.map(c => c.name);
    newCols.forEach(col => {
      if (!existing.includes(col.name)) {
        db.run(`ALTER TABLE publications ADD COLUMN ${col.name} ${col.def}`, [], (err) => {
          if (err) console.error(`Erreur ajout colonne ${col.name}:`, err.message);
          else console.log(`Colonne ajoutée : ${col.name}`);
        });
      }
    });
  });
}

// Helper function to calculate score color
const getScoreColor = (score) => {
  if (score >= 0.7) return 'green';
  if (score >= 0.4) return 'yellow';
  return 'red';
};

// GET all publications with sorting and filtering
app.get('/api/publications', (req, res) => {
  const { sortBy = 'score', order = 'DESC', hashtag, sources, alreadyUsed, userId = 0 } = req.query;
  
  const validSortFields = [
    'score', 'published_at', 'normalized_recency', 'normalized_engagement_rate',
    'normalized_engagement_rate_relative', 'normalized_view_to_like', 'normalized_comment_to_like'
  ];
  
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'score';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  let query = `
    SELECT DISTINCT 
      p.id, p.url, p.source, p.video_url as videoUrl, 
      p.likes_count as likesCount, p.comments_count as commentsCount, 
      p.video_play_count as videoPlayCount, p.shares_count as reshareCount,
      p.music_artist as musicArtist, p.music_name as musicName,
      p.lived_time as livedTime, p.media_type as type,
      p.published_at as timestamp, p.recency, p.engagement_rate as engagementRate,
      p.engagement_rate_relative as relativeEngagementRate,
      p.view_to_like as viewToLike, p.comment_to_like as commentToLike,
      p.normalized_recency as normalizedRecency,
      p.normalized_engagement_rate as normalizedEngagementRate,
      p.normalized_engagement_rate_relative as normalizedRelativeEngagementRate,
      p.normalized_view_to_like as normalizedViewToLike,
      p.normalized_comment_to_like as normalizedCommentToLike,
      p.score,
      COALESCE(up.already_used, 0) as alreadyUsed,
      a.username as ownerUsername, a.followers_count as followersCount,
      GROUP_CONCAT(DISTINCT h.name) as hashtag
    FROM publications p
    LEFT JOIN instagram_accounts a ON p.account_id = a.id
    LEFT JOIN hashtag_publications hp ON p.id = hp.publication_id
    LEFT JOIN hashtags h ON hp.hashtag_id = h.id
    LEFT JOIN user_publication up ON p.id = up.publication_id AND up.user_id = ?
    WHERE 1=1
  `;
  
  let params = [userId];

  if (sources) {
    const sourceList = sources.split(',');
    const placeholders = sourceList.map(() => '?').join(',');
    query += ` AND p.source IN (${placeholders})`;
    params.push(...sourceList);
  }
  
  query += ` GROUP BY p.id`;
  
  // Build HAVING clause
  let havingConditions = [];
  
  if (hashtag) {
    havingConditions.push('hashtag LIKE ?');
    params.push(`%${hashtag}%`);
  }

  if (alreadyUsed !== undefined) {
    havingConditions.push('alreadyUsed = ?');
    params.push(parseInt(alreadyUsed));
    console.log(`Filtering by alreadyUsed=${alreadyUsed} for userId=${userId}`);
  }
  
  if (havingConditions.length > 0) {
    query += ` HAVING ` + havingConditions.join(' AND ');
  }
  query += ` ORDER BY p.${sortField} ${sortOrder}`;
  
  console.log('Query:', query);
  console.log('Params:', params);
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('SQL Error:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    console.log(`Found ${rows.length} publications`);
    
    const publications = rows.map(row => ({
      ...row,
      timestamp: row.timestamp ? new Date(row.timestamp).getTime() / 1000 : null,
      scoreColor: getScoreColor(row.score),
      hashtag: row.hashtag ? row.hashtag.split(',')[0] : null // Get first hashtag
    }));
    
    res.json(publications);
  });
});

// GET all unique hashtags for a user
app.get('/api/hashtags', (req, res) => {
  const { userId = 1 } = req.query;

  // First try to get hashtags from user_hashtags table directly
  // user_hashtags.hashtag contains the hashtag name directly
  const query = `
    SELECT DISTINCT uh.hashtag as name
    FROM user_hashtags uh
    WHERE uh.user_id = ?
    ORDER BY uh.hashtag ASC
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error('Error fetching hashtags:', err);
      res.status(500).json({ error: err.message });
      return;
    }

    console.log(`Found ${rows.length} hashtags for userId=${userId}:`, rows);
    const hashtags = rows.map(row => row.name);
    res.json(hashtags);
  });
});

// DEBUG endpoint - check user_publication status
app.get('/api/debug/user-publications', (req, res) => {
  const { userId = 0 } = req.query;
  
  const query = `
    SELECT up.*, p.url 
    FROM user_publication up
    LEFT JOIN publications p ON up.publication_id = p.id
    WHERE up.user_id = ?
  `;
  
  db.all(query, [userId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// DEBUG endpoint - check user_hashtags table
app.get('/api/debug/user-hashtags', (req, res) => {
  const { userId = 0 } = req.query;

  db.all(`SELECT * FROM user_hashtags WHERE user_id = ?`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ user_hashtags: rows });
  });
});

// GET all unique sources
app.get('/api/sources', (req, res) => {
  const query = `
    SELECT DISTINCT source 
    FROM publications 
    WHERE source IS NOT NULL AND source != ''
    ORDER BY source ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const sources = rows.map(row => row.source);
    res.json(sources);
  });
});

// GET analytics for a specific hashtag
app.get('/api/analytics/:hashtag', (req, res) => {
  const { hashtag } = req.params;
  
  // Get all publications for this hashtag
  const publicationsQuery = `
    SELECT p.*, a.username as ownerUsername, a.followers_count as followersCount
    FROM publications p
    LEFT JOIN instagram_accounts a ON p.account_id = a.id
    LEFT JOIN hashtag_publications hp ON p.id = hp.publication_id
    LEFT JOIN hashtags h ON hp.hashtag_id = h.id
    WHERE h.name = ?
  `;
  
  db.all(publicationsQuery, [hashtag], (err, publications) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Calculate global stats
    const totalPubs = publications.length;
    const avgViews = totalPubs > 0 
      ? publications.reduce((sum, p) => sum + (p.video_play_count || 0), 0) / totalPubs 
      : 0;
    const avgLikes = totalPubs > 0
      ? publications.reduce((sum, p) => sum + (p.likes_count || 0), 0) / totalPubs
      : 0;
    const avgComments = totalPubs > 0
      ? publications.reduce((sum, p) => sum + (p.comments_count || 0), 0) / totalPubs
      : 0;
    
    // Get unique accounts and calculate average followers
    const uniqueAccounts = new Map();
    publications.forEach(pub => {
      if (pub.ownerUsername && !uniqueAccounts.has(pub.ownerUsername)) {
        uniqueAccounts.set(pub.ownerUsername, pub.followersCount || 0);
      }
    });
    const avgFollowers = uniqueAccounts.size > 0
      ? Array.from(uniqueAccounts.values()).reduce((sum, f) => sum + f, 0) / uniqueAccounts.size
      : 0;
    
    const globalStats = {
      avgViews: Math.round(avgViews),
      avgLikes: Math.round(avgLikes),
      avgComments: Math.round(avgComments),
      avgFollowers: Math.round(avgFollowers),
      totalPublications: totalPubs,
      totalAccounts: uniqueAccounts.size
    };
    
    // Top musics by average score
    const musicMap = new Map();
    publications.forEach(pub => {
      if (pub.music_name && pub.music_artist) {
        const key = `${pub.music_name}|||${pub.music_artist}`;
        if (!musicMap.has(key)) {
          musicMap.set(key, { scores: [], count: 0 });
        }
        musicMap.get(key).scores.push(pub.score);
        musicMap.get(key).count++;
      }
    });
    
    const topMusics = Array.from(musicMap.entries())
      .map(([key, data]) => {
        const [name, artist] = key.split('|||');
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        return { name, artist, count: data.count, avgScore };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
    
    // Top accounts by average score
    const accountMap = new Map();
    publications.forEach(pub => {
      if (pub.ownerUsername) {
        if (!accountMap.has(pub.ownerUsername)) {
          accountMap.set(pub.ownerUsername, {
            scores: [],
            count: 0,
            followers: pub.followersCount
          });
        }
        accountMap.get(pub.ownerUsername).scores.push(pub.score);
        accountMap.get(pub.ownerUsername).count++;
      }
    });
    
    const topAccounts = Array.from(accountMap.entries())
      .map(([username, data]) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        return {
          username,
          count: data.count,
          avgScore,
          followers: data.followers
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
    
    // Content types distribution
    const typeMap = new Map();
    publications.forEach(pub => {
      if (pub.media_type) {
        typeMap.set(pub.media_type, (typeMap.get(pub.media_type) || 0) + 1);
      }
    });
    
    const contentTypes = Array.from(typeMap.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / totalPubs) * 100
      }))
      .sort((a, b) => b.count - a.count);
    
    res.json({
      globalStats,
      topMusics,
      topAccounts,
      contentTypes,
      totalPublications: totalPubs
    });
  });
});

// GET single publication by ID
app.get('/api/publications/:id', (req, res) => {
  const { id } = req.params;
  const { userId = 0 } = req.query; // Default to admin user (id=0)
  
  const query = `
    SELECT 
      p.id, p.url, p.source, p.video_url as videoUrl, 
      p.likes_count as likesCount, p.comments_count as commentsCount, 
      p.video_play_count as videoPlayCount, p.shares_count as reshareCount,
      p.music_artist as musicArtist, p.music_name as musicName,
      p.lived_time as livedTime, p.media_type as type,
      p.published_at as timestamp, p.recency, p.engagement_rate as engagementRate,
      p.engagement_rate_relative as relativeEngagementRate,
      p.view_to_like as viewToLike, p.comment_to_like as commentToLike,
      p.normalized_recency as normalizedRecency,
      p.normalized_engagement_rate as normalizedEngagementRate,
      p.normalized_engagement_rate_relative as normalizedRelativeEngagementRate,
      p.normalized_view_to_like as normalizedViewToLike,
      p.normalized_comment_to_like as normalizedCommentToLike,
      p.score,
      COALESCE(up.already_used, 0) as alreadyUsed,
      a.username as ownerUsername, a.followers_count as followersCount,
      GROUP_CONCAT(h.name) as hashtag
    FROM publications p
    LEFT JOIN instagram_accounts a ON p.account_id = a.id
    LEFT JOIN hashtag_publications hp ON p.id = hp.publication_id
    LEFT JOIN hashtags h ON hp.hashtag_id = h.id
    LEFT JOIN user_publication up ON p.id = up.publication_id AND up.user_id = ?
    WHERE p.id = ?
    GROUP BY p.id
  `;
  
  db.get(query, [userId, id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Publication not found' });
      return;
    }
    
    const publication = {
      ...row,
      timestamp: row.timestamp ? new Date(row.timestamp).getTime() / 1000 : null,
      scoreColor: getScoreColor(row.score),
      hashtag: row.hashtag ? row.hashtag.split(',')[0] : null
    };
    
    res.json(publication);
  });
});

// PATCH toggle alreadyUsed for a publication (per user)
app.patch('/api/publications/:id/toggle-used', (req, res) => {
  const { id } = req.params;
  const { userId = 0 } = req.query; // Default to admin user (id=0)
  
  // Check if entry exists in user_publication
  const checkQuery = 'SELECT id, already_used FROM user_publication WHERE user_id = ? AND publication_id = ?';
  
  db.get(checkQuery, [userId, id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row) {
      // Entry exists, toggle the value
      const newValue = row.already_used === 1 ? 0 : 1;
      
      db.run(
        'UPDATE user_publication SET already_used = ?, marked_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newValue, row.id],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, alreadyUsed: newValue });
        }
      );
    } else {
      // Entry doesn't exist, create it with already_used = 1 (marking as used)
      db.run(
        'INSERT INTO user_publication (user_id, publication_id, already_used, marked_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)',
        [userId, id],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, alreadyUsed: 1 });
        }
      );
    }
  });
});

// Appel fire-and-forget au service de profil Apify
function fetchProfile(username, publicationId) {
  const body = JSON.stringify({ username, publication_id: publicationId });
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/profile',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.on('error', (e) => console.error('[Profile service]', e.message));
  req.write(body);
  req.end();
}

// Lie les hashtags à une publication
function linkHashtags(pubId, hashtags) {
  hashtags.forEach(tag => {
    const cleanTag = tag.replace(/^#/, '');
    db.get('SELECT id FROM hashtags WHERE name = ?', [cleanTag], (err, existing) => {
      if (err) return;
      if (existing) {
        db.run('INSERT OR IGNORE INTO hashtag_publications (hashtag_id, publication_id) VALUES (?, ?)',
          [existing.id, pubId]);
      } else {
        db.run('INSERT INTO hashtags (name) VALUES (?)', [cleanTag], function(err) {
          if (err) return;
          db.run('INSERT OR IGNORE INTO hashtag_publications (hashtag_id, publication_id) VALUES (?, ?)',
            [this.lastID, pubId]);
        });
      }
    });
  });
}

// Upsert un compte Instagram et retourne son id
function upsertAccount(username, fullName, callback) {
  if (!username) return callback(null, null);
  db.get('SELECT id FROM instagram_accounts WHERE username = ?', [username], (err, existing) => {
    if (err) return callback(err);
    if (existing) {
      // Met à jour fullName si fourni
      if (fullName) {
        db.run('UPDATE instagram_accounts SET fullName = ? WHERE id = ?', [fullName, existing.id], () => {});
      }
      return callback(null, existing.id);
    }
    const igUrl = `https://www.instagram.com/${username}/`;
    db.run(
      'INSERT INTO instagram_accounts (url, username, fullName) VALUES (?, ?, ?)',
      [igUrl, username, fullName || null],
      function(err) { callback(err, err ? null : this.lastID); }
    );
  });
}

// POST endpoint pour recevoir les données de l'extension Burp
app.post('/api/burp', (req, res) => {
  const post = req.body;
  console.log('[Burp]', JSON.stringify(post, null, 2));

  if (!post.code) return res.status(400).json({ error: 'Champ code manquant' });

  const url = `https://www.instagram.com/reel/${post.code}/`;

  // Calcul des métriques dérivées
  const now = Date.now() / 1000;
  const livedTime  = post.taken_at ? now - post.taken_at : null;
  const recency    = livedTime > 0 ? 1 / (livedTime / 3600) : null;
  const likes      = post.like_count    || 0;
  const comments   = post.comment_count || 0;
  const plays      = post.play_count;
  const engRate    = plays > 0 ? (likes + comments) / plays : null;
  const viewToLike = plays > 0 ? likes / plays : null;
  const commToLike = likes > 0 ? comments / likes : null;
  const publishedAt = post.taken_at ? new Date(post.taken_at * 1000).toISOString() : null;
  const mediaTypeMap = { 1: 'image', 2: 'reels', 8: 'carousel' };
  const mediaType  = mediaTypeMap[post.media_type] || String(post.media_type);

  // 1. Upsert le compte, puis upsert la publication
  upsertAccount(post.username, post.user_full_name, (err, accountId) => {
    if (err) console.error('[Account upsert]', err.message);

    db.get('SELECT id FROM publications WHERE url = ?', [url], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });

      const afterUpsert = (err, pubId) => {
        if (err) return res.status(500).json({ error: err.message });
        if (post.hashtags && post.hashtags.length > 0) linkHashtags(pubId, post.hashtags);
        if (post.username) fetchProfile(post.username, pubId);
        res.json({ status: 'ok', id: pubId });
      };

      if (existing) {
        db.run(`
          UPDATE publications SET
            likes_count = ?, comments_count = ?, video_play_count = ?,
            shares_count = ?, lived_time = ?, recency = ?,
            engagement_rate = ?, view_to_like = ?, comment_to_like = ?,
            account_id = COALESCE(account_id, ?)
          WHERE id = ?`,
          [likes, comments, plays, post.reshare_count, livedTime, recency,
           engRate, viewToLike, commToLike, accountId, existing.id],
          function(err) { afterUpsert(err, existing.id); }
        );
      } else {
        db.run(`
          INSERT INTO publications (
            url, source, code, video_url, image_url,
            likes_count, comments_count, video_play_count, shares_count,
            music_artist, music_name, video_duration, caption,
            lived_time, media_type, published_at,
            recency, engagement_rate, view_to_like, comment_to_like,
            account_id, session_hashtag
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [url, 'instagram', post.code, post.video_url, post.image_url,
           likes, comments, plays, post.reshare_count,
           post.music_artist, post.music_title, post.video_duration, post.caption || null,
           livedTime, mediaType, publishedAt,
           recency, engRate, viewToLike, commToLike,
           accountId, post.session_hashtag || null],
          function(err) { afterUpsert(err, this.lastID); }
        );
      }
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});