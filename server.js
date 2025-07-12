const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use(fileUpload({
    createParentPath: true,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}));
app.use(express.static('public'));

// Configurazione Database
const dbPath = process.env.DB_PATH || './database/mail_tool.db';
const db = new sqlite3.Database(dbPath);

// Inizializzazione Database
function initDatabase() {
    // Tabella Template
    db.run(`CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabella Destinatari
    db.run(`CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        status INTEGER DEFAULT 0,
        sent_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabella Invii
    db.run(`CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER,
        category TEXT NOT NULL,
        recipients_count INTEGER,
        delay_seconds INTEGER DEFAULT 30,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES templates (id)
    )`);

    // Tabella Configurazioni
    db.run(`CREATE TABLE IF NOT EXISTS configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        email_host TEXT NOT NULL,
        email_port INTEGER NOT NULL,
        email_user TEXT NOT NULL,
        email_pass TEXT NOT NULL,
        email_from TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Inserisci configurazione di default se non esiste
    db.get('SELECT COUNT(*) as count FROM configurations', (err, row) => {
        if (err) {
            console.error('Errore nel controllo configurazioni:', err);
            return;
        }
        
        if (row.count === 0) {
            db.run(`INSERT INTO configurations (
                name, email_host, email_port, email_user, email_pass, email_from, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                'Configurazione Default',
                process.env.EMAIL_HOST || 'smtp.gmail.com',
                process.env.EMAIL_PORT || 587,
                process.env.EMAIL_USER || 'your-email@gmail.com',
                process.env.EMAIL_PASS || 'your-app-password',
                process.env.EMAIL_FROM || 'your-email@gmail.com',
                1
            ]);
        }
    });
}

// Aggiorna DB: aggiungi campo cancelled se non esiste
function addCancelledColumnIfNeeded() {
    db.all("PRAGMA table_info(campaigns)", (err, columns) => {
        if (err) return;
        const hasCancelled = Array.isArray(columns) && columns.some(col => col.name === 'cancelled');
        if (!hasCancelled) {
            db.run('ALTER TABLE campaigns ADD COLUMN cancelled INTEGER DEFAULT 0');
        }
    });
}

// Configurazione Nodemailer
async function createTransporter() {
    return new Promise((resolve, reject) => {
        // Cerca la configurazione attiva
        db.get('SELECT * FROM configurations WHERE is_active = 1 LIMIT 1', (err, config) => {
            if (err) {
                console.error('Errore nel recupero configurazione:', err);
                // Fallback alle variabili d'ambiente
                resolve(nodemailer.createTransport({
                    host: process.env.EMAIL_HOST,
                    port: process.env.EMAIL_PORT,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                }));
                return;
            }
            
            if (config) {
                // Usa la configurazione dal database
                resolve(nodemailer.createTransport({
                    host: config.email_host,
                    port: config.email_port,
                    secure: false,
                    auth: {
                        user: config.email_user,
                        pass: config.email_pass
                    }
                }));
            } else {
                // Fallback alle variabili d'ambiente
                resolve(nodemailer.createTransport({
                    host: process.env.EMAIL_HOST,
                    port: process.env.EMAIL_PORT,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                }));
            }
        });
    });
}

// Route per la pagina principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Route per la gestione dei template
app.get('/api/templates', (req, res) => {
    db.all('SELECT * FROM templates ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/templates', (req, res) => {
    const { name, subject, content } = req.body;
    
    if (!name || !subject || !content) {
        res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
        return;
    }

    db.run('INSERT INTO templates (name, subject, content) VALUES (?, ?, ?)', 
        [name, subject, content], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Template creato con successo' });
    });
});

app.get('/api/templates/:id', (req, res) => {
    db.get('SELECT * FROM templates WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Template non trovato' });
            return;
        }
        res.json(row);
    });
});

app.put('/api/templates/:id', (req, res) => {
    const { name, subject, content } = req.body;
    
    db.run('UPDATE templates SET name = ?, subject = ?, content = ? WHERE id = ?',
        [name, subject, content, req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Template aggiornato con successo' });
    });
});

