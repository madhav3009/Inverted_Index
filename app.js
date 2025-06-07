// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (use Redis/MongoDB in production)
let documents = {};
let invertedIndex = {};

// Tokenization function
function tokenize(text) {
    return text.toLowerCase()
              .replace(/[^\w\s]/g, ' ')
              .split(/\s+/)
              .filter(term => term.length > 0);
}

// Build inverted index for a document
function buildIndex(docId, content) {
    const terms = tokenize(content);
    
    // Remove old references if document exists
    if (documents[docId]) {
        const oldTerms = tokenize(documents[docId]);
        oldTerms.forEach(term => {
            if (invertedIndex[term]) {
                invertedIndex[term] = invertedIndex[term].filter(id => id !== docId);
                if (invertedIndex[term].length === 0) {
                    delete invertedIndex[term];
                }
            }
        });
    }
    
    // Add new references
    terms.forEach(term => {
        if (!invertedIndex[term]) {
            invertedIndex[term] = [];
        }
        if (!invertedIndex[term].includes(docId)) {
            invertedIndex[term].push(docId);
        }
    });
}

// API Routes

// Get all documents
app.get('/api/documents', (req, res) => {
    res.json({
        documents,
        stats: {
            docCount: Object.keys(documents).length,
            termCount: Object.keys(invertedIndex).length,
            indexSize: Object.values(invertedIndex).reduce((sum, docs) => sum + docs.length, 0)
        }
    });
});

// Add a document
app.post('/api/documents', (req, res) => {
    const { docId, content } = req.body;
    
    if (!docId || !content) {
        return res.status(400).json({ error: 'Document ID and content are required' });
    }
    
    documents[docId] = content;
    buildIndex(docId, content);
    
    res.json({ 
        message: 'Document added successfully',
        docId,
        content
    });
});

// Delete a document
app.delete('/api/documents/:docId', (req, res) => {
    const { docId } = req.params;
    
    if (!documents[docId]) {
        return res.status(404).json({ error: 'Document not found' });
    }
    
    // Remove from inverted index
    const terms = tokenize(documents[docId]);
    terms.forEach(term => {
        if (invertedIndex[term]) {
            invertedIndex[term] = invertedIndex[term].filter(id => id !== docId);
            if (invertedIndex[term].length === 0) {
                delete invertedIndex[term];
            }
        }
    });
    
    delete documents[docId];
    
    res.json({ message: 'Document deleted successfully' });
});

// Search documents
app.post('/api/search', (req, res) => {
    const { query } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    
    const queryTerms = tokenize(query);
    const searchSteps = [];
    const docScores = {};
    
    searchSteps.push(`🔍 Query: "${query}"`);
    searchSteps.push(`📝 Tokenized terms: [${queryTerms.join(', ')}]`);
    
    queryTerms.forEach(term => {
        searchSteps.push(`🔎 Looking up term: "${term}"`);
        
        if (invertedIndex[term]) {
            const docs = invertedIndex[term];
            searchSteps.push(`✅ Found in documents: [${docs.join(', ')}]`);
            
            docs.forEach(docId => {
                docScores[docId] = (docScores[docId] || 0) + 1;
            });
        } else {
            searchSteps.push(`❌ Term "${term}" not found in index`);
        }
    });
    
    const results = Object.entries(docScores)
                         .sort(([,a], [,b]) => b - a)
                         .map(([docId, score]) => ({
                             docId,
                             score,
                             content: documents[docId]
                         }));
    
    searchSteps.push(`📊 Final results: ${results.length} documents found`);
    
    res.json({
        query,
        queryTerms,
        results,
        searchSteps,
        executionTime: `${Date.now() % 1000}ms` // Mock execution time
    });
});

// Get inverted index
app.get('/api/index', (req, res) => {
    res.json({
        invertedIndex,
        stats: {
            totalTerms: Object.keys(invertedIndex).length,
            totalMappings: Object.values(invertedIndex).reduce((sum, docs) => sum + docs.length, 0)
        }
    });
});

// Load sample data
app.post('/api/sample-data', (req, res) => {
    const sampleDocs = [
        { id: 'doc1', content: 'The quick brown fox jumps over the lazy dog' },
        { id: 'doc2', content: 'A fast brown fox leaps over a sleeping dog' },
        { id: 'doc3', content: 'The lazy cat sits on the warm mat' },
        { id: 'doc4', content: 'Quick silver fox runs through the forest' },
        { id: 'doc5', content: 'Brown bears and lazy pandas eat bamboo' },
        { id: 'doc6', content: 'Elasticsearch uses inverted indexes for fast search' },
        { id: 'doc7', content: 'Lucene is the search engine behind Elasticsearch' }
    ];
    
    // Clear existing data
    documents = {};
    invertedIndex = {};
    
    // Add sample documents
    sampleDocs.forEach(doc => {
        documents[doc.id] = doc.content;
        buildIndex(doc.id, doc.content);
    });
    
    res.json({ 
        message: 'Sample data loaded successfully',
        documentsAdded: sampleDocs.length
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Inverted Index Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at /api/*`);
});

module.exports = app;