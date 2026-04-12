#!/bin/bash

# Set environment variables if not already set
export PORT=${PORT:-8080}
export LLAMA_URL=${LLAMA_URL:-"http://localhost:11434"}
export LLAMA_MODEL=${LLAMA_MODEL:-"ai/llama3.2:1B-Q8_0"}
export LOG_LEVEL=${LOG_LEVEL:-"INFO"}

# Print configuration
echo "Starting Hello-GenAI Node.js application"
echo "Port: $PORT"
echo "LLM URL: $LLAMA_URL"
echo "Model: $LLAMA_MODEL"

# Run the application
node app.js