app.delete('/api/templates/:id', (req, res) => {
    db.run('DELETE FROM templates WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Template eliminato con successo' });
    });
});

// Route per la gestione dei destinatari
app.get('/api/recipients', (req, res) => {
    const { category } = req.query;
    let query = 'SELECT * FROM recipients';
    let params = [];
    
    if (category) {
        query += ' WHERE category = ?';
        params.push(category);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/categories', (req, res) => {
    db.all('SELECT DISTINCT category FROM recipients ORDER BY category', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.map(row => row.category));
    });
});

app.post('/api/recipients/upload', (req, res) => {
    if (!req.files || !req.files.csv) {
        res.status(400).json({ error: 'Nessun file CSV caricato' });
        return;
    }

    const csvFile = req.files.csv;
    const csv = require('csv-parser');
    const results = [];

    csvFile.data.toString()
        .split('\n')
        .slice(1) // Salta l'intestazione
        .forEach(line => {
            const [email, name, category] = line.split(',').map(field => field.trim());
            if (email && name && category) {
                results.push({ email, name, category });
            }
        });

    // Inserimento batch nel database
    const stmt = db.prepare('INSERT OR REPLACE INTO recipients (email, name, category) VALUES (?, ?, ?)');
    
    results.forEach(recipient => {
        stmt.run([recipient.email, recipient.name, recipient.category]);
    });
    
    stmt.finalize((err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: `${results.length} destinatari importati con successo` });
    });
});

// Route per l'invio delle email
app.post('/api/send', (req, res) => {
    const { templateId, category, recipientsCount, delaySeconds } = req.body;
    
    if (!templateId || !category) {
        res.status(400).json({ error: 'Template ID e categoria sono obbligatori' });
        return;
    }

    // Creazione campagna
    db.run('INSERT INTO campaigns (template_id, category, recipients_count, delay_seconds) VALUES (?, ?, ?, ?)',
        [templateId, category, recipientsCount || 0, delaySeconds || 30], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const campaignId = this.lastID;
        
        // Recupera template e destinatari
        db.get('SELECT * FROM templates WHERE id = ?', [templateId], (err, template) => {
            if (err || !template) {
                res.status(500).json({ error: 'Template non trovato' });
                return;
            }

            db.all('SELECT * FROM recipients WHERE category = ? AND status = 0 LIMIT ?', 
                [category, recipientsCount || 1000], (err, recipients) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                if (recipients.length === 0) {
                    res.status(400).json({ error: 'Nessun destinatario trovato per questa categoria' });
                    return;
                }

                // Avvia l'invio asincrono
                sendEmails(template, recipients, delaySeconds || 30, campaignId);
                
                res.json({ 
                    message: `Invio avviato per ${recipients.length} destinatari`,
                    campaignId: campaignId
                });
            });
        });
    });
});

