package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"backend/config"
	"backend/utils"
)

func ToggleBookmark(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)
    if r.Method == "OPTIONS" {
        return
    }

    authHeader := r.Header.Get("Authorization")
    if !strings.HasPrefix(authHeader, "Bearer ") {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    token := strings.TrimPrefix(authHeader, "Bearer ")
    claims, err := utils.VerifyToken(token)
    if err != nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    userIDFloat, ok := claims["user_id"].(float64)
    if !ok {
        http.Error(w, "Invalid user ID", http.StatusBadRequest)
        return
    }
    userID := int(userIDFloat)

    var req struct {
        CourseID int `json:"courseId"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    var exists bool
    err = config.DB.QueryRow(context.Background(),
        "SELECT EXISTS(SELECT 1 FROM user_bookmarks WHERE user_id = $1 AND course_id = $2)",
        userID, req.CourseID).Scan(&exists)
    if err != nil {
        log.Printf("Error checking bookmark existence: %v", err)
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }

    var result struct {
        Message   string `json:"message"`
        Bookmarked bool   `json:"bookmarked"`
    }

    if exists {
        _, err = config.DB.Exec(context.Background(),
            "DELETE FROM user_bookmarks WHERE user_id = $1 AND course_id = $2",
            userID, req.CourseID)
        if err != nil {
            log.Printf("Error removing bookmark: %v", err)
            http.Error(w, "Failed to remove bookmark", http.StatusInternalServerError)
            return
        }
        result.Message = "Bookmark removed"
        result.Bookmarked = false
    } else {
        _, err = config.DB.Exec(context.Background(),
            "INSERT INTO user_bookmarks (user_id, course_id) VALUES ($1, $2)",
            userID, req.CourseID)
        if err != nil {
            log.Printf("Error adding bookmark: %v", err)
            http.Error(w, "Failed to add bookmark", http.StatusInternalServerError)
            return
        }
        result.Message = "Bookmark added"
        result.Bookmarked = true
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func GetBookmarks(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)
    if r.Method == "OPTIONS" {
        return
    }
    
    log.Println("GetBookmarks handler called")
    
    authHeader := r.Header.Get("Authorization")
    if !strings.HasPrefix(authHeader, "Bearer ") {
        log.Println("Unauthorized: No Bearer token")
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    token := strings.TrimPrefix(authHeader, "Bearer ")
    claims, err := utils.VerifyToken(token)
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

    rows, err := config.DB.Query(context.Background(), `
        SELECT c.id, c.title, c.description, c.level, c.duration, c.instructor, c.video_url,
        CASE WHEN uc.user_id IS NOT NULL THEN true ELSE false END as enrolled,
        CASE WHEN uc.completed IS TRUE THEN true ELSE false END as completed
        FROM courses c
        JOIN user_bookmarks b ON c.id = b.course_id
        LEFT JOIN user_courses uc ON c.id = uc.course_id AND uc.user_id = $1
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC
    `, userID)

    if err != nil {
        log.Printf("Error querying bookmarks: %v", err)
        http.Error(w, "Failed to fetch bookmarks", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    var bookmarks []map[string]interface{}
    for rows.Next() {
        var id int
        var title, description, level, duration, instructor, videoUrl string
        var enrolled, completed bool
        
        err := rows.Scan(&id, &title, &description, &level, &duration, &instructor, &videoUrl, &enrolled, &completed)
        if err != nil {
            log.Printf("Error scanning bookmark row: %v", err)
            continue
        }
        
        bookmarks = append(bookmarks, map[string]interface{}{
            "id":          id,
            "title":       title,
            "description": description,
            "level":       level,
            "duration":    duration,
            "instructor":  instructor,
            "videoUrl":    videoUrl,
            "enrolled":    enrolled,
            "completed":   completed,
        })
    }

    log.Printf("Found %d bookmarks for user ID: %d", len(bookmarks), userID)
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(bookmarks)
}


