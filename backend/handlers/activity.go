package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"backend/config"
	"backend/utils"
)

func RecordActivity(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)
    if r.Method == "OPTIONS" {
        return
    }

    log.Println("RecordActivity handler called")

    authHeader := r.Header.Get("Authorization")
    if !strings.HasPrefix(authHeader, "Bearer ") {
        log.Println("Unauthorized: No Bearer token")
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    tokenString := strings.TrimPrefix(authHeader, "Bearer ")
    
    claims, err := utils.VerifyToken(tokenString)
    if err != nil {
        log.Printf("Unauthorized: Invalid token: %v", err)
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    
    userIDFloat, ok := claims["user_id"].(float64)
    if !ok {
        log.Println("Invalid user ID in token claims")
        http.Error(w, "Invalid user ID", http.StatusBadRequest)
        return
    }
    userID := int(userIDFloat)

    var req struct {
        CourseID int    `json:"courseId"`
        Type     string `json:"type"`
    }

    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        log.Printf("Invalid request body: %v", err)
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    log.Printf("Recording activity for user ID: %d, course ID: %d, type: %s", 
        userID, req.CourseID, req.Type)

    var courseTitle string
    err = config.DB.QueryRow(context.Background(), 
        "SELECT title FROM courses WHERE id = $1", req.CourseID).Scan(&courseTitle)
    
    if err != nil {
        log.Printf("Error getting course title: %v", err)
        http.Error(w, "Failed to record activity", http.StatusInternalServerError)
        return
    }

    var existingActivity bool
    err = config.DB.QueryRow(context.Background(), `
        SELECT EXISTS(
            SELECT 1 FROM user_activities 
            WHERE user_id = $1 
            AND course_id = $2 
            AND type = $3 
            AND created_at > NOW() - INTERVAL '5 minutes'
        )
    `, userID, req.CourseID, req.Type).Scan(&existingActivity)

    if err != nil {
        log.Printf("Error checking existing activity: %v", err)
    }

    if existingActivity {
        log.Printf("Similar activity already exists, updating timestamp")
        _, err = config.DB.Exec(context.Background(), `
            UPDATE user_activities 
            SET created_at = NOW() 
            WHERE user_id = $1 
            AND course_id = $2 
            AND type = $3 
            AND created_at > NOW() - INTERVAL '5 minutes'
            AND id IN (
                SELECT id FROM user_activities
                WHERE user_id = $1 
                AND course_id = $2 
                AND type = $3 
                AND created_at > NOW() - INTERVAL '5 minutes'
                ORDER BY created_at DESC
                LIMIT 1
            )
        `, userID, req.CourseID, req.Type)

        if err != nil {
            log.Printf("Error updating activity timestamp: %v", err)
        }
    } else {
        _, err = config.DB.Exec(context.Background(), `
            INSERT INTO user_activities (user_id, course_id, title, type, created_at)
            VALUES ($1, $2, $3, $4, $5)
        `, userID, req.CourseID, courseTitle, req.Type, time.Now())

        if err != nil {
            log.Printf("Error recording activity: %v", err)
            http.Error(w, "Failed to record activity", http.StatusInternalServerError)
            return
        }
    }

    response := map[string]interface{}{
        "success": true,
        "message": "Activity recorded successfully",
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}




