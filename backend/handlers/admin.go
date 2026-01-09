package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"backend/config"
	"backend/utils"
)

func AdminCourseHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Content-Type", "application/json")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		log.Println("Missing or invalid Authorization header")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Unauthorized: Invalid token format"})
		return
	}
	
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := utils.VerifyToken(tokenStr)
	if err != nil {
		log.Printf("Token verification failed: %v", err)
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Unauthorized: Invalid token"})
		return
	}
	
	role, ok := claims["role"].(string)
	if !ok || role != "admin" {
		log.Printf("User does not have admin role. Role: %v", role)
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"message": "Forbidden: Admin role required"})
		return
	}
	
	switch r.Method {
	case "GET":
		GetCourses(w, r)
	case "POST":
		AddCourse(w, r)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"message": "Method not allowed"})
	}
}

func AddCourse(w http.ResponseWriter, r *http.Request) {
	log.Println("AddCourse handler called")
	
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading request body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Error reading request body"})
		return
	}
	
	log.Printf("Raw request body: %s", string(bodyBytes))
	
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Level       string `json:"level"`
		Duration    string `json:"duration"`
		Instructor  string `json:"instructor"`
		VideoUrl    string `json:"videoUrl"`
		Modules     []struct {
			Title    string `json:"title"`
			Content  string `json:"content"`
			Order    int    `json:"order"`
			VideoUrl string `json:"videoUrl"`
		} `json:"modules"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid request format: " + err.Error()})
		return
	}
	
	log.Printf("Parsed request: %+v", req)
	log.Printf("Number of modules: %d", len(req.Modules))

	if req.Title == "" || req.Description == "" {
		log.Println("Missing required fields")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Title and description are required"})
		return
	}

	var tableExists bool
	err = config.DB.QueryRow(context.Background(), `
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'courses'
		)
	`).Scan(&tableExists)
	
	if err != nil {
		log.Printf("Error checking if courses table exists: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error: " + err.Error()})
		return
	}

	if !tableExists {
		log.Println("Courses table does not exist, creating it")
		_, err = config.DB.Exec(context.Background(), `
			CREATE TABLE courses (
				id SERIAL PRIMARY KEY,
				title VARCHAR(255) NOT NULL,
				description TEXT NOT NULL,
				level VARCHAR(50) DEFAULT 'beginner',
				duration VARCHAR(100),
				instructor VARCHAR(255),
				video_url VARCHAR(255),
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`)
		
		if err != nil {
			log.Printf("Error creating courses table: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"message": "Database error: " + err.Error()})
			return
		}
	}
	
	err = config.DB.QueryRow(context.Background(), `
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'course_modules'
		)
	`).Scan(&tableExists)
	
	if err != nil {
		log.Printf("Error checking if course_modules table exists: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error: " + err.Error()})
		return
	}
	
	if !tableExists {
		log.Println("Course_modules table does not exist, creating it")
		_, err = config.DB.Exec(context.Background(), `
			CREATE TABLE course_modules (
				id SERIAL PRIMARY KEY,
				course_id INTEGER,
				title VARCHAR(255) NOT NULL,
				content TEXT,
				description TEXT,
				video_url VARCHAR(255),
				module_order INTEGER DEFAULT 1,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`)
		
		if err != nil {
			log.Printf("Error creating course_modules table: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"message": "Database error: " + err.Error()})
			return
		}
	}

	var courseID int
	err = config.DB.QueryRow(context.Background(), `
		INSERT INTO courses (title, description, level, duration, instructor, video_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, req.Title, req.Description, req.Level, req.Duration, req.Instructor, req.VideoUrl).Scan(&courseID)
	
	if err != nil {
		log.Printf("Error inserting course: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Failed to create course: " + err.Error()})
		return
	}
	
	log.Printf("Course inserted with ID: %d", courseID)
	
	var moduleErrors []string
	for i, module := range req.Modules {
		if module.Title == "" {
			log.Printf("Skipping empty module at index %d", i)
			continue
		}
		
		log.Printf("Inserting module: %+v", module)
		
		_, err = config.DB.Exec(context.Background(), `
			INSERT INTO course_modules (course_id, title, content, module_order, video_url)
			VALUES ($1, $2, $3, $4, $5)
		`, courseID, module.Title, module.Content, module.Order, module.VideoUrl)
		
		if err != nil {
			log.Printf("Error inserting module: %v", err)
			moduleErrors = append(moduleErrors, fmt.Sprintf("Module %d: %v", i+1, err))
		}
	}
	
	log.Println("Course added successfully")
	
	w.WriteHeader(http.StatusCreated)
	response := map[string]interface{}{
		"message": "Course added successfully",
		"courseId": courseID,
	}
	
	if len(moduleErrors) > 0 {
		response["warnings"] = moduleErrors
	}
	
	json.NewEncoder(w).Encode(response)
}
func AdminCourseByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Content-Type", "application/json")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		log.Println("Missing or invalid Authorization header")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Unauthorized: Invalid token format"})
		return
	}
	
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := utils.VerifyToken(tokenStr)
	if err != nil {
		log.Printf("Token verification failed: %v", err)
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"message": "Unauthorized: Invalid token"})
		return
	}
	
	role, ok := claims["role"].(string)
	if !ok || role != "admin" {
		log.Printf("User does not have admin role. Role: %v", role)
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"message": "Forbidden: Admin role required"})
		return
	}
	
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 4 {
		log.Println("Invalid course ID: path parts less than 4")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid course ID"})
		return
	}
	
	courseIDStr := parts[len(parts)-1]
	courseID, err := strconv.Atoi(courseIDStr)
	if err != nil {
		log.Printf("Invalid course ID: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid course ID"})
		return
	}
	
	log.Printf("Processing request for course ID: %d", courseID)
	
	switch r.Method {
	case "GET":
		getCourseByID(w, r, courseID)
	case "PUT":
		updateCourse(w, r, courseID)
	case "DELETE":
		deleteCourse(w, r, courseID)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"message": "Method not allowed"})
	}
}
func deleteCourse(w http.ResponseWriter, r *http.Request, courseID int) {
	log.Printf("Deleting course with ID: %d", courseID)
	
	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error: " + err.Error()})
		return
	}
	defer tx.Rollback(context.Background())
	
	var exists bool
	err = tx.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM courses WHERE id = $1)", courseID).Scan(&exists)
	if err != nil {
		log.Printf("Error checking if course exists: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error: " + err.Error()})
		return
	}
	
	if !exists {
		log.Printf("Course with ID %d not found", courseID)
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"message": "Course not found"})
		return
	}

	_, err = tx.Exec(context.Background(), "DELETE FROM course_modules WHERE course_id = $1", courseID)
	if err != nil {
		log.Printf("Error deleting course modules: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Failed to delete course modules: " + err.Error()})
		return
	}
	

	_, err = tx.Exec(context.Background(), "DELETE FROM completed_modules WHERE course_id = $1", courseID)
	if err != nil {
		log.Printf("Error deleting completed modules: %v", err)
	}

	_, err = tx.Exec(context.Background(), "DELETE FROM user_courses WHERE course_id = $1", courseID)
	if err != nil {
		log.Printf("Error deleting user courses: %v", err)
	}
	
	_, err = tx.Exec(context.Background(), "DELETE FROM courses WHERE id = $1", courseID)
	if err != nil {
		log.Printf("Error deleting course: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Failed to delete course: " + err.Error()})
		return
	}
	
	if err = tx.Commit(context.Background()); err != nil {
		log.Printf("Error committing transaction: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Database error: " + err.Error()})
		return
	}
	
	log.Printf("Course with ID %d deleted successfully", courseID)
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Course deleted successfully"})
}

func getCourseByID(w http.ResponseWriter, r *http.Request, courseID int) {
	w.WriteHeader(http.StatusNotImplemented)
	json.NewEncoder(w).Encode(map[string]string{"message": "Get course by ID not implemented yet"})
}

func updateCourse(w http.ResponseWriter, r *http.Request, courseID int) {
	w.WriteHeader(http.StatusNotImplemented)
	json.NewEncoder(w).Encode(map[string]string{"message": "Update course not implemented yet"})
}






