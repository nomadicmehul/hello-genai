document.addEventListener('DOMContentLoaded', function() {
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const modelNameSpan = document.getElementById('model-name');
    const modelNameFooter = document.getElementById('model-name-footer');
    const themeToggle = document.getElementById('theme-toggle');
    const clearChatButton = document.getElementById('clear-chat');
    const suggestions = document.querySelectorAll('.suggestion');

    let isRequestInProgress = false;

    // Check for saved theme preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '🔆';
    }

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        sendButton.disabled = this.value.trim() === '';
    });

    // Theme toggle
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        themeToggle.textContent = isDarkMode ? '🔆' : '🌙';
    });

    // Clear chat history
    if (clearChatButton) {
        clearChatButton.addEventListener('click', function() {
            while (chatBox.childNodes.length > 2) {
                chatBox.removeChild(chatBox.lastChild);
            }

            if (!document.querySelector('.suggestions')) {
                const suggestionsDiv = document.createElement('div');
                suggestionsDiv.className = 'suggestions';
                suggestionsDiv.innerHTML = `
                    <div class="suggestion">What can you do?</div>
                    <div class="suggestion">Tell me about Docker</div>
                    <div class="suggestion">How to use GenAI?</div>
                    <div class="suggestion" id="show-example">Show structured example</div>
                `;
                chatBox.appendChild(suggestionsDiv);

                document.querySelectorAll('.suggestion').forEach(suggestion => {
                    suggestion.addEventListener('click', function() {
                        if (this.id === 'show-example') {
                            showStructuredExample();
                        } else {
                            messageInput.value = this.textContent;
                            messageInput.dispatchEvent(new Event('input'));
                            sendMessage();
                        }
                    });
                });
            }
        });
    }

    // Get model info
    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '!modelinfo' }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.model) {
            modelNameSpan.textContent = data.model;
            if (modelNameFooter) modelNameFooter.textContent = data.model;
        } else {
            modelNameSpan.textContent = 'AI Language Model';
        }
    })
    .catch(() => {
        modelNameSpan.textContent = 'AI Language Model';
    });

    function formatResponse(text) {
        text = text.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        text = text.replace(/^# (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.+)$/gm, '<h4>$1</h4>');
        text = text.replace(/^### (.+)$/gm, '<h5>$1</h5>');
        text = text.replace(/^- (.+)$/gm, '<li>$1</li>');
        text = text.replace(/(<li>.+<\/li>\n)+/g, '<ul>$&</ul>');
        text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        text = text.replace(/(<li>.+<\/li>\n)+/g, '<ol>$&</ol>');
        text = text.replace(/^([^<\n].+)$/gm, '<p>$1</p>');
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        text = text.replace(/\n/g, '');
        return text;
    }

    function getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message || isRequestInProgress) return;

        isRequestInProgress = true;

        const suggestionsDiv = document.querySelector('.suggestions');
        if (suggestionsDiv) chatBox.removeChild(suggestionsDiv);

        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message-container';
        userMessageDiv.innerHTML = `
            <div class="message-content" style="margin-left: auto;">
                <div class="user-message">${escapeHTML(message)}</div>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        `;
        chatBox.appendChild(userMessageDiv);

        messageInput.value = '';
        messageInput.style.height = '50px';
        sendButton.disabled = true;

        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'message-container';
        loadingContainer.innerHTML = `
            <div class="bot-icon">🤖</div>
            <div class="loading">
                <span>Thinking</span>
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        chatBox.appendChild(loadingContainer);
        chatBox.scrollTop = chatBox.scrollHeight;

        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            chatBox.removeChild(loadingContainer);

            const botMessageDiv = document.createElement('div');
            botMessageDiv.className = 'message-container';

            if (data.error) {
                botMessageDiv.innerHTML = `
                    <div class="bot-icon">🤖</div>
                    <div class="message-content">
                        <div class="bot-message">Sorry, I encountered an error: ${escapeHTML(data.error)}</div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                `;
            } else {
                const formattedResponse = formatResponse(data.response);
                botMessageDiv.innerHTML = `
                    <div class="bot-icon">🤖</div>
                    <div class="message-content">
                        <div class="bot-message">${formattedResponse}</div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                `;
            }

            chatBox.appendChild(botMessageDiv);
            chatBox.scrollTop = chatBox.scrollHeight;
        })
        .catch(error => {
            chatBox.removeChild(loadingContainer);

            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.className = 'message-container';
            errorMessageDiv.innerHTML = `
                <div class="bot-icon">🤖</div>
                <div class="message-content">
                    <div class="bot-message">Sorry, I encountered an error. Please try again.</div>
                    <div class="message-time">${getCurrentTime()}</div>
                </div>
            `;
            chatBox.appendChild(errorMessageDiv);
            console.error('Error:', error);
        })
        .finally(() => {
            isRequestInProgress = false;
        });
    }

    function showStructuredExample() {
        const suggestionsDiv = document.querySelector('.suggestions');
        if (suggestionsDiv) chatBox.removeChild(suggestionsDiv);

        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message-container';
        userMessageDiv.innerHTML = `
            <div class="message-content" style="margin-left: auto;">
                <div class="user-message">Show me an example of structured formatting</div>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        `;
        chatBox.appendChild(userMessageDiv);

        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'message-container';
        loadingContainer.innerHTML = `
            <div class="bot-icon">🤖</div>
            <div class="loading">
                <span>Loading example</span>
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        chatBox.appendChild(loadingContainer);
        chatBox.scrollTop = chatBox.scrollHeight;

        fetch('/example')
            .then(response => response.json())
            .then(data => {
                chatBox.removeChild(loadingContainer);

                const botMessageDiv = document.createElement('div');
                botMessageDiv.className = 'message-container';
                const formattedResponse = formatResponse(data.response);
                botMessageDiv.innerHTML = `
                    <div class="bot-icon">🤖</div>
                    <div class="message-content">
                        <div class="bot-message">${formattedResponse}</div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                `;
                chatBox.appendChild(botMessageDiv);
                chatBox.scrollTop = chatBox.scrollHeight;
            })
            .catch(error => {
                chatBox.removeChild(loadingContainer);

                const errorMessageDiv = document.createElement('div');
                errorMessageDiv.className = 'message-container';
                errorMessageDiv.innerHTML = `
                    <div class="bot-icon">🤖</div>
                    <div class="message-content">
                        <div class="bot-message">Sorry, I encountered an error loading the example.</div>
                        <div class="message-time">${getCurrentTime()}</div>
                    </div>
                `;
                chatBox.appendChild(errorMessageDiv);
                console.error('Error:', error);
            });
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    suggestions.forEach(suggestion => {
        suggestion.addEventListener('click', function() {
            if (this.id === 'show-example') {
                showStructuredExample();
            } else {
                messageInput.value = this.textContent;
                messageInput.dispatchEvent(new Event('input'));
                sendMessage();
            }
        });
    });
});
