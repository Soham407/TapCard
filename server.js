/**
 * Smart URL Redirector Service
 * 
 * A lightweight Node.js + Express service that intelligently redirects users
 * based on their device type (iPhone, Android, or Desktop/Other).
 * Optimized for NFC card taps on mobile devices with desktop fallback.
 * 
 * @author Node.js Developer
 * @version 2.0.0
 */

const express = require('express');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;

// Redirect URLs (customize these for your needs)
const REDIRECT_URLS = {
    iphone: 'https://apps.apple.com/us/app/your-app-name/id123456789',
    android: 'https://www.youtube.com/watch?v=W20ooFdJopg',
    default: 'https://www.yourcompany.com'
};

/**
 * Middleware to log all incoming requests
 * Useful for debugging and monitoring
 */
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

/**
 * Main redirect endpoint
 * 
 * GET /tap
 * 
 * Reads the User-Agent header and performs intelligent redirects:
 * - iPhone users → App Store
 * - Android users → Google Play Store
 * - Desktop/Other → Company website
 */
app.get('/tap', (req, res) => {
    // Extract User-Agent header from the incoming request
    const userAgent = req.get('User-Agent') || '';
    
    // Log the detected User-Agent for debugging purposes
    console.log(`Detected User-Agent: ${userAgent}`);
    
    let redirectUrl;
    let deviceType;
    
    // Determine redirect URL based on User-Agent string matching
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        // iPhone/iPad detected - redirect to App Store
        redirectUrl = REDIRECT_URLS.iphone;
        deviceType = 'iPhone/iPad';
    } else if (userAgent.includes('Android')) {
        // Android detected - redirect to Google Play Store
        redirectUrl = REDIRECT_URLS.android;
        deviceType = 'Android';
    } else {
        // Desktop, tablet, or unknown device - redirect to company website
        redirectUrl = REDIRECT_URLS.default;
        deviceType = 'Desktop/Other';
    }
    
    // Log the redirect decision
    console.log(`Device Type: ${deviceType} | Redirecting to: ${redirectUrl}`);
    
    // Perform 302 (temporary) redirect
    // Using 302 allows for easy URL changes without caching issues
    res.redirect(302, redirectUrl);
});

/**
 * Health check endpoint
 * Useful for monitoring and load balancer health checks
 */
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        redirect_urls: REDIRECT_URLS
    });
});

/**
 * Root endpoint - provides basic service information
 */
app.get('/', (req, res) => {
    res.json({
        service: 'Smart URL Redirector',
        version: '2.0.0',
        endpoints: {
            '/tap': 'Smart device-based redirect handler',
            '/health': 'Health check endpoint'
        },
        redirect_urls: REDIRECT_URLS,
        description: 'Use /tap endpoint for device-optimized URL redirection'
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
    console.log('🚀 Smart URL Redirector Server Started');
    console.log(`📡 Server is running on port ${PORT}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log('📱 Ready to handle NFC tap redirects');
    console.log('===========================================');
    console.log('Available endpoints:');
    console.log(`  - GET /tap     : Smart redirect based on device`);
    console.log(`  - GET /health  : Health check endpoint`);
    console.log(`  - GET /        : Service information`);
    console.log('===========================================');
    console.log('Redirect URLs configured:');
    console.log(`  - iPhone/iPad: ${REDIRECT_URLS.iphone}`);
    console.log(`  - Android: ${REDIRECT_URLS.android}`);
    console.log(`  - Desktop/Other: ${REDIRECT_URLS.default}`);
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