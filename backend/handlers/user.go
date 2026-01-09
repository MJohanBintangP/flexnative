package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend/config"
	"backend/utils"

	"github.com/golang-jwt/jwt/v5"
)

func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	
	claims, err := utils.VerifyToken(tokenStr)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	role, ok := claims["role"].(string)
	if !ok || role != "admin" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	rows, err := config.DB.Query(context.Background(), 
		`SELECT id, email, username, role, 
		COALESCE(progress, 0) as progress, 
		COALESCE(completed_courses, 0) as completed_courses 
		FROM users ORDER BY id`)
	if err != nil {
		http.Error(w, "Gagal mengambil data user", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	var users []map[string]interface{}
	for rows.Next() {
		var id int
		var email, username, role string
		var progress, completed_courses int
		
		err := rows.Scan(&id, &email, &username, &role, &progress, &completed_courses)
		if err != nil {
			log.Printf("Error scanning user row: %v", err)
			continue
		}
		
		users = append(users, map[string]interface{}{
			"id": id, 
			"email": email, 
			"username": username, 
			"role": role,
			"progress": progress,
			"completed_courses": completed_courses,
		})
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func GetUserProfile(w http.ResponseWriter, r *http.Request) {
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

	row := config.DB.QueryRow(context.Background(), 
		`SELECT email, username, 
		COALESCE(progress, 0) as progress, 
		COALESCE(completed_courses, 0) as completed_courses,
		COALESCE(status, 'Pemula React Native') as status
		FROM users WHERE id=$1`, userID)
	
	var email, username, status string
	var progress, completed_courses int
	
	err = row.Scan(&email, &username, &progress, &completed_courses, &status)
	if err != nil {
		log.Printf("Error fetching user profile: %v", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	log.Printf("Returning profile for user ID %d: username=%s, email=%s", userID, username, email)

	log.Printf("User profile for ID %d: progress=%d, completed_courses=%d", 
		userID, progress, completed_courses)

	var totalModules, completedModules int

	err = config.DB.QueryRow(context.Background(), 
		"SELECT COUNT(*) FROM course_modules").Scan(&totalModules)
	
	if err != nil {
		log.Printf("Error counting total modules: %v", err)

	} else {
		log.Printf("Total modules across all courses: %d", totalModules)
	}
	
	err = config.DB.QueryRow(context.Background(), 
		"SELECT COUNT(*) FROM completed_modules WHERE user_id = $1", userID).Scan(&completedModules)
	
	if err != nil {
		log.Printf("Error counting completed modules: %v", err)

	} else {
		log.Printf("Completed modules for user %d: %d", userID, completedModules)
	}
	

	var updatedProgress int
	
	if totalModules > 0 {
		updatedProgress = (completedModules * 100) / totalModules
	}
	
	log.Printf("User %d global progress: %d%% (%d/%d modules completed across all courses)", 
		userID, updatedProgress, completedModules, totalModules)
	
	_, err = config.DB.Exec(context.Background(),
		"UPDATE users SET progress = $1 WHERE id = $2", 
		updatedProgress, userID)
	
	if err != nil {
		log.Printf("Error updating user progress: %v", err)
	} else {
		log.Printf("Updated global progress for user %d to %d%%", userID, updatedProgress)
	}
	
	response := map[string]interface{}{
		"id":                userID,
		"username":          username,
		"email":             email,
		"role":              status,
		"progress":          updatedProgress,
		"completed_courses": completed_courses,
		"status":            status,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func GetUserActivities(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	log.Println("GetUserActivities handler called")

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

	rows, err := config.DB.Query(context.Background(), `
		SELECT id, course_id, title, type, created_at
		FROM user_activities
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 10
	`, userID)

	if err != nil {
		log.Printf("Error querying activities: %v", err)
		http.Error(w, "Failed to fetch activities", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var activities []map[string]interface{}
	for rows.Next() {
		var id, courseID int
		var title, activityType string
		var createdAt time.Time
		
		err := rows.Scan(&id, &courseID, &title, &activityType, &createdAt)
		if err != nil {
			log.Printf("Error scanning activity row: %v", err)
			continue
		}
		
		activities = append(activities, map[string]interface{}{
			"id":       id,
			"courseId": courseID,
			"title":    title,
			"type":     activityType,
			"date":     createdAt.Format(time.RFC3339),
		})
	}

	log.Printf("Found %d activities for user ID: %d", len(activities), userID)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}

func GetRecommendedCourses(w http.ResponseWriter, r *http.Request) {
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


	log.Printf("Fetching recommended courses for user ID: %d", userID)

	today := time.Now().Format("2006-01-02")
	log.Printf("Today's date for course rotation: %s", today)

	dateHash := 0
	for _, char := range today {
		dateHash += int(char)
	}
	
	var totalCourses int
	err = config.DB.QueryRow(context.Background(), "SELECT COUNT(*) FROM courses").Scan(&totalCourses)
	if err != nil {
		log.Printf("Error counting courses: %v", err)
		http.Error(w, "Failed to count courses", http.StatusInternalServerError)
		return
	}
	
	log.Printf("Total courses in database: %d", totalCourses)
	
	if totalCourses == 0 {
		log.Printf("No courses found in database")
		http.Error(w, "No courses available", http.StatusNotFound)
		return
	}
	
	offset := dateHash % totalCourses
	log.Printf("Using offset %d for today's recommendations", offset)
	
	rows, err := config.DB.Query(context.Background(), `
		WITH numbered_courses AS (
			SELECT id, title, description, level, duration, instructor,
				   ROW_NUMBER() OVER (ORDER BY id) as row_num
			FROM courses
		)
		SELECT id, title, description, level, duration, instructor
		FROM numbered_courses
		WHERE row_num > $1
		ORDER BY row_num
		LIMIT 5
	`, offset)
	
	if err != nil {
		log.Printf("Error fetching courses with offset: %v", err)
		
		rows, err = config.DB.Query(context.Background(), `
			SELECT id, title, description, level, duration, instructor
			FROM courses
			LIMIT 5
		`)
		
		if err != nil {
			log.Printf("Error fetching courses with fallback query: %v", err)
			http.Error(w, "Failed to fetch courses", http.StatusInternalServerError)
			return
		}
	}
	defer rows.Close()
	
	var courses []map[string]interface{}
	
	for rows.Next() {
		var id int
		var title, description, level, duration, instructor string
		
		err := rows.Scan(&id, &title, &description, &level, &duration, &instructor)
		if err != nil {
			log.Printf("Error scanning course row: %v", err)
			continue
		}
		
		log.Printf("Found course: ID=%d, Title=%s", id, title)
		
		courses = append(courses, map[string]interface{}{
			"id":          id,
			"title":       title,
			"description": description,
			"level":       level,
			"duration":    duration,
			"instructor":  instructor,
		})
	}
	
	if len(courses) < 5 && totalCourses >= 5 {
		log.Printf("Not enough courses from first query, fetching additional courses from beginning")
		
		additionalRows, err := config.DB.Query(context.Background(), `
			SELECT id, title, description, level, duration, instructor
			FROM courses
			ORDER BY id
			LIMIT $1
		`, 5 - len(courses))
		
		if err != nil {
			log.Printf("Error fetching additional courses: %v", err)
		} else {
			defer additionalRows.Close()
			
			for additionalRows.Next() {
				var id int
				var title, description, level, duration, instructor string
				
				err := additionalRows.Scan(&id, &title, &description, &level, &duration, &instructor)
				if err != nil {
					log.Printf("Error scanning additional course row: %v", err)
					continue
				}
				
				isDuplicate := false
				for _, existingCourse := range courses {
					if existingCourse["id"] == id {
						isDuplicate = true
						break
					}
				}
				
				if !isDuplicate {
					log.Printf("Adding additional course: ID=%d, Title=%s", id, title)
					
					courses = append(courses, map[string]interface{}{
						"id":          id,
						"title":       title,
						"description": description,
						"level":       level,
						"duration":    duration,
						"instructor":  instructor,
					})
					
					if len(courses) >= 5 {
						break
					}
				}
			}
		}
	}
	
	if len(courses) == 0 {
		log.Printf("No courses found after all queries")
		http.Error(w, "No courses available", http.StatusNotFound)
		return
	}

	log.Printf("Returning %d courses from database", len(courses))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(courses)
}

func SyncCompletedCourses(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}
	
	tokenString = strings.Replace(tokenString, "Bearer ", "", 1)
	claims, err := utils.VerifyToken(tokenString)
	if err != nil {
		log.Printf("Invalid token: %v", err)
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}
	
	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		log.Println("Invalid user ID in token claims")
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	userID := int(userIDFloat)
	
	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())
	
	var completedCourses int
	err = tx.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM user_courses 
		WHERE user_id = $1 AND completed = true`,
		userID).Scan(&completedCourses)
	
	if err != nil {
		log.Printf("Error counting completed courses: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	
	log.Printf("User %d has completed %d courses", userID, completedCourses)
	
	_, err = tx.Exec(context.Background(),
		`UPDATE users SET completed_courses = $1
		WHERE id = $2`,
		completedCourses, userID)
	
	if err != nil {
		log.Printf("Error updating completed_courses: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	
	if err := tx.Commit(context.Background()); err != nil {
		log.Printf("Error committing transaction: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	
	log.Printf("Successfully updated completed_courses for user %d to %d", userID, completedCourses)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"completed_courses": completedCourses,
	})
}

func SyncUserProgress(w http.ResponseWriter, r *http.Request) {

	tokenString := r.Header.Get("Authorization")
	if tokenString == "" || !strings.HasPrefix(tokenString, "Bearer ") {
		http.Error(w, "Authorization token required", http.StatusUnauthorized)
		return
	}
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")
	
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	
	if err != nil {
		log.Printf("Error parsing token: %v", err)
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}
	
	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		log.Println("Invalid user ID in token claims")
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	userID := int(userIDFloat)

	var totalModules, completedModules int

	err = config.DB.QueryRow(context.Background(), 
		"SELECT COUNT(*) FROM course_modules").Scan(&totalModules)
	
	if err != nil {
		log.Printf("Error counting total modules: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	err = config.DB.QueryRow(context.Background(), 
		"SELECT COUNT(*) FROM completed_modules WHERE user_id = $1", userID).Scan(&completedModules)
	
	if err != nil {
		log.Printf("Error counting completed modules: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	var globalProgress int
	
	if totalModules > 0 {
		globalProgress = (completedModules * 100) / totalModules
	}
	
	log.Printf("User %d global progress: %d%% (%d/%d modules completed across all courses)", 
		userID, globalProgress, completedModules, totalModules)

	var completedCourses int
	err = config.DB.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM user_courses 
		WHERE user_id = $1 AND completed = true`,
		userID).Scan(&completedCourses)
	
	if err != nil {
		log.Printf("Error counting completed courses: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	_, err = config.DB.Exec(context.Background(),
		"UPDATE users SET progress = $1, completed_courses = $2 WHERE id = $3", 
		globalProgress, completedCourses, userID)
	
	if err != nil {
		log.Printf("Error updating user progress and completed courses: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	} else {
		log.Printf("Updated global progress for user %d to %d%% and completed courses to %d", 
			userID, globalProgress, completedCourses)
	}
	
	response := map[string]interface{}{
		"progress":          globalProgress,
		"completed_courses": completedCourses,
		"message":           "User progress synchronized successfully",
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func HandleUserOperations(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	
	claims, err := utils.VerifyToken(tokenStr)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	role, ok := claims["role"].(string)
	if !ok || role != "admin" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	urlParts := strings.Split(r.URL.Path, "/")
	if len(urlParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	
	userID, err := strconv.Atoi(urlParts[len(urlParts)-1])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	
	switch r.Method {
	case "PUT":
		var req struct {
			Username string `json:"username"`
		}
		
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		
		_, err = config.DB.Exec(context.Background(),
			"UPDATE users SET username = $1 WHERE id = $2",
			req.Username, userID)
		
		if err != nil {
			log.Printf("Error updating user: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "User updated successfully"})
		
	case "DELETE":
		tx, err := config.DB.Begin(context.Background())
		if err != nil {
			log.Printf("Error starting transaction: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"message": "Database error"})
			return
		}
		defer tx.Rollback(context.Background())
		
		tables := []string{
			"completed_modules",
			"user_courses",
			"user_bookmarks", 
			"user_activities",
		}
		
		for _, table := range tables {
			_, err = tx.Exec(context.Background(), 
				fmt.Sprintf("DELETE FROM %s WHERE user_id = $1", table), 
				userID)
			if err != nil {
				log.Printf("Error deleting from %s: %v", table, err)
		
			}
		}
		
		_, err = tx.Exec(context.Background(),
			"DELETE FROM users WHERE id = $1", userID)
		
		if err != nil {
			log.Printf("Error deleting user: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"message": "Failed to delete user. The user may have associated data."})
			return
		}
		
		if err = tx.Commit(context.Background()); err != nil {
			log.Printf("Error committing transaction: %v", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"message": "Database error"})
			return
		}
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "User deleted successfully"})
		
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
