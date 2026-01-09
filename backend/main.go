package main

import (
	"log"
	"net/http"
	"os"

	"backend/config"
	"backend/handlers"

	"github.com/joho/godotenv"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Tidak ada file .env atau gagal memproses file .env")
	}

	if os.Getenv("DATABASE_URL") == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	config.ConnectDB()
	defer config.DB.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/register", handlers.Register)
	mux.HandleFunc("/api/login", handlers.Login)
	mux.HandleFunc("/api/courses", handlers.GetCourses)
	mux.HandleFunc("/api/courses/search", handlers.SearchCourses)
	mux.HandleFunc("/api/bookmarks", handlers.GetBookmarks)
	mux.HandleFunc("/api/bookmarks/toggle", handlers.ToggleBookmark)
	mux.HandleFunc("/api/user/profile", handlers.GetUserProfile)
	mux.HandleFunc("/api/user/activities", handlers.GetUserActivities)
	mux.HandleFunc("/api/user/recommended-courses", handlers.GetRecommendedCourses)
	mux.HandleFunc("/api/courses/progress", handlers.UpdateProgress)
	mux.HandleFunc("/api/courses/", handlers.GetCourseById)
	mux.HandleFunc("/api/user/record-activity", handlers.RecordActivity)
	mux.HandleFunc("/api/admin/cleanup-modules", handlers.CleanupDuplicateModules)
	mux.HandleFunc("/api/user/sync-completed-courses", handlers.SyncCompletedCourses)
	mux.HandleFunc("/api/user/sync-progress", handlers.SyncUserProgress)
	mux.HandleFunc("/api/admin/users", handlers.GetAllUsers)
	mux.HandleFunc("/api/admin/users/", handlers.HandleUserOperations)
	mux.HandleFunc("/api/admin/courses", handlers.AdminCourseHandler)
	
	mux.HandleFunc("/api/admin/courses/", handlers.AdminCourseByID)
	
	handler := corsMiddleware(mux)

	log.Println("Server running at :8000")
	log.Fatal(http.ListenAndServe(":8000", handler))
}