// Funzione per l'invio asincrono delle email
async function sendEmails(template, recipients, delaySeconds, campaignId) {
    const transporter = await createTransporter();
    let sentCount = 0;
    let errorCount = 0;

    for (const recipient of recipients) {
        // Controlla se la campagna è stata annullata
        const cancelled = await new Promise(resolve => {
            db.get('SELECT cancelled FROM campaigns WHERE id = ?', [campaignId], (err, row) => {
                resolve(row && row.cancelled === 1);
            });
        });
        if (cancelled) {
            db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['cancelled', campaignId]);
            console.log(`[CANCEL] Invio annullato per campagna ${campaignId}`);
            break;
        }
        try {
            // Personalizza il contenuto
            let personalizedContent = template.content
                .replace(/\{\{nome\}\}/gi, recipient.name)
                .replace(/\{\{email\}\}/gi, recipient.email)
                .replace(/\{\{categoria\}\}/gi, recipient.category);

            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: recipient.email,
                subject: template.subject,
                html: personalizedContent
            };

            await transporter.sendMail(mailOptions);
            // Log invio positivo
            console.log(`[MAIL OK] Inviata a: ${recipient.email}`);
            // Aggiorna lo stato del destinatario a inviata (1)
            db.run('UPDATE recipients SET status = 1, sent_date = CURRENT_TIMESTAMP WHERE id = ?', 
                [recipient.id]);
            sentCount++;
        } catch (error) {
            // Log invio fallito
            console.log(`[MAIL FAIL] Errore invio a: ${recipient.email} - ${error.message}`);
            // Aggiorna lo stato del destinatario a errore (-1)
            db.run('UPDATE recipients SET status = -1, sent_date = CURRENT_TIMESTAMP WHERE id = ?', 
                [recipient.id]);
            errorCount++;
        }
        // Aggiorna lo stato della campagna alla fine
        if (sentCount + errorCount === recipients.length) {
            let campaignStatus = "completed";
            if (errorCount > 0) {
                campaignStatus = "completed_with_errors";
            }
            db.run('UPDATE campaigns SET status = ? WHERE id = ?', [campaignStatus, campaignId]);
        }
        // Attendi prima dell'invio successivo (solo se non è l'ultimo)
        if (sentCount + errorCount < recipients.length) {
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
    }
}

// Route per lo stato delle campagne
app.get('/api/campaigns', (req, res) => {
    db.all(`
        SELECT c.*, t.name as template_name 
        FROM campaigns c 
        LEFT JOIN templates t ON c.template_id = t.id 
        ORDER BY c.created_at DESC
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Stato avanzamento invio campagna
app.get('/api/campaigns/:id/progress', (req, res) => {
    const campaignId = req.params.id;
    db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, campaign) => {
        if (err || !campaign) {
            res.status(404).json({ error: 'Campagna non trovata' });
            return;
        }
        db.all('SELECT * FROM recipients WHERE category = ?', [campaign.category], (err, recipients) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            const total = recipients.length;
            const sent = recipients.filter(r => r.status === 1).length;
            const error = recipients.filter(r => r.status === -1).length;
            const errors = recipients.filter(r => r.status === -1).map(r => r.email);
            // Email corrente: la prima con status 0
            const currentObj = recipients.find(r => r.status === 0);
            const current = currentObj ? currentObj.email : null;
            const done = (sent + error) === total || campaign.status === 'cancelled';
            res.json({
                total,
                sent,
                error,
                errors,
                current,
                done,
                status: campaign.status
            });
        });
    });
});

// Route per la gestione delle configurazioni
app.get('/api/configurations', (req, res) => {
    db.all('SELECT * FROM configurations ORDER BY is_active DESC, created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/configurations', (req, res) => {
    const { name, email_host, email_port, email_user, email_pass, email_from, is_active } = req.body;
    
    if (!name || !email_host || !email_port || !email_user || !email_pass || !email_from) {
        res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
        return;
    }

    // Se questa configurazione deve essere attiva, disattiva le altre
    if (is_active) {
        db.run('UPDATE configurations SET is_active = 0');
    }

    db.run(`INSERT INTO configurations (
        name, email_host, email_port, email_user, email_pass, email_from, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [name, email_host, email_port, email_user, email_pass, email_from, is_active ? 1 : 0], 
        function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Configurazione creata con successo' });
    });
});

app.get('/api/configurations/:id', (req, res) => {
    db.get('SELECT * FROM configurations WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Configurazione non trovata' });
            return;
        }
        res.json(row);
    });
});

