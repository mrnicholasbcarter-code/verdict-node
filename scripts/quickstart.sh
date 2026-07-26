#!/bin/bash
# Verdict Node Quickstart - Clean Environment Demo
# Run from verdict-node directory: ./scripts/quickstart.sh

set -e

echo "🚀 Verdict Node Quickstart - Clean Environment Demo"
echo "=================================================="
echo ""

# Create clean environment
QUICKSTART_DIR="/tmp/verdict-node-quickstart-$(date +%s)"
echo "📁 Creating clean environment: $QUICKSTART_DIR"
rm -rf "$QUICKSTART_DIR"
mkdir -p "$QUICKSTART_DIR"
cd "$QUICKSTART_DIR"

# Initialize npm project
echo "📦 Initializing npm project..."
cat > package.json << 'PKG_EOF'
{
  "name": "verdict-node-quickstart",
  "version": "1.0.0",
  "description": "Verdict Node Quickstart Demo",
  "scripts": {
    "start": "node server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
PKG_EOF

# Install dependencies
echo "📦 Installing @bodanglin/verdict-contracts, @bodanglin/verdict-client, @bodanglin/verdict-node, express..."
npm install @bodanglin/verdict-contracts@0.1.0 @bodanglin/verdict-client@0.1.0 @bodanglin/verdict-node@0.1.0 express --quiet

# Create minimal Express server (CommonJS)
echo "📝 Creating minimal Express server..."
cat > server.js << 'SERVER_EOF'
const express = require('express');
const { createForwarder } = require('@bodanglin/verdict-node');

const app = express();
app.use(express.json());

// Create forwarder middleware
const forwarder = createForwarder({
  baseUrl: 'http://localhost:20132/v1',
  timeoutMs: 30000,
  maxRetries: 3,
  trackUsage: true,
});

app.use('/v1/chat/completions', forwarder.middleware());

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`🚀 Verdict Node Gateway running on http://localhost:${PORT}`);
  console.log(`📡 Forwarding to http://localhost:20132/v1`);
  console.log('');
  console.log('Example usage:');
  console.log(`  curl -X POST http://localhost:${PORT}/v1/chat/completions \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'`);
  console.log('');
  console.log('Press Ctrl+C to stop');
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  server.close(() => process.exit(0));
});
SERVER_EOF

# Run server in background
echo "🚀 Starting server..."
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Test with a request
echo "🧪 Testing with a request..."
RESPONSE=$(curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}' \
  2>&1 || echo "CURL_FAILED")

echo "Response: $RESPONSE"

# Cleanup
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ Node quickstart complete!"
echo "   Environment: $QUICKSTART_DIR"
echo "   To run again: node server.js"
