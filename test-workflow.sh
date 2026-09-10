#!/bin/bash

# Test script for real agentic workflows

echo "🧪 Testing Real Agentic Workflows Setup"
echo "========================================"
echo ""

# Check if orchestrator is built
echo "1. Checking orchestrator build..."
if [ -f "dist/orchestrator/index.js" ]; then
    echo "   ✅ Orchestrator built successfully"
else
    echo "   ❌ Orchestrator not found. Running build..."
    npm run build:orchestrator
fi
echo ""

# Check database schema file
echo "2. Checking database schema..."
if [ -f "src/db/schema.sql" ]; then
    echo "   ✅ Database schema exists"
else
    echo "   ❌ Database schema not found"
fi
echo ""

# Check key files
echo "3. Checking key implementation files..."
files=(
    "src/screens/Workspace.tsx"
    "src/orchestrator/index.ts"
    "orchestrator-sidecar.js"
    "src/components/ui/bolt-style-chat.tsx"
    "src-tauri/src/main.rs"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file missing"
    fi
done
echo ""

# Check Rust dependencies
echo "4. Checking Rust dependencies..."
if grep -q "rusqlite" "src-tauri/Cargo.toml"; then
    echo "   ✅ rusqlite dependency added"
else
    echo "   ❌ rusqlite dependency missing"
fi
echo ""

# Check Node dependencies
echo "5. Checking Node dependencies..."
deps=("better-sqlite3" "@anthropic-ai/sdk" "p-queue" "playwright")
for dep in "${deps[@]}"; do
    if grep -q "\"$dep\"" "package.json"; then
        echo "   ✅ $dep"
    else
        echo "   ❌ $dep missing"
    fi
done
echo ""

echo "✅ Setup verification complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Set environment variables (optional):"
echo "      export ANTHROPIC_API_KEY='your-key'"
echo "      export COMPOSIO_API_KEY='your-key'"
echo "   2. Run development server: npm run dev"
echo "   3. Or build app: npm run tauri build"
echo "   4. Send a message in the workspace to test the flow"
echo ""
echo "📖 See REAL_WORKFLOWS_IMPLEMENTATION.md for detailed documentation"
