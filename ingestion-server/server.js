require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// Postgres Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize database tables
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        core TEXT DEFAULT '{}',
        chars TEXT DEFAULT '[]',
        rules TEXT DEFAULT '[]',
        beats TEXT DEFAULT '[]',
        voice TEXT DEFAULT '{}',
        created_at BIGINT,
        updated_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT NOT NULL,
        "order" INTEGER DEFAULT 0,
        is_draft BOOLEAN DEFAULT false,
        created_at BIGINT,
        updated_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        chapter_id TEXT,
        title TEXT NOT NULL,
        text TEXT,
        "order" INTEGER DEFAULT 0,
        is_draft BOOLEAN DEFAULT false,
        mode_feedback TEXT DEFAULT '{}',
        created_at BIGINT,
        updated_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        domain TEXT,
        subdomain TEXT,
        content TEXT,
        metadata TEXT DEFAULT '{}',
        created_at BIGINT,
        updated_at BIGINT
      );
    `);
    console.log('Postgres tables initialized');
  } catch (err) {
    console.error('DB Init Error:', err);
  } finally {
    client.release();
  }
}
initDB();

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.send('<h1>ProseLab Ingestion Server</h1><p>Status: Online</p><p>Ready for document uploads.</p>');
});

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_KEY,
});

// Storage setup
const PENDING_DIR = path.join(__dirname, 'pending-docs');
if (!fs.existsSync(PENDING_DIR)) {
  fs.mkdirSync(PENDING_DIR);
}

/**
 * 1. Receive document from Google Apps Script
 */
app.post('/api/documents/email-upload', async (req, res) => {
  try {
    const {
      fileName,
      contentType,
      size,
      email,
      fileData,
      uploadedAt
    } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'No file data received' });
    }

    const { subject, from, to, date, body, messageId } = email || {};

    console.log(`Received document: ${fileName} from ${from} (${subject})`);

    // Decode base64 file data
    const buffer = Buffer.from(fileData, 'base64');
    const textContent = buffer.toString('utf-8'); 

    // 2. Intelligent Classification using AI
    const classification = await classifyDocument({
      fileName,
      emailSubject: subject,
      emailBody: body,
      textContent: textContent.substring(0, 3000) 
    });

    const docId = `doc_${Date.now()}`;
    const docPath = path.join(PENDING_DIR, `${docId}.json`);

    const docRecord = {
      id: docId,
      fileName,
      contentType,
      size,
      emailMeta: {
        subject,
        from,
        to,
        date,
        body,
        messageId
      },
      textContent,
      classification,
      receivedAt: new Date().toISOString(),
      uploadedAt: uploadedAt || new Date().toISOString(),
      status: 'pending'
    };

    fs.writeFileSync(docPath, JSON.stringify(docRecord, null, 2));

    console.log(`Document classified as: ${classification.category} for project: ${classification.project}`);

    res.json({
      success: true,
      id: docId,
      classification
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3. List pending documents for the app
 */
app.get('/api/documents/pending', (req, res) => {
  try {
    const files = fs.readdirSync(PENDING_DIR);
    const docs = files.map(file => {
      const content = fs.readFileSync(path.join(PENDING_DIR, file), 'utf-8');
      return JSON.parse(content);
    }).filter(doc => doc.status === 'pending');

    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4. Mark document as processed
 */
app.post('/api/documents/process/:id', (req, res) => {
  try {
    const { id } = req.params;
    const docPath = path.join(PENDING_DIR, `${id}.json`);
    
    if (fs.existsSync(docPath)) {
      const doc = JSON.parse(fs.readFileSync(docPath, 'utf-8'));
      doc.status = 'processed';
      doc.processedAt = new Date().toISOString();
      fs.writeFileSync(docPath, JSON.stringify(doc, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * AI Classification Logic
 */
async function classifyDocument({ fileName, emailSubject, emailBody, textContent }) {
  try {
    const structure = await getDocumentStructure();
    const prompt = `
      Analyze this incoming document from an email and determine its category and which project it belongs to.
      
      EXISTING PROJECTS: ${structure.projects.join(', ')}
      
      EMAIL SUBJECT: ${emailSubject}
      EMAIL BODY: ${emailBody}
      FILENAME: ${fileName}
      DOCUMENT PREVIEW: ${textContent}
      
      CATEGORIES:
      - manuscript: A chapter or section of a novel/book.
      - characters: Character profiles or dossiers.
      - worldbuilding: Lore, settings, or rules of the world.
      - outline: Plot summaries or beat sheets.
      - research: Reference materials or research notes.
      
      Respond in JSON format:
      {
        "category": "category_name",
        "project": "project_name_or_id",
        "confidence": 0.0-1.0,
        "reason": "short explanation"
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Classification AI error:', error);
    return {
      category: 'notes',
      project: 'unknown',
      confidence: 0,
      reason: 'AI classification failed'
    };
  }
}

/**
 * Sync project list from the app for better AI classification
 */
let syncedProjects = [];
app.post('/api/sync/projects', (req, res) => {
  syncedProjects = req.body.projects || [];
  res.json({ success: true, count: syncedProjects.length });
});

async function getDocumentStructure() {
  return {
    projects: syncedProjects
  };
}

/**
 * PROSELAB BACKEND API (POSTGRES)
 */

