/** 
 * Smart URL Redirector and vCard Service 
 * * A lightweight Node.js + Express service that intelligently serves 
 * a vCard file based on the user's device type (iPhone or Android/Other). 
 * * @author Node.js Developer 
 * @version 3.0.0 
 */ 

const express = require('express');
const path = require('path'); // We need this to locate the file 
const app = express();

// Configuration 
const PORT = process.env.PORT || 3000;  

/** 
 * Middleware to log all incoming requests 
 * Useful for debugging and monitoring 
 */ 
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - User-Agent: ${req.get('User-Agent')}`);
    next();
});

/** 
 * Main endpoint for NFC tap 
 * * GET /tap 
 * * Reads the User-Agent header and performs an intelligent action: 
 * - iPhone users   -> Opens the contact card directly. 
 * - Android/Other  -> Prompts to download the contact file. 
 */ 
app.get('/tap', (req, res) => {
    // Extract User-Agent header from the incoming request 
    const userAgent = req.get('User-Agent') || '';

    const filePath = path.join(__dirname, 'contact.vcf');
    const fileName = 'Anand_Bhutkar_Contact.vcf';

    // *** NEW LOGIC STARTS HERE *** 

    // Check if the request is coming from an iPhone 
    if (userAgent.includes('iPhone')) {
        // For iPhones, we send the file with a specific 'Content-Type'. 
        // This tells iOS to treat it as a contact card and open it directly. 
        console.log('iPhone detected. Serving vCard directly.');
        res.setHeader('Content-Type', 'text/vcard');
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error("Error sending file to iPhone:", err);
                if (!res.headersSent) {
                    res.status(500).send('Error: Could not process the contact card.');
                }
            }
        });
    } else {
        // For Android and all other devices, we use the original download method. 
        // This will trigger a "Save File" prompt. 
        console.log('Android or other device detected. Triggering download.');
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error("Error sending file for download:", err);
                if (!res.headersSent) {
                    res.status(500).send('Error: Could not download the file.');
                }
            }
        });
    }
});

/** 
 * Health check endpoint 
 * Useful for monitoring and load balancer health checks 
 */ 
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

/**
 * Root endpoint - provides basic service information
 */
app.get('/', (req, res) => {
    res.json({
        service: 'Smart vCard Service',
        version: '3.0.0',
        endpoints: {
            '/tap': 'Smart device-based vCard handler',
            '/health': 'Health check endpoint'
        },
        description: 'Use /tap endpoint for device-optimized vCard handling'
    });
});

/**
 * Handle 404 errors for undefined routes
 */
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        availableEndpoints: ['/', '/tap', '/health']
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
    console.log('🚀 Smart vCard Server Started');
    console.log(`📡 Server is running on port ${PORT}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log('📱 Ready to handle NFC taps');
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