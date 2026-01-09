package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v4"

	"backend/config"
	"backend/utils"
)

func GetCourses(w http.ResponseWriter, r *http.Request) {
	log.Println("GetCourses handler called")
	
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	authHeader := r.Header.Get("Authorization")
	log.Printf("Authorization header: %s", authHeader)
	
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
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	log.Printf("Fetching courses for user ID: %v", userID)

	var columnCount int
	err = config.DB.QueryRow(context.Background(), 
		"SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'courses'").Scan(&columnCount)
	if err != nil {
		log.Printf("Error checking courses table structure: %v", err)
	} else {
		log.Printf("Courses table has %d columns", columnCount)
	}

	log.Println("Executing SQL query to fetch courses")
	
	rows, err := config.DB.Query(context.Background(), `
		SELECT 
			c.id, 
			c.title, 
			c.description, 
			c.level, 
			c.duration, 
			c.instructor, 
			COALESCE(c.video_url, '') as video_url,
			CASE WHEN uc.user_id IS NOT NULL THEN true ELSE false END as enrolled,
			CASE WHEN b.user_id IS NOT NULL THEN true ELSE false END as bookmarked,
			CASE WHEN uc.completed IS TRUE THEN true ELSE false END as completed
		FROM courses c
		LEFT JOIN user_courses uc ON c.id = uc.course_id AND uc.user_id = $1
		LEFT JOIN user_bookmarks b ON c.id = b.course_id AND b.user_id = $1
		ORDER BY c.id
	`, userID)

	if err != nil {
		log.Printf("Error querying courses: %v", err)
		http.Error(w, "Failed to fetch courses", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	colTypes := rows.FieldDescriptions()
	log.Printf("Query returns %d columns", len(colTypes))
	for i, col := range colTypes {
		log.Printf("Column %d: %s", i, string(col.Name))
	}

	var courses []map[string]interface{}
	for rows.Next() {
		var id int
		var title, description, level, duration, instructor string
		var videoUrl sql.NullString
		var enrolled, bookmarked, completed bool

		err := rows.Scan(&id, &title, &description, &level, &duration, &instructor, &videoUrl, &enrolled, &bookmarked, &completed)
		if err != nil {
			log.Printf("Error scanning course row: %v", err)
			continue
		}

		videoUrlValue := ""
		if videoUrl.Valid {
			videoUrlValue = videoUrl.String
		}

		courses = append(courses, map[string]interface{}{
			"id":          id,
			"title":       title,
			"description": description,
			"level":       level,
			"duration":    duration,
			"instructor":  instructor,
			"videoUrl":    videoUrlValue,
			"enrolled":    enrolled,
			"bookmarked":  bookmarked,
			"completed":   completed,
		})
	}

	log.Printf("Found %d courses", len(courses))
	
	if len(courses) == 0 {
		var count int
		err = config.DB.QueryRow(context.Background(), "SELECT COUNT(*) FROM courses").Scan(&count)
		if err != nil {
			log.Printf("Error checking courses count: %v", err)
		} else {
			log.Printf("Total courses in database: %d", count)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(courses)
}

func SearchCourses(w http.ResponseWriter, r *http.Request) {
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

	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}


	rows, err := config.DB.Query(context.Background(), `
		SELECT c.id, c.title, c.level,
		CASE WHEN uc.user_id IS NOT NULL THEN true ELSE false END as enrolled,
		CASE WHEN b.user_id IS NOT NULL THEN true ELSE false END as bookmarked
		FROM courses c
		LEFT JOIN user_courses uc ON c.id = uc.course_id AND uc.user_id = $4
		LEFT JOIN user_bookmarks b ON c.id = b.course_id AND b.user_id = $4
		WHERE c.title ILIKE $1 OR c.description ILIKE $1
		ORDER BY 
			CASE WHEN c.title ILIKE $2 THEN 0 ELSE 1 END,
			CASE WHEN c.title ILIKE $3 THEN 0 ELSE 1 END,
			c.title
		LIMIT 5
	`, "%"+query+"%", query+"%", "%"+query+"%", userID)

	if err != nil {
		log.Printf("Error searching courses: %v", err)
		http.Error(w, "Failed to search courses", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var courses []map[string]interface{}
	for rows.Next() {
		var id int
		var title, level string
		var enrolled, bookmarked bool

		err := rows.Scan(&id, &title, &level, &enrolled, &bookmarked)
		if err != nil {
			log.Printf("Error scanning course row: %v", err)
			continue
		}

		courses = append(courses, map[string]interface{}{
			"id":        id,
			"title":     title,
			"level":     level,
			"enrolled":  enrolled,
			"bookmarked": bookmarked,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(courses)
}

func GetCourseById(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Println("GetCourseById handler called")

	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 4 {
		log.Println("Invalid course ID: path parts less than 4")
		http.Error(w, "Invalid course ID", http.StatusBadRequest)
		return
	}
	courseIDStr := parts[3]
	courseID, err := strconv.Atoi(courseIDStr)
	if err != nil {
		log.Printf("Invalid course ID: %v", err)
		http.Error(w, "Invalid course ID", http.StatusBadRequest)
		return
	}

	authHeader := r.Header.Get("Authorization")
	log.Printf("Authorization header: %s", authHeader)
	
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
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	log.Printf("Fetching course details for user ID: %d, course ID: %d", userID, courseID)

	var course struct {
		ID          int    `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Level       string `json:"level"`
		Duration    string `json:"duration"`
		Instructor  string `json:"instructor"`
		VideoUrl    string `json:"videoUrl"`
		Enrolled    bool   `json:"enrolled"`
		Bookmarked  bool   `json:"bookmarked"`
		Completed   bool   `json:"completed"`
	}

	err = config.DB.QueryRow(context.Background(), `
		SELECT c.id, c.title, c.description, c.level, c.duration, c.instructor, c.video_url,
		CASE WHEN uc.user_id IS NOT NULL THEN true ELSE false END as enrolled,
		CASE WHEN b.user_id IS NOT NULL THEN true ELSE false END as bookmarked,
		CASE WHEN uc.completed IS TRUE THEN true ELSE false END as completed
		FROM courses c
		LEFT JOIN user_courses uc ON c.id = uc.course_id AND uc.user_id = $1
		LEFT JOIN user_bookmarks b ON c.id = b.course_id AND b.user_id = $1
		WHERE c.id = $2
	`, userID, courseID).Scan(
		&course.ID, &course.Title, &course.Description, &course.Level, 
		&course.Duration, &course.Instructor, &course.VideoUrl,
		&course.Enrolled, &course.Bookmarked, &course.Completed,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("Course not found: ID=%d", courseID)
			http.Error(w, "Course not found", http.StatusNotFound)
		} else {
			log.Printf("Error scanning course row: %v", err)
			http.Error(w, "Failed to fetch course", http.StatusInternalServerError)
		}
		return
	}

	var moduleTableExists bool
	err = config.DB.QueryRow(context.Background(), 
		"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'course_modules')").Scan(&moduleTableExists)
	
	if err != nil {
		log.Printf("Error checking if course_modules table exists: %v", err)
	} else {
		log.Printf("course_modules table exists: %v", moduleTableExists)
		
		if moduleTableExists {
			var moduleCount int
			err = config.DB.QueryRow(context.Background(), 
				"SELECT COUNT(*) FROM course_modules WHERE course_id = $1", courseID).Scan(&moduleCount)
			
			if err != nil {
				log.Printf("Error counting modules for course %d: %v", courseID, err)
			} else {
				log.Printf("Found %d modules in database for course %d", moduleCount, courseID)
			}
		}
	}

	rows, err := config.DB.Query(context.Background(), `
		SELECT id, title, description, content, video_url
		FROM course_modules 
		WHERE course_id = $1
		ORDER BY id
	`, courseID)

	if err != nil {
		log.Printf("Error querying modules: %v", err)

	}

	modules := []map[string]interface{}{}
	
	if rows != nil {
		defer rows.Close()
		
		for rows.Next() {
			var moduleID int
			var moduleTitle, moduleDescription, moduleContent string
			var moduleVideoUrl sql.NullString

			err := rows.Scan(&moduleID, &moduleTitle, &moduleDescription, &moduleContent, &moduleVideoUrl)
			if err != nil {
				log.Printf("Error scanning module row: %v", err)
				continue
			}

			videoUrl := ""
			if moduleVideoUrl.Valid {
				videoUrl = moduleVideoUrl.String
			}

			var completed bool
			err = config.DB.QueryRow(context.Background(), `
				SELECT EXISTS(
					SELECT 1 FROM completed_modules 
					WHERE module_id = $1 AND user_id = $2 AND course_id = $3
				)
			`, moduleID, userID, courseID).Scan(&completed)
			
			if err != nil {
				log.Printf("Error checking if module %d is completed: %v", moduleID, err)
				completed = false
			}

			modules = append(modules, map[string]interface{}{
				"id":          moduleID,
				"title":       moduleTitle,
				"description": moduleDescription,
				"content":     moduleContent,
				"videoUrl":    videoUrl,
				"completed":   completed,
			})
			
			log.Printf("Added module: ID=%d, Title=%s, Completed=%v", 
				moduleID, moduleTitle, completed)
		}
	}

	log.Printf("Found %d modules for course ID=%d", len(modules), courseID)
	
	if len(modules) == 0 {
		log.Printf("No modules found for course ID=%d, creating default modules", courseID)
		
		defaultModules := getDefaultModules(course.Level, course.Title)

		for _, module := range defaultModules {
			var moduleID int

			err := config.DB.QueryRow(context.Background(), `
				INSERT INTO course_modules (course_id, title, description, content, video_url)
				VALUES ($1, $2, $3, $4, $5)
				RETURNING id
			`, courseID, module.Title, module.Description, module.Content, module.VideoUrl).Scan(&moduleID)
			
			if err != nil {
				log.Printf("Error inserting default module: %v", err)

				_, err = config.DB.Exec(context.Background(), `
					INSERT INTO course_modules (course_id, title, description, content, video_url)
					VALUES ($1, $2, $3, $4, $5)
				`, courseID, module.Title, module.Description, module.Content, module.VideoUrl)
				
				if err != nil {
					log.Printf("Alternative insert also failed: %v", err)
					continue
				}

				moduleID = module.ID
			}
			
			log.Printf("Created default module: ID=%d, Title=%s", moduleID, module.Title)
			
	
			modules = append(modules, map[string]interface{}{
				"id":          moduleID,
				"title":       module.Title,
				"description": module.Description,
				"content":     module.Content,
				"videoUrl":    module.VideoUrl,
				"completed":   false,
			})
		}
		
		log.Printf("Created and inserted %d default modules for course ID=%d", len(defaultModules), courseID)
	}

	response := map[string]interface{}{
		"id":          course.ID,
		"title":       course.Title,
		"description": course.Description,
		"level":       course.Level,
		"duration":    course.Duration,
		"instructor":  course.Instructor,
		"videoUrl":    course.VideoUrl,
		"enrolled":    course.Enrolled,
		"bookmarked":  course.Bookmarked,
		"completed":   course.Completed,
		"modules":     modules,
	}

	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func UpdateProgress(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	
	log.Println("UpdateProgress handler called")
	
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

	var req struct {
		CourseID  int  `json:"courseId"`
		ModuleID  int  `json:"moduleId"`
		Completed bool `json:"completed"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("Updating progress for user ID: %d, course ID: %d, module ID: %d, completed: %v", 
		userID, req.CourseID, req.ModuleID, req.Completed)

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	var enrolled bool
	err = tx.QueryRow(context.Background(),
		"SELECT EXISTS(SELECT 1 FROM user_courses WHERE user_id = $1 AND course_id = $2)",
		userID, req.CourseID).Scan(&enrolled)
	
	if err != nil {
		log.Printf("Error checking enrollment: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if !enrolled {
		log.Printf("User %d not enrolled in course %d, enrolling now", userID, req.CourseID)
		_, err = tx.Exec(context.Background(),
			"INSERT INTO user_courses (user_id, course_id) VALUES ($1, $2)",
			userID, req.CourseID)
		
		if err != nil {
			log.Printf("Error enrolling user: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	}

	var moduleExists bool
	err = tx.QueryRow(context.Background(),
		"SELECT EXISTS(SELECT 1 FROM course_modules WHERE id = $1 AND course_id = $2)",
		req.ModuleID, req.CourseID).Scan(&moduleExists)

	if err != nil {
		log.Printf("Error checking if module exists: %v", err)
		tx.Rollback(context.Background())
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if !moduleExists {
		log.Printf("Module %d does not exist for course %d", req.ModuleID, req.CourseID)

		_, err = tx.Exec(context.Background(),
			`INSERT INTO course_modules (id, course_id, title, description, content)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT DO NOTHING`,
			req.ModuleID, req.CourseID, 
			fmt.Sprintf("Module %d", req.ModuleID),
			"Auto-generated module",
			"<p>This module was automatically generated.</p>")
		
		if err != nil {
			log.Printf("Error creating missing module: %v", err)
			tx.Rollback(context.Background())
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		
		log.Printf("Created missing module %d for course %d", req.ModuleID, req.CourseID)
	}

	if req.Completed {
		log.Printf("Marking module %d as completed for user %d", req.ModuleID, userID)
		_, err = tx.Exec(context.Background(),
			`INSERT INTO completed_modules (user_id, course_id, module_id, completed_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (user_id, module_id) DO NOTHING`,
			userID, req.CourseID, req.ModuleID)
		
		if err != nil {
			log.Printf("Error marking module as completed: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	} else {
		log.Printf("Unmarking module %d as completed for user %d", req.ModuleID, userID)
		_, err = tx.Exec(context.Background(),
			"DELETE FROM completed_modules WHERE user_id = $1 AND module_id = $2",
			userID, req.ModuleID)
		
		if err != nil {
			log.Printf("Error unmarking module: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	}

	var totalModulesInCourse, completedModulesInCourse int
	err = tx.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM course_modules WHERE course_id = $1",
		req.CourseID).Scan(&totalModulesInCourse)
	
	if err != nil {
		log.Printf("Error counting modules in course: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	err = tx.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM completed_modules 
		WHERE user_id = $1 AND course_id = $2`,
		userID, req.CourseID).Scan(&completedModulesInCourse)
	
	if err != nil {
		log.Printf("Error counting completed modules in course: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	var courseCompleted bool = false
	if totalModulesInCourse > 0 && completedModulesInCourse >= totalModulesInCourse {
		courseCompleted = true

		_, err = tx.Exec(context.Background(),
			`UPDATE user_courses SET completed = true, completed_at = NOW()
			WHERE user_id = $1 AND course_id = $2 AND completed = false`,
			userID, req.CourseID)
		
		if err != nil {
			log.Printf("Error updating course completion status: %v", err)
		} else {
			log.Printf("Course %d marked as completed for user %d", req.CourseID, userID)
		}
	}

	var totalModules, completedModules int
	err = tx.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM course_modules`).Scan(&totalModules)
	
	if err != nil {
		log.Printf("Error counting all modules: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	err = tx.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM completed_modules WHERE user_id = $1`,
		userID).Scan(&completedModules)
	
	if err != nil {
		log.Printf("Error counting all completed modules: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	var completedCourses int
	err = tx.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM user_courses 
		WHERE user_id = $1 AND completed = true`,
		userID).Scan(&completedCourses)
	
	if err != nil {
		log.Printf("Error counting completed courses: %v", err)
	}

	var progress int
	if totalModules > 0 {
		progress = (completedModules * 100) / totalModules
	}

	log.Printf("Global progress for user %d: %d%% (%d/%d modules completed across all courses)", 
		userID, progress, completedModules, totalModules)
	log.Printf("Completed courses for user %d: %d", userID, completedCourses)

	_, err = tx.Exec(context.Background(),
		`UPDATE users SET completed_courses = $1
		WHERE id = $2`,
		completedCourses, userID)

	if err != nil {
		log.Printf("Error updating completed_courses: %v", err)
	} else {
		log.Printf("Updated completed_courses for user %d to %d", userID, completedCourses)
	}

	_, err = tx.Exec(context.Background(),
		`UPDATE users SET progress = $1 WHERE id = $2`,
		progress, userID)

	if err != nil {
		log.Printf("Error updating user progress: %v", err)
	} else {
		log.Printf("Updated progress for user %d to %d%%", userID, progress)
	}

	if err := tx.Commit(context.Background()); err != nil {
		log.Printf("Error committing transaction: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success":          true,
		"courseCompleted":  courseCompleted,
		"completedCourses": completedCourses,
		"progress":         progress,
		"message":          "Progress updated successfully",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func GetJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
	}
	return []byte(secret)
}

func CleanupDuplicateModules(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	rows, err := config.DB.Query(context.Background(), 
		"SELECT DISTINCT course_id FROM course_modules")
	if err != nil {
		log.Printf("Error querying course IDs: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	var courseIDs []int
	for rows.Next() {
		var courseID int
		if err := rows.Scan(&courseID); err != nil {
			log.Printf("Error scanning course ID: %v", err)
			continue
		}
		courseIDs = append(courseIDs, courseID)
	}
	
	for _, courseID := range courseIDs {
		moduleRows, err := config.DB.Query(context.Background(), 
			"SELECT MIN(id) as id, title FROM course_modules WHERE course_id = $1 GROUP BY title", 
			courseID)
		if err != nil {
			log.Printf("Error querying modules for course %d: %v", courseID, err)
			continue
		}
		
		var moduleIDs []int
		for moduleRows.Next() {
			var moduleID int
			var title string
			if err := moduleRows.Scan(&moduleID, &title); err != nil {
				log.Printf("Error scanning module: %v", err)
				continue
			}
			moduleIDs = append(moduleIDs, moduleID)
		}
		moduleRows.Close()
		
		if len(moduleIDs) > 0 {
			query := fmt.Sprintf("DELETE FROM course_modules WHERE course_id = $1 AND id NOT IN (%s)", 
				joinInts(moduleIDs))
			_, err := config.DB.Exec(context.Background(), query, courseID)
			if err != nil {
				log.Printf("Error deleting duplicate modules for course %d: %v", courseID, err)
			} else {
				log.Printf("Cleaned up duplicate modules for course %d", courseID)
			}
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func joinInts(ids []int) string {
    strIDs := make([]string, len(ids))
    for i, id := range ids {
        strIDs[i] = strconv.Itoa(id)
    }
    return strings.Join(strIDs, ",")
}

func getDefaultModules(level string, courseTitle string) []struct {
	ID          int
	Title       string
	Description string
	Content     string
	VideoUrl    string
} {
	type Module struct {
		ID          int
		Title       string
		Description string
		Content     string
		VideoUrl    string
	}
	
	var modules []Module
	
	switch strings.ToLower(level) {
	case "beginner", "pemula":
		modules = []Module{
			{
				ID:          1,
				Title:       "Pengenalan " + courseTitle,
				Description: "Modul pengenalan untuk kursus " + courseTitle,
				Content:     "<h2>Pengenalan</h2><p>Selamat datang di kursus " + courseTitle + ". Modul ini akan memperkenalkan Anda pada konsep dasar.</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
			{
				ID:          2,
				Title:       "Dasar-dasar " + courseTitle,
				Description: "Mempelajari dasar-dasar " + courseTitle,
				Content:     "<h2>Dasar-dasar</h2><p>Pada modul ini, Anda akan mempelajari konsep dasar dari " + courseTitle + ".</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
			{
				ID:          3,
				Title:       "Praktik " + courseTitle,
				Description: "Praktik dasar " + courseTitle,
				Content:     "<h2>Praktik</h2><p>Mari kita praktikkan apa yang telah dipelajari.</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
		}
	case "intermediate", "menengah":
		modules = []Module{
			{
				ID:          1,
				Title:       "Pengenalan Lanjutan " + courseTitle,
				Description: "Modul pengenalan lanjutan untuk kursus " + courseTitle,
				Content:     "<h2>Pengenalan Lanjutan</h2><p>Selamat datang di kursus lanjutan " + courseTitle + ".</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
			{
				ID:          2,
				Title:       "Teknik Menengah",
				Description: "Mempelajari teknik menengah dalam " + courseTitle,
				Content:     "<h2>Teknik Menengah</h2><p>Pada modul ini, Anda akan mempelajari teknik menengah dalam " + courseTitle + ".</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
			{
				ID:          3,
				Title:       "Proyek Menengah",
				Description: "Membuat proyek menengah dengan " + courseTitle,
				Content:     "<h2>Proyek Menengah</h2><p>Mari kita buat proyek menengah dengan " + courseTitle + ".</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
		}
	default:
		modules = []Module{
			{
				ID:          1,
				Title:       "Modul 1: Pengenalan " + courseTitle,
				Description: "Modul pengenalan untuk kursus " + courseTitle,
				Content:     "<h2>Pengenalan</h2><p>Selamat datang di kursus " + courseTitle + ".</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
			{
				ID:          2,
				Title:       "Modul 2: Materi Utama",
				Description: "Materi utama untuk kursus " + courseTitle,
				Content:     "<h2>Materi Utama</h2><p>Pada modul ini, Anda akan mempelajari materi utama dari " + courseTitle + ".</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
			{
				ID:          3,
				Title:       "Modul 3: Latihan dan Evaluasi",
				Description: "Latihan dan evaluasi untuk kursus " + courseTitle,
				Content:     "<h2>Latihan dan Evaluasi</h2><p>Mari kita praktikkan apa yang telah dipelajari dan evaluasi pemahaman Anda.</p>",
				VideoUrl:    "https://www.youtube.com/embed/ur6I5m2nTvk",
			},
		}
	}
	
	result := make([]struct {
		ID          int
		Title       string
		Description string
		Content     string
		VideoUrl    string
	}, len(modules))
	
	for i, module := range modules {
		result[i] = struct {
			ID          int
			Title       string
			Description string
			Content     string
			VideoUrl    string
		}{
			ID:          module.ID,
			Title:       module.Title,
			Description: module.Description,
			Content:     module.Content,
			VideoUrl:    module.VideoUrl,
		}
	}
	
	return result
}






