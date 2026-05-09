const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'trendlab_jwt_secret_2024';

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./publications.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initDB();
  }
});

function initDB() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, [], () => {
    db.all('PRAGMA table_info(users)', [], (err, cols) => {
      if (err) return;
      const existing = cols.map(c => c.name);
      if (!existing.includes('password')) {
        db.run('ALTER TABLE users ADD COLUMN password TEXT', [], (err) => {
          if (err) console.error('Erreur ajout colonne password:', err.message);
        });
      }
      if (!existing.includes('email')) {
        db.run('ALTER TABLE users ADD COLUMN email TEXT UNIQUE', [], (err) => {
          if (err) console.error('Erreur ajout colonne email:', err.message);
        });
      }
    });
  });
  ensureColumns();
}

function ensureColumns() {
  const newCols = [
    { name: 'code',           def: 'TEXT' },
    { name: 'video_duration', def: 'REAL' },
    { name: 'caption',        def: 'TEXT' },
    { name: 'image_url',      def: 'TEXT' },
    { name: 'session_hashtag', def: 'TEXT' },
  ];
  db.all('PRAGMA table_info(publications)', [], (err, cols) => {
    if (err) return;
    const existing = cols.map(c => c.name);
    newCols.forEach(col => {
      if (!existing.includes(col.name)) {
        db.run(`ALTER TABLE publications ADD COLUMN ${col.name} ${col.def}`, [], (err) => {
          if (err) console.error(`Erreur ajout colonne ${col.name}:`, err.message);
        });
      }
    });
  });
}

const getScoreColor = (score) => {
  if (score >= 0.7) return 'green';
  if (score >= 0.4) return 'yellow';
  return 'red';
};

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "Nom d'utilisateur, email et mot de passe requis" });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (email, password, username) VALUES (?, ?, ?)', [email, hash, username], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email ou nom d\'utilisateur déjà utilisé' });
        return res.status(500).json({ error: err.message });
      }
      const token = jwt.sign({ id: this.lastID, email, username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: this.lastID, email, username } });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Identifiants incorrects' });

    db.run('UPDATE users SET last_login = ? WHERE id = ?', [new Date().toISOString(), user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
  });
});

// ── Publications ──────────────────────────────────────────────────────────────

app.get('/api/publications', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { sortBy = 'score', order = 'DESC', hashtag, sources, alreadyUsed } = req.query;

  const validSortFields = [
    'score', 'published_at', 'normalized_engagement_rate', 'popularity'
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
      p.view_to_like as viewToLike, p.comment_to_like as commentToLike,
      p.normalized_recency as normalizedRecency,
      p.normalized_engagement_rate as normalizedEngagementRate,
      p.normalized_view_to_like as normalizedViewToLike,
      p.normalized_comment_to_like as normalizedCommentToLike,
      p.score,
      COALESCE(p.video_play_count, p.likes_count + p.comments_count) as popularity,
      COALESCE(up.already_used, 0) as alreadyUsed,
      a.username as ownerUsername, a.followers_count as followersCount,
      GROUP_CONCAT(DISTINCT h.name) as hashtag
    FROM publications p
    INNER JOIN user_publication up ON p.id = up.publication_id AND up.user_id = ?
    LEFT JOIN instagram_accounts a ON p.account_id = a.id
    LEFT JOIN hashtag_publications hp ON p.id = hp.publication_id
    LEFT JOIN hashtags h ON hp.hashtag_id = h.id
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

  let havingConditions = [];

  if (hashtag) {
    havingConditions.push('hashtag LIKE ?');
    params.push(`%${hashtag}%`);
  }

  if (alreadyUsed !== undefined) {
    havingConditions.push('alreadyUsed = ?');
    params.push(parseInt(alreadyUsed));
  }

  if (havingConditions.length > 0) {
    query += ` HAVING ` + havingConditions.join(' AND ');
  }

  const orderExpr = sortField === 'popularity'
    ? `COALESCE(p.video_play_count, p.likes_count + p.comments_count)`
    : `p.${sortField}`;
  query += ` ORDER BY ${orderExpr} ${sortOrder}`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const publications = rows.map(row => ({
      ...row,
      timestamp: row.timestamp ? new Date(row.timestamp).getTime() / 1000 : null,
      scoreColor: getScoreColor(row.score),
      hashtag: row.hashtag ? row.hashtag.split(',')[0] : null
    }));
    res.json(publications);
  });
});