// PROJECTS
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { id, title, core, chars, rules, beats, voice, createdAt, updatedAt } = req.body;
    await pool.query(
      'INSERT INTO projects (id, title, core, chars, rules, beats, voice, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, title, core, chars, rules, beats, voice, createdAt, updatedAt]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, core, chars, rules, beats, voice, updated_at } = req.body;
    await pool.query(
      'UPDATE projects SET title = COALESCE($1, title), core = COALESCE($2, core), chars = COALESCE($3, chars), rules = COALESCE($4, rules), beats = COALESCE($5, beats), voice = COALESCE($6, voice), updated_at = $7 WHERE id = $8',
      [title, core, chars, rules, beats, voice, updated_at || Date.now(), id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CHAPTERS
app.get('/api/projects/:projectId/chapters', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query('SELECT * FROM chapters WHERE project_id = $1 ORDER BY "order" ASC', [projectId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chapters', async (req, res) => {
  try {
    const { id, projectId, title, order, isDraft, createdAt, updatedAt } = req.body;
    await pool.query(
      'INSERT INTO chapters (id, project_id, title, "order", is_draft, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, projectId, title, order, isDraft, createdAt, updatedAt]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SCENES
app.get('/api/projects/:projectId/scenes', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query('SELECT * FROM scenes WHERE project_id = $1 ORDER BY "order" ASC', [projectId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scenes', async (req, res) => {
  try {
    const { id, projectId, chapterId, title, text, order, isDraft, modeFeedback, createdAt, updatedAt } = req.body;
    await pool.query(
      'INSERT INTO scenes (id, project_id, chapter_id, title, text, "order", is_draft, mode_feedback, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, projectId, chapterId, title, text, order, isDraft, modeFeedback, createdAt, updatedAt]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/scenes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, text, order, chapter_id, mode_feedback, updated_at } = req.body;
    await pool.query(
      'UPDATE scenes SET title = COALESCE($1, title), text = COALESCE($2, text), "order" = COALESCE($3, "order"), chapter_id = COALESCE($4, chapter_id), mode_feedback = COALESCE($5, mode_feedback), updated_at = $6 WHERE id = $7',
      [title, text, order, chapter_id, mode_feedback, updated_at || Date.now(), id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const ensureJson = (val, defaultVal = {}) => {
  if (!val) return defaultVal;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    let current = val;
    // Handle multiple levels of stringification
    while (typeof current === 'string' && (current.startsWith('{') || current.startsWith('[') || current.startsWith('"'))) {
      try {
        const next = JSON.parse(current);
        if (next === current) break; // Reached literal string
        current = next;
      } catch (e) {
        break;
      }
    }
    return current;
  }
  return val;
};

// MIGRATION ENDPOINT
app.post('/api/migrate/batch', async (req, res) => {
  await initDB(); // Ensure tables exist
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { projects, chapters, scenes, documents } = req.body;

    console.log(`Starting migration: ${projects?.length || 0} projects, ${chapters?.length || 0} chapters, ${scenes?.length || 0} scenes, ${documents?.length || 0} documents`);

    for (const p of projects || []) {
      await client.query(
        'INSERT INTO projects (id, title, core, chars, rules, beats, voice, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, core = EXCLUDED.core, chars = EXCLUDED.chars, rules = EXCLUDED.rules, beats = EXCLUDED.beats, voice = EXCLUDED.voice, updated_at = EXCLUDED.updated_at',
        [
          p.id, 
          p.title, 
          typeof p.core === 'string' ? p.core : JSON.stringify(p.core || {}),
          typeof p.chars === 'string' ? p.chars : JSON.stringify(p.chars || []),
          typeof p.rules === 'string' ? p.rules : JSON.stringify(p.rules || []),
          typeof p.beats === 'string' ? p.beats : JSON.stringify(p.beats || []),
          typeof p.voice === 'string' ? p.voice : JSON.stringify(p.voice || {}),
          p.createdAt || Date.now(), 
          p.updatedAt || Date.now()
        ]
      );
    }

    for (const c of chapters || []) {
      await client.query(
        'INSERT INTO chapters (id, project_id, title, "order", is_draft, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, "order" = EXCLUDED.order, is_draft = EXCLUDED.is_draft, updated_at = EXCLUDED.updated_at',
        [c.id, c.projectId, c.title, c.order || 0, c.isDraft || false, c.createdAt || Date.now(), c.updatedAt || Date.now()]
      );
    }

    for (const s of scenes || []) {
      await client.query(
        'INSERT INTO scenes (id, project_id, chapter_id, title, text, "order", is_draft, mode_feedback, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, text = EXCLUDED.text, "order" = EXCLUDED.order, is_draft = EXCLUDED.is_draft, mode_feedback = EXCLUDED.mode_feedback, updated_at = EXCLUDED.updated_at',
        [
          s.id, 
          s.projectId, 
          s.chapterId, 
          s.title, 
          s.text || '', 
          s.order || 0, 
          s.isDraft || false, 
          typeof s.modeFeedback === 'string' ? s.modeFeedback : JSON.stringify(s.modeFeedback || {}),
          s.createdAt || Date.now(), 
          s.updatedAt || Date.now()
        ]
      );
    }

    for (const d of documents || []) {
        await client.query(
          'INSERT INTO documents (id, project_id, title, type, domain, subdomain, content, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at',
          [
            d.id, 
            d.projectId, 
            d.title, 
            d.type, 
            d.domain, 
            d.subdomain, 
            typeof d.content === 'string' ? d.content : JSON.stringify(d.content || ''), 
            typeof d.metadata === 'string' ? d.metadata : JSON.stringify(d.metadata || {}),
            d.createdAt || Date.now(), 
            d.updatedAt || Date.now()
          ]
        );
      }

    await client.query('COMMIT');
    console.log('Migration completed successfully');
    res.json({ success: true, count: (projects || []).length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`ProseLab Backend running on http://localhost:${PORT}`);
  console.log(`Pending documents directory: ${PENDING_DIR}`);
});
