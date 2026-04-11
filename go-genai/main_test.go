package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

func setupRouter() *mux.Router {
	router := mux.NewRouter()
	router.Use(securityHeadersMiddleware)

	fs := http.FileServer(http.Dir("./static"))
	router.PathPrefix("/static/").Handler(http.StripPrefix("/static/", fs))

	router.HandleFunc("/health", handleHealthCheck).Methods("GET")
	router.HandleFunc("/", handleIndex).Methods("GET")
	router.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("pong"))
	}).Methods("GET")

	return router
}

func TestHealthEndpoint(t *testing.T) {
	router := setupRouter()
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Errorf("response is not valid JSON: %v", err)
	}

	if result["status"] != "healthy" {
		t.Errorf("expected status 'healthy', got '%v'", result["status"])
	}

	if _, ok := result["version"]; !ok {
		t.Error("expected 'version' field in health response")
	}

	if _, ok := result["uptime"]; !ok {
		t.Error("expected 'uptime' field in health response")
	}
}

func TestPingEndpoint(t *testing.T) {
	router := setupRouter()
	req := httptest.NewRequest("GET", "/ping", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	if w.Body.String() != "pong" {
		t.Errorf("expected 'pong', got '%s'", w.Body.String())
	}
}

func TestMainPage(t *testing.T) {
	router := setupRouter()
	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	if ct := w.Header().Get("Content-Type"); ct == "" {
		t.Error("expected Content-Type header")
	}
}

func TestSecurityHeaders(t *testing.T) {
	router := setupRouter()
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	headers := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":       "SAMEORIGIN",
		"X-Xss-Protection":      "1; mode=block",
	}

	for name, expected := range headers {
		if got := w.Header().Get(name); got != expected {
			t.Errorf("expected header %s='%s', got '%s'", name, expected, got)
		}
	}

	if csp := w.Header().Get("Content-Security-Policy"); csp == "" {
		t.Error("expected Content-Security-Policy header")
	}
}

func TestStaticFavicon(t *testing.T) {
	router := setupRouter()
	req := httptest.NewRequest("GET", "/static/favicon.ico", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 for favicon, got %d", w.Code)
	}
}

func TestStaticRobots(t *testing.T) {
	router := setupRouter()
	req := httptest.NewRequest("GET", "/static/robots.txt", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 for robots.txt, got %d", w.Code)
	}
}

func TestStaticCSS(t *testing.T) {
	router := setupRouter()
	req := httptest.NewRequest("GET", "/static/css/style.css", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 for style.css, got %d", w.Code)
	}
}

func TestStaticSwaggerJSON(t *testing.T) {
	router := setupRouter()
	req := httptest.NewRequest("GET", "/static/swagger.json", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 for swagger.json, got %d", w.Code)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Errorf("swagger.json is not valid JSON: %v", err)
	}
}

func TestInputValidation(t *testing.T) {
	_, msg := validateChatRequest(map[string]interface{}{})
	if msg != "Message is required and must be a string" {
		t.Errorf("expected validation error for missing message, got: %s", msg)
	}

	longMsg := make([]byte, 4001)
	for i := range longMsg {
		longMsg[i] = 'a'
	}
	valid, _ := validateChatRequest(map[string]interface{}{"message": string(longMsg)})
	if valid {
		t.Error("expected validation to fail for message > 4000 chars")
	}
}