app.get('/api/publications/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const query = `
    SELECT
      p.id, p.url, p.source, p.video_url as videoUrl,
      p.likes_count as likesCount, p.comments_count as commentsCount,
      p.video_play_count as videoPlayCount, p.shares_count as reshareCount,
      p.music_artist as musicArtist, p.music_name as musicName,
      p.lived_time as livedTime, p.media_type as type,
      p.published_at as timestamp, p.recency, p.engagement_rate as engagementRate,
      p.view_to_like as viewToLike, p.comment_to_like as commentToLike,
      p.normalized_recency as normalizedRecency,
      p.normalized_engagement_rate as normalizedEngagementRate,
      p.normalized_view_to_like as normalizedViewToLike,
      p.normalized_comment_to_like as normalizedCommentToLike,
      p.score,
      COALESCE(up.already_used, 0) as alreadyUsed,
      a.username as ownerUsername, a.followers_count as followersCount,
      GROUP_CONCAT(h.name) as hashtag
    FROM publications p
    INNER JOIN user_publication up ON p.id = up.publication_id AND up.user_id = ?
    LEFT JOIN instagram_accounts a ON p.account_id = a.id
    LEFT JOIN hashtag_publications hp ON p.id = hp.publication_id
    LEFT JOIN hashtags h ON hp.hashtag_id = h.id
    WHERE p.id = ?
    GROUP BY p.id
  `;

  db.get(query, [userId, id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Publication not found' });

    res.json({
      ...row,
      timestamp: row.timestamp ? new Date(row.timestamp).getTime() / 1000 : null,
      scoreColor: getScoreColor(row.score),
      hashtags: row.hashtag ? [...new Set(row.hashtag.split(','))] : []
    });
  });
});

app.patch('/api/publications/:id/toggle-used', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  db.get('SELECT id, already_used FROM user_publication WHERE user_id = ? AND publication_id = ?', [userId, id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row) {
      const newValue = row.already_used === 1 ? 0 : 1;
      db.run('UPDATE user_publication SET already_used = ?, marked_at = CURRENT_TIMESTAMP WHERE id = ?', [newValue, row.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, alreadyUsed: newValue });
      });
    } else {
      db.run('INSERT INTO user_publication (user_id, publication_id, already_used, marked_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)', [userId, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, alreadyUsed: 1 });
      });
    }
  });
});

// ── Hashtags & Sources ────────────────────────────────────────────────────────

app.get('/api/hashtags', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.all('SELECT DISTINCT hashtag as name FROM user_hashtags WHERE user_id = ? ORDER BY hashtag ASC', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.name));
  });
});

app.get('/api/sources', authMiddleware, (req, res) => {
  db.all(`SELECT DISTINCT source FROM publications WHERE source IS NOT NULL AND source != '' ORDER BY source ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.source));
  });
});

// ── Analytics ─────────────────────────────────────────────────────────────────

