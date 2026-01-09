package middleware

import (
	"backend/utils"
	"context"
	"net/http"
	"strings"
)

func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method == "OPTIONS" {
            w.Header().Set("Access-Control-Allow-Origin", "*")
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
            w.WriteHeader(http.StatusOK)
            return
        }

        authHeader := r.Header.Get("Authorization")
        // ...existing code...

        if authHeader == "" {
            // ...existing code...
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        if !strings.HasPrefix(authHeader, "Bearer ") {
            // ...existing code...
            http.Error(w, "Invalid token format", http.StatusUnauthorized)
            return
        }

        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        if tokenString == "" {
            // ...existing code...
            http.Error(w, "Empty token", http.StatusUnauthorized)
            return
        }

        claims, err := utils.VerifyToken(tokenString)
        if err != nil {
            // ...existing code...
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }

        userID, ok := claims["user_id"].(float64)
        if !ok {
            // ...existing code...
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }

        ctx := context.WithValue(r.Context(), "userID", userID)
        
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}