app.put('/api/configurations/:id', (req, res) => {
    const { name, email_host, email_port, email_user, email_pass, email_from, is_active } = req.body;
    
    if (!name || !email_host || !email_port || !email_user || !email_pass || !email_from) {
        res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
        return;
    }

    // Se questa configurazione deve essere attiva, disattiva le altre
    if (is_active) {
        db.run('UPDATE configurations SET is_active = 0 WHERE id != ?', [req.params.id]);
    }

    db.run(`UPDATE configurations SET 
        name = ?, email_host = ?, email_port = ?, email_user = ?, 
        email_pass = ?, email_from = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [name, email_host, email_port, email_user, email_pass, email_from, is_active ? 1 : 0, req.params.id], 
        function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Configurazione aggiornata con successo' });
    });
});

app.delete('/api/configurations/:id', (req, res) => {
    db.run('DELETE FROM configurations WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Configurazione eliminata con successo' });
    });
});

app.post('/api/configurations/:id/activate', (req, res) => {
    // Disattiva tutte le configurazioni
    db.run('UPDATE configurations SET is_active = 0', (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Attiva la configurazione specificata
        db.run('UPDATE configurations SET is_active = 1 WHERE id = ?', [req.params.id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Configurazione attivata con successo' });
        });
    });
});

// Route per eliminare una campagna
app.delete('/api/campaigns/:id', (req, res) => {
    db.run('DELETE FROM campaigns WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Campagna eliminata con successo' });
    });
});

// Route per ritentare una campagna
app.post('/api/campaigns/:id/retry', (req, res) => {
    // Recupera i dettagli della campagna
    db.get('SELECT * FROM campaigns WHERE id = ?', [req.params.id], (err, campaign) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!campaign) {
            res.status(404).json({ error: 'Campagna non trovata' });
            return;
        }

        // Recupera template e destinatari
        db.get('SELECT * FROM templates WHERE id = ?', [campaign.template_id], (err, template) => {
            if (err || !template) {
                res.status(500).json({ error: 'Template non trovato' });
                return;
            }

            // Recupera destinatari non inviati (status = 0) per questa categoria
            db.all('SELECT * FROM recipients WHERE category = ? AND status = 0 LIMIT ?', 
                [campaign.category, campaign.recipients_count || 1000], (err, recipients) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                if (recipients.length === 0) {
                    res.status(400).json({ error: 'Nessun destinatario disponibile per il ritry' });
                    return;
                }

                // Aggiorna lo stato della campagna a pending
                db.run('UPDATE campaigns SET status = "pending" WHERE id = ?', [req.params.id], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    // Avvia l'invio asincrono
                    sendEmails(template, recipients, campaign.delay_seconds, req.params.id);
                    
                    res.json({ 
                        message: `Riprova avviata per ${recipients.length} destinatari`,
                        campaignId: req.params.id
                    });
                });
            });
        });
    });
});

// Endpoint per annullare una campagna
app.post('/api/campaigns/:id/cancel', (req, res) => {
    db.run('UPDATE campaigns SET cancelled = 1 WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Campagna annullata' });
    });
});

// Elimina destinatario singolo
app.delete('/api/recipients/:id', (req, res) => {
    db.run('DELETE FROM recipients WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Destinatario eliminato con successo' });
    });
});
// Elimina destinatari massivi per categoria o tutti
app.delete('/api/recipients', (req, res) => {
    const { category } = req.query;
    let query = 'DELETE FROM recipients';
    let params = [];
    if (category) {
        query += ' WHERE category = ?';
        params.push(category);
    }
    db.run(query, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Destinatari eliminati con successo' });
    });
});

// Elimina destinatari selezionati (bulk)
app.post('/api/recipients/bulk', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'Nessun destinatario selezionato' });
        return;
    }
    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM recipients WHERE id IN (${placeholders})`, ids, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Destinatari selezionati eliminati con successo' });
    });
});

// Conta destinatari disponibili per categoria
app.get('/api/recipients/count', (req, res) => {
    const { category } = req.query;
    if (!category) {
        res.status(400).json({ error: 'Categoria richiesta' });
        return;
    }
    db.get('SELECT COUNT(*) as count FROM recipients WHERE category = ? AND status = 0', [category], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ count: row.count });
    });
});

// Inizializzazione e avvio server
initDatabase();
addCancelledColumnIfNeeded();

app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
    console.log('Database inizializzato');
}); 