app.get('/api/analytics/:hashtag', authMiddleware, (req, res) => {
  const { hashtag } = req.params;

  const publicationsQuery = `
    SELECT p.*, a.username as ownerUsername, a.followers_count as followersCount
    FROM publications p
    LEFT JOIN instagram_accounts a ON p.account_id = a.id
    LEFT JOIN hashtag_publications hp ON p.id = hp.publication_id
    LEFT JOIN hashtags h ON hp.hashtag_id = h.id
    WHERE h.name = ?
  `;

  db.all(publicationsQuery, [hashtag], (err, publications) => {
    if (err) return res.status(500).json({ error: err.message });

    const totalPubs = publications.length;
    const avg = (field) => totalPubs > 0 ? publications.reduce((s, p) => s + (p[field] || 0), 0) / totalPubs : 0;

    const uniqueAccounts = new Map();
    publications.forEach(pub => {
      if (pub.ownerUsername && !uniqueAccounts.has(pub.ownerUsername)) {
        uniqueAccounts.set(pub.ownerUsername, pub.followersCount || 0);
      }
    });

    const globalStats = {
      avgViews: Math.round(avg('video_play_count')),
      avgLikes: Math.round(avg('likes_count')),
      avgComments: Math.round(avg('comments_count')),
      avgFollowers: uniqueAccounts.size > 0
        ? Math.round(Array.from(uniqueAccounts.values()).reduce((s, f) => s + f, 0) / uniqueAccounts.size)
        : 0,
      totalPublications: totalPubs,
      totalAccounts: uniqueAccounts.size
    };

    const musicMap = new Map();
    publications.forEach(pub => {
      if (pub.music_name && pub.music_artist && pub.music_name.toLowerCase() !== 'original audio') {
        const key = `${pub.music_name}|||${pub.music_artist}`;
        if (!musicMap.has(key)) musicMap.set(key, { scores: [], count: 0 });
        musicMap.get(key).scores.push(pub.score);
        musicMap.get(key).count++;
      }
    });

    const topMusics = Array.from(musicMap.entries())
      .map(([key, data]) => {
        const [name, artist] = key.split('|||');
        return { name, artist, count: data.count, avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length };
      })
      .filter(m => m.count >= 2)
      .sort((a, b) => b.avgScore - a.avgScore);

    const accountMap = new Map();
    publications.forEach(pub => {
      if (pub.ownerUsername) {
        if (!accountMap.has(pub.ownerUsername)) accountMap.set(pub.ownerUsername, { scores: [], count: 0, followers: pub.followersCount });
        accountMap.get(pub.ownerUsername).scores.push(pub.score);
        accountMap.get(pub.ownerUsername).count++;
      }
    });

    const topAccounts = Array.from(accountMap.entries())
      .map(([username, data]) => ({
        username, count: data.count, followers: data.followers,
        avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      }))
      .filter(a => a.count >= 2)
      .sort((a, b) => b.avgScore - a.avgScore);

    const typeMap = new Map();
    publications.forEach(pub => {
      if (pub.media_type) {
        if (!typeMap.has(pub.media_type)) typeMap.set(pub.media_type, { count: 0, totalEngagement: 0 });
        const entry = typeMap.get(pub.media_type);
        entry.count++;
        entry.totalEngagement += (pub.likes_count || 0) + (pub.comments_count || 0);
      }
    });

    const contentTypes = Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        percentage: (data.count / totalPubs) * 100,
        avgPerformance: Math.round(data.totalEngagement / data.count)
      }))
      .sort((a, b) => b.count - a.count);

    if (publications.length === 0) {
      return res.json({ globalStats, topMusics, topAccounts, contentTypes, topHashtags: [], totalPublications: 0 });
    }

    const pubIds = publications.map(p => p.id);
    const placeholders = pubIds.map(() => '?').join(',');
    const hashtagQuery = `
      SELECT h.name, COUNT(DISTINCT hp.publication_id) as count, AVG(p.score) as avgScore
      FROM hashtag_publications hp
      JOIN hashtags h ON hp.hashtag_id = h.id
      JOIN publications p ON p.id = hp.publication_id
      WHERE hp.publication_id IN (${placeholders})
      AND h.name IS NOT NULL
      GROUP BY h.name
      HAVING count >= 2
      ORDER BY avgScore DESC
    `;

    db.all(hashtagQuery, pubIds, (err, hashtagRows) => {
      if (err) return res.status(500).json({ error: err.message });
      const topHashtags = (hashtagRows || []).map(r => ({ name: r.name, count: r.count, avgScore: r.avgScore }));
      res.json({ globalStats, topMusics, topAccounts, contentTypes, topHashtags, totalPublications: totalPubs });
    });
  });
});

// ── Sous-niches ───────────────────────────────────────────────────────────────

app.get('/api/analytics/:hashtag/sousniches', authMiddleware, (req, res) => {
  const { hashtag } = req.params;
  const dataDir = path.join(__dirname, 'data', 'sousniches');

  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const target = normalize(hashtag);

  try {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
      if (normalize(data.meta?.niche || '') === target) {
        return res.json(data);
      }
    }
    res.json(null);
  } catch {
    res.json(null);
  }
});

// ── Burp (import depuis l'extension) ─────────────────────────────────────────

