```mermaid
flowchart TD
    A[Email Parser\nRiceve allarme da casella IMAP] --> B[Estrae dati\nHost, Service, Status, Message, Timestamp]
    B --> C{Manutenzione attiva\ncorrelata?}
    C -- Sì --> C1[Marca allarme\nmaintenance_related]
    C1 --> Z[Fine / Archivia]
    C -- No --> D[Ricerca procedura\nKnowledge Base]
    D --> D1{Match host + service?}
    D1 -- Sì --> E[Procedura trovata]
    D1 -- No --> D2{Match keywords?}
    D2 -- Sì --> E
    D2 -- No --> D3{Match categoria allarme?}
    D3 -- Sì --> E
    D3 -- No --> F[Nessuna procedura trovata]
    E --> E1[Identifica controlli\nautomatizzabili]
    E1 --> E2[Esegue controlli safe\nPing / HTTP GET]
    E2 --> E3[Presenta risultati\n+ procedura suggerita]
    F --> F1[Cerca allarmi\nstorici simili]
    F1 --> F2[Suggerisce procedura\ngenerica per categoria]
    E3 --> G[Attende conferma\noperatore]
    F2 --> G
    G --> H{Azioni invasive\napprovate?}
    H -- Sì --> I[Esegue azioni\napprovate]
    H -- No --> Z
    I --> L[Richiede feedback\nsu efficacia risoluzione]
    L --> Z[Fine]
