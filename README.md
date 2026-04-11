# hello-genai

A simple chatbot web application built in Go, Python, Node.js, and Rust that connects to a local LLM service to provide AI-powered responses.

## Environment Variables

The application uses the following environment variables (injected by Docker Model Runner):

- `LLAMA_URL`: The base URL of the LLM API
- `LLAMA_MODEL`: The model name to use

These are automatically configured when using Docker Compose with the `models` directive.

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/docker/hello-genai
   cd hello-genai
   ```

2. Start the application using Docker Compose:
   ```bash
   docker compose up
   ```

3. Open your browser and visit the following links:

   http://localhost:8080 for the GenAI Application in Go

   http://localhost:8081 for the GenAI Application in Python

   http://localhost:8082 for the GenAI Application in Node.js

   http://localhost:8083 for the GenAI Application in Rust

## Requirements

- macOS (recent version)
- Docker and Docker Compose

See `.env.example` for sample environment variable configuration.