function fetchProfile(username, publicationId) {
  const body = JSON.stringify({ username, publication_id: publicationId });
  const req = http.request({
    hostname: 'localhost', port: 5000, path: '/profile', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.on('error', (e) => console.error('[Profile service]', e.message));
  req.write(body);
  req.end();
}

function linkHashtags(pubId, hashtags) {
  hashtags.forEach(tag => {
    const cleanTag = tag.replace(/^#/, '');
    db.get('SELECT id FROM hashtags WHERE name = ?', [cleanTag], (err, existing) => {
      if (err) return;
      if (existing) {
        db.run('INSERT OR IGNORE INTO hashtag_publications (hashtag_id, publication_id) VALUES (?, ?)', [existing.id, pubId]);
      } else {
        db.run('INSERT INTO hashtags (name) VALUES (?)', [cleanTag], function(err) {
          if (err) return;
          db.run('INSERT OR IGNORE INTO hashtag_publications (hashtag_id, publication_id) VALUES (?, ?)', [this.lastID, pubId]);
        });
      }
    });
  });
}

function upsertAccount(username, fullName, callback) {
  if (!username) return callback(null, null);
  db.get('SELECT id FROM instagram_accounts WHERE username = ?', [username], (err, existing) => {
    if (err) return callback(err);
    if (existing) {
      if (fullName) db.run('UPDATE instagram_accounts SET fullName = ? WHERE id = ?', [fullName, existing.id], () => {});
      return callback(null, existing.id);
    }
    db.run(
      'INSERT INTO instagram_accounts (url, username, fullName) VALUES (?, ?, ?)',
      [`https://www.instagram.com/${username}/`, username, fullName || null],
      function(err) { callback(err, err ? null : this.lastID); }
    );
  });
}

app.post('/api/burp', (req, res) => {
  const post = req.body;
  const userId = post.user_id || null;

  if (!post.code) return res.status(400).json({ error: 'Champ code manquant' });

  const url = `https://www.instagram.com/reel/${post.code}/`;
  const now = Date.now() / 1000;
  const livedTime = post.taken_at ? now - post.taken_at : null;
  const recency = livedTime > 0 ? 1 / (livedTime / 3600) : null;
  const likes = post.like_count || 0;
  const comments = post.comment_count || 0;
  const plays = post.play_count;
  const engRate = plays > 0 ? (likes + comments) / plays : null;
  const viewToLike = plays > 0 ? likes / plays : null;
  const commToLike = likes > 0 ? comments / likes : null;
  const publishedAt = post.taken_at ? new Date(post.taken_at * 1000).toISOString() : null;
  const mediaTypeMap = { 1: 'image', 2: 'reels', 8: 'carousel' };
  const mediaType = mediaTypeMap[post.media_type] || String(post.media_type);

  upsertAccount(post.username, post.user_full_name, (err, accountId) => {
    if (err) console.error('[Account upsert]', err.message);

    db.get('SELECT id FROM publications WHERE url = ?', [url], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });

      const afterUpsert = (err, pubId) => {
        if (err) return res.status(500).json({ error: err.message });
        if (post.hashtags?.length > 0) linkHashtags(pubId, post.hashtags);
        if (post.username) fetchProfile(post.username, pubId);

        const sessionUsername = post.session_username || null;
        const sessionHashtag  = post.session_hashtag  || null;


        console.log(`[Burp] session_username="${sessionUsername}" session_hashtag="${sessionHashtag}" pubId=${pubId}`);

        if (sessionUsername) {
          db.get('SELECT id FROM users WHERE username = ?', [sessionUsername], (err, user) => {
            if (err) { console.log('[Burp] DB error:', err.message); return; }
            if (!user) { console.log(`[Burp] Aucun utilisateur trouvé pour username="${sessionUsername}"`); return; }
            console.log(`[Burp] Utilisateur trouvé: id=${user.id}`);
            const uid = user.id;
            db.run('INSERT OR IGNORE INTO user_publication (user_id, publication_id, already_used) VALUES (?, ?, 0)', [uid, pubId]);
            if (sessionHashtag) {
              db.run('INSERT OR IGNORE INTO user_hashtags (user_id, hashtag) VALUES (?, ?)', [uid, sessionHashtag]);
            }
          });
        }

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
          [likes, comments, plays, post.reshare_count, livedTime, recency, engRate, viewToLike, commToLike, accountId, existing.id],
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

// ── Debug ─────────────────────────────────────────────────────────────────────

app.get('/api/debug/user-publications', (req, res) => {
  const { userId = 0 } = req.query;
  db.all('SELECT up.*, p.url FROM user_publication up LEFT JOIN publications p ON up.publication_id = p.id WHERE up.user_id = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/debug/user-hashtags', (req, res) => {
  const { userId = 0 } = req.query;
  db.all('SELECT * FROM user_hashtags WHERE user_id = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ user_hashtags: rows });
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
