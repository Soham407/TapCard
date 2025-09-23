/**
 * Remote vCard Proxy Service
 * Fetches vCard files from Supabase Storage and serves them.
 * Includes an admin dashboard for file uploads.
 * @version 7.0.0
 */

const express = require('express');
const axios = require('axios');
const path = require('path'); // Added for serving local files
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Supabase configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_VCF_BUCKET || 'vcf';
const SUPABASE_PUBLIC_BUCKET = String(process.env.SUPABASE_PUBLIC_BUCKET || 'true').toLowerCase() === 'true';

if (!SUPABASE_URL) {
	console.warn('[Startup] SUPABASE_URL is not set. Set it in environment variables.');
}
if (!SUPABASE_PUBLIC_BUCKET && !SUPABASE_SERVICE_KEY) {
	console.warn('[Startup] Private bucket configured but SUPABASE_SERVICE_KEY is missing. Signed URLs will fail.');
}

// Create a Supabase client
const supabase = createClient(
	SUPABASE_URL || '',
	(SUPABASE_PUBLIC_BUCKET ? (SUPABASE_ANON_KEY || '') : (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY || ''))
);

// Helper: build a public object URL when the bucket is public
function buildPublicObjectUrl(path) {
	return `${SUPABASE_URL}/storage/v1/object/public/${encodeURI(SUPABASE_BUCKET)}/${encodeURI(path)}`;
}

// Helper: get a fetchable URL for a given vcf path (public or signed)
async function getFetchableUrlForVcf(path) {
	if (!SUPABASE_URL) {
		throw new Error('Supabase URL not configured');
	}
	if (SUPABASE_PUBLIC_BUCKET) {
		return buildPublicObjectUrl(path);
	}
	// Private bucket: create a short-lived signed URL
	const { data, error } = await supabase
		.storage
		.from(SUPABASE_BUCKET)
		.createSignedUrl(path, 60); // 60 seconds
	if (error) {
		throw error;
	}
	return data.signedUrl;
}

// Middleware to log requests
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - User-Agent: ${req.get('User-Agent')}`);
	next();
});

// --- NEW: Admin Dashboard Route ---
/**
 * Serves the admin dashboard for uploading vCard files.
 * Access it at your base URL followed by /admin
 */
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

/**
 * Dynamic endpoint for NFC tap
 * GET /tap/:cardName
 * Fetches [cardName].vcf from Supabase Storage. Case-sensitive.
 */
app.get('/tap/:cardName', async (req, res) => {
	const cardName = req.params.cardName;
	const objectPath = `${cardName}.vcf`;
	const fileName = `${cardName}_Contact.vcf`;

	try {
		const fetchUrl = await getFetchableUrlForVcf(objectPath);
		console.log(`Fetching vCard from Supabase: ${fetchUrl}`);

		// Stream the file via axios
		const response = await axios({ method: 'get', url: fetchUrl, responseType: 'stream' });

		const userAgent = req.get('User-Agent') || '';

		if (userAgent.includes('iPhone')) {
			console.log(`iPhone detected. Streaming card: ${cardName}`);
			res.setHeader('Content-Type', 'text/vcard');
			response.data.pipe(res);
		} else {
			console.log(`Android/Other detected. Triggering download for card: ${cardName}`);
			res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
			response.data.pipe(res);
		}
	} catch (error) {
		console.error(`Error fetching vCard from Supabase for: ${objectPath}`, error.message || error);
		if (error.isAxiosError && error.response && error.response.status === 404) {
			res.status(404).json({ error: 'Not Found', message: 'The requested contact card does not exist.' });
		} else if (error.message.includes("not found")) { // Catch Supabase specific not found errors
            res.status(404).json({ error: 'Not Found', message: 'The requested contact card does not exist.' });
        }
        else {
			res.status(500).json({ error: 'Internal Server Error', message: 'Could not retrieve the contact card.' });
		}
	}
});

/**
 * Legacy endpoint for backward compatibility
 * GET /tap
 * Uses the demo.vcf file for backward compatibility
 */
app.get('/tap', async (req, res) => {
	const objectPath = 'demo.vcf';
	const fileName = 'Anand_Bhutkar_Contact.vcf';

	try {
		const fetchUrl = await getFetchableUrlForVcf(objectPath);
		console.log(`Fetching vCard from Supabase: ${fetchUrl}`);

		const response = await axios({ method: 'get', url: fetchUrl, responseType: 'stream' });

		const userAgent = req.get('User-Agent') || '';

		if (userAgent.includes('iPhone')) {
			console.log('iPhone detected. Streaming demo card');
			res.setHeader('Content-Type', 'text/vcard');
			response.data.pipe(res);
		} else {
			console.log('Android/Other detected. Triggering download for demo card');
			res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
			response.data.pipe(res);
		}
	} catch (error) {
		console.error(`Error fetching vCard from Supabase for: ${objectPath}`, error.message || error);
		if (error.isAxiosError && error.response && error.response.status === 404) {
			res.status(404).json({ error: 'Not Found', message: 'The requested contact card does not exist.' });
		} else {
			res.status(500).json({ error: 'Internal Server Error', message: 'Could not retrieve the contact card.' });
		}
	}
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
	res.status(200).json({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		service: 'Remote vCard Proxy Service',
		version: '7.0.0'
	});
});

/**
 * Root endpoint - provides basic service information
 */
app.get('/', (req, res) => {
	res.json({
		service: 'Remote vCard Proxy Service',
		version: '7.0.0',
		endpoints: {
            '/admin': 'Admin dashboard for vCard uploads', // Updated
			'/tap/:cardName': 'Dynamic vCard handler for specific contact cards',
			'/tap': 'Legacy endpoint (uses demo.vcf)',
			'/health': 'Health check endpoint'
		},
		description: 'Use /tap/:cardName endpoint for device-optimized vCard handling from Supabase Storage',
		supabase: {
			url: SUPABASE_URL ? `${SUPABASE_URL.substring(0,25)}...` : null,
			bucket: SUPABASE_BUCKET,
			public: SUPABASE_PUBLIC_BUCKET
		}
	});
});

/**
 * Handle 404 errors for undefined routes
 */
app.use((req, res) => {
	res.status(404).json({
		error: 'Not Found',
		message: 'The requested endpoint does not exist',
		availableEndpoints: ['/', '/admin', '/tap/:cardName', '/tap', '/health'] // Updated
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
	console.log('📱 Ready to handle NFC taps from Supabase Storage');
	console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
	console.log(`🪣 Bucket: ${SUPABASE_BUCKET} (public=${SUPABASE_PUBLIC_BUCKET})`);
    console.log('🔑 Admin Dashboard available at /admin'); // Updated
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
