/**
 * Remote vCard Proxy Service
 * Fetches vCard files from a separate server (Hostinger) and serves them.
 * @version 5.0.0
 */

const express = require('express');
const axios = require('axios'); // <-- REQUIRE THE NEW LIBRARY

const app = express();
const PORT = process.env.PORT || 3000;

// Base URL where your vCard files are stored on Hostinger
const VCARD_BASE_URL = 'http://tapcard.themediatree.co.in/cards';

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - User-Agent: ${req.get('User-Agent')}`);
    next();
});

/**
 * Dynamic endpoint for NFC tap
 * GET /tap/:cardName
 * Fetches [cardName].vcf from the remote server.
 */
app.get('/tap/:cardName', async (req, res) => {
    const cardName = req.params.cardName;
    const remoteFileUrl = `${VCARD_BASE_URL}/${cardName}.vcf`;
    const fileName = `${cardName}_Contact.vcf`;

    try {
        console.log(`Fetching remote file from: ${remoteFileUrl}`);
        
        // Use axios to get the file as a stream
        const response = await axios({
            method: 'get',
            url: remoteFileUrl,
            responseType: 'stream'
        });

        const userAgent = req.get('User-Agent') || '';

        // --- Device detection logic remains the same ---
        if (userAgent.includes('iPhone')) {
            console.log(`iPhone detected. Streaming card: ${cardName}`);
            res.setHeader('Content-Type', 'text/vcard');
            response.data.pipe(res); // Pipe the file stream directly to the response
        } else {
            console.log(`Android/Other detected. Triggering download for card: ${cardName}`);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            response.data.pipe(res); // Pipe the file stream directly to the response
        }

    } catch (error) {
        // This block will catch errors if the file doesn't exist on Hostinger
        console.error(`Error fetching file: ${remoteFileUrl}`, error.message);
        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: 'Not Found', message: 'The requested contact card does not exist.' });
        } else {
            res.status(500).json({ error: 'Internal Server Error', message: 'Could not retrieve the contact card.' });
        }
    }
});

/**
 * Legacy endpoint for backward compatibility
 * GET /tap
 * Uses the default card (anand) for backward compatibility
 */
app.get('/tap', async (req, res) => {
    // Redirect to the new dynamic endpoint with default card name
    res.redirect('/tap/anand');
});

/**
 * Health check endpoint
 * Useful for monitoring and load balancer health checks
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Remote vCard Proxy Service',
        version: '5.0.0'
    });
});

/**
 * Root endpoint - provides basic service information
 */
app.get('/', (req, res) => {
    res.json({
        service: 'Remote vCard Proxy Service',
        version: '5.0.0',
        endpoints: {
            '/tap/:cardName': 'Dynamic vCard handler for specific contact cards',
            '/tap': 'Legacy endpoint (redirects to /tap/anand)',
            '/health': 'Health check endpoint'
        },
        description: 'Use /tap/:cardName endpoint for device-optimized vCard handling from remote storage',
        remoteStorage: VCARD_BASE_URL
    });
});

/**
 * Handle 404 errors for undefined routes
 */
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        availableEndpoints: ['/', '/tap/:cardName', '/tap', '/health']
    });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
    console.error(`Error occurred: ${err.message}`);
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
    });
});

/**
 * Start the Express server
 */
const server = app.listen(PORT, () => {
    console.log('===========================================');
    console.log('🚀 Remote vCard Proxy Server Started');
    console.log(`📡 Server is running on port ${PORT}`);
    console.log('📱 Ready to handle NFC taps from remote files');
    console.log(`🔗 Remote storage: ${VCARD_BASE_URL}`);
    console.log('===========================================');
});

/**
 * Graceful shutdown handling
 */
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Export for testing purposes (optional)
module.exports = app;