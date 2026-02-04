#!/bin/bash

echo "🚀 Setting up AI Services..."

# Create .env file
cat > .env << 'EOF'
MONGODB_URI=mongodb://localhost:27017/ai-services
JWT_SECRET=super-secret-jwt-key-change-in-production-12345
OPENAI_API_KEY=sk-your-openai-api-key-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

echo "✅ .env file created"
echo ""
echo "⚠️  IMPORTANT: Edit .env file and add your OPENAI_API_KEY"
echo ""
