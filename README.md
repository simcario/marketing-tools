# Mail Tool - Gestione Template Email

Un'applicazione web completa per la gestione di template email e invio massivo con editor WYSIWYG integrato.

## Caratteristiche

- **Editor WYSIWYG**: Crea template email ricchi con formattazione avanzata
- **Gestione Destinatari**: Carica destinatari tramite file CSV con categorie
- **Invio Massivo**: Invia email con ritardo personalizzabile tra gli invii
- **Database SQLite**: Memorizzazione locale dei dati
- **Interfaccia Moderna**: UI responsive con Bootstrap 5
- **Personalizzazione**: Variabili dinamiche nei template ({{nome}}, {{email}}, {{categoria}})

## Installazione

1. **Clona il repository**:
   ```bash
   git clone <repository-url>
   cd mail-tool
   ```

2. **Installa le dipendenze**:
   ```bash
   npm install
   ```

3. **Configura le credenziali email**:
   - Rinomina `config.env` in `.env` (se necessario)
   - Modifica le credenziali Gmail nel file di configurazione:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=your-email@gmail.com
   ```

   **Nota**: Per Gmail, devi usare una "App Password" invece della password normale. 
   Vai su [Google Account Settings](https://myaccount.google.com/apppasswords) per generarla.

4. **Avvia l'applicazione**:
   ```bash
   npm start
   ```

   Per sviluppo con auto-reload:
   ```bash
   npm run dev
   ```

5. **Apri il browser**:
   Naviga su `http://localhost:3000`

## Configurazione Email

### Gmail Setup
1. Abilita l'autenticazione a due fattori sul tuo account Google
2. Vai su [App Passwords](https://myaccount.google.com/apppasswords)
3. Genera una nuova app password per "Mail"
4. Usa questa password nel file `.env`

### Altri Provider
Modifica il file `.env` con le impostazioni del tuo provider:
```env
EMAIL_HOST=smtp.tuoprovider.com
EMAIL_PORT=587
EMAIL_USER=tuo-email@tuoprovider.com
EMAIL_PASS=tuapassword
EMAIL_FROM=tuo-email@tuoprovider.com
```

## Utilizzo

### 1. Creazione Template

1. Vai alla sezione "Template"
2. Clicca su "Nuovo"
3. Inserisci:
   - **Nome**: Nome identificativo del template
   - **Oggetto**: Oggetto dell'email
   - **Contenuto**: Usa l'editor WYSIWYG per creare il contenuto

**Variabili disponibili**:
- `{{nome}}` - Nome del destinatario
- `{{email}}` - Email del destinatario  
- `{{categoria}}` - Categoria del destinatario

### 2. Caricamento Destinatari

1. Vai alla sezione "Destinatari"
2. Prepara un file CSV con il formato:
   ```csv
   email,nome,categoria
   mario.rossi@example.com,Mario Rossi,Clienti
   giulia.bianchi@example.com,Giulia Bianchi,Fornitori
   ```
3. Carica il file tramite l'interfaccia
4. Visualizza e filtra i destinatari per categoria

### 3. Invio Campagne

1. Vai alla sezione "Campagne"
2. Seleziona:
   - **Template**: Il template da utilizzare
   - **Categoria**: I destinatari target
   - **Numero Destinatari**: Quanti inviare (opzionale)
   - **Ritardo**: Secondi tra un invio e l'altro (default: 30s)
3. Clicca "Avvia Invio"

## Struttura Database

### Tabella `templates`
- `id` - ID univoco
- `name` - Nome del template
- `subject` - Oggetto email
- `content` - Contenuto HTML
- `created_at` - Data creazione

### Tabella `recipients`
- `id` - ID univoco
- `email` - Email destinatario (univoca)
- `name` - Nome destinatario
- `category` - Categoria
- `status` - Stato invio (0=in attesa, 1=inviata)
- `sent_date` - Data/ora invio
- `created_at` - Data creazione

### Tabella `campaigns`
- `id` - ID univoco
- `template_id` - Riferimento al template
- `category` - Categoria destinatari
- `recipients_count` - Numero destinatari
- `delay_seconds` - Ritardo tra invii
- `status` - Stato campagna (pending/completed/error)
- `created_at` - Data creazione

## API Endpoints

### Template
- `GET /api/templates` - Lista template
- `POST /api/templates` - Crea template
- `GET /api/templates/:id` - Dettagli template
- `PUT /api/templates/:id` - Aggiorna template
- `DELETE /api/templates/:id` - Elimina template

### Destinatari
- `GET /api/recipients` - Lista destinatari
- `GET /api/categories` - Lista categorie
- `POST /api/recipients/upload` - Carica CSV

### Campagne
- `GET /api/campaigns` - Lista campagne
- `POST /api/send` - Avvia campagna

## Sicurezza

- Le credenziali email sono memorizzate nel file `.env`
- Il database SQLite è locale e non esposto
- Validazione input su tutti i form
- Sanitizzazione dei dati CSV

## Troubleshooting

### Errore "Authentication failed"
- Verifica le credenziali nel file `.env`
- Per Gmail, usa una App Password
- Controlla che l'autenticazione a due fattori sia abilitata

### Errore "Database locked"
- Chiudi altre istanze dell'applicazione
- Verifica i permessi della cartella database

### Email non inviate
- Controlla i log del server per errori specifici
- Verifica la connessione internet
- Controlla i limiti del provider email

## Sviluppo

### Struttura Progetto
```
mail-tool/
├── server.js          # Server Express
├── config.env         # Configurazione
├── package.json       # Dipendenze
├── database/          # Database SQLite
├── public/            # File statici
│   ├── css/
│   └── js/
├── views/             # Template HTML
└── README.md
```

### Tecnologie Utilizzate
- **Backend**: Node.js, Express, SQLite3
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Editor**: Quill.js (WYSIWYG)
- **UI**: Bootstrap 5, Font Awesome
- **Email**: Nodemailer

## Licenza

ISC License 