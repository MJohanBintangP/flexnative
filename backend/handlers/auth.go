package handlers

import (
	"backend/config"
	"backend/models"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtKey = []byte("3fa85f64-5717-4562-b3fc-2c963f66afa6")

type Credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Register(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	
	log.Println("Starting registration process")
	
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		log.Printf("Error decoding request body: %v", err)
		writeJSONError(w, http.StatusBadRequest, "Invalid request format")
		return
	}
	

	if req.Username == "" || req.Email == "" || req.Password == "" {
		log.Println("Registration error: Missing required fields")
		writeJSONError(w, http.StatusBadRequest, "Username, email, and password are required")
		return
	}
	

	var exists bool
	err = config.DB.QueryRow(context.Background(),
		"SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)", req.Email).Scan(&exists)
	if err != nil {
		log.Printf("Register error checking email existence: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if exists {
		log.Printf("Registration rejected: Email already exists: %s", req.Email)
		writeJSONError(w, http.StatusBadRequest, "Email sudah terdaftar")
		return
	}
	
	err = config.DB.QueryRow(context.Background(),
		"SELECT EXISTS(SELECT 1 FROM users WHERE username=$1)", req.Username).Scan(&exists)
	if err != nil {
		log.Printf("Register error checking username existence: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if exists {
		log.Printf("Registration rejected: Username already exists: %s", req.Username)
		writeJSONError(w, http.StatusBadRequest, "Username sudah terdaftar")
		return
	}
	
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Error hashing password: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "Server error")
		return
	}
	
	_, err = config.DB.Exec(context.Background(),
		"INSERT INTO users (username, email, password, role, progress, completed_courses) VALUES ($1, $2, $3, 'user', 0, 0)",
		req.Username, req.Email, string(hashedPassword))
	if err != nil {
		log.Printf("Error inserting new user: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "Gagal daftar")
		return
	}
	
	log.Printf("Registration successful for user: %s (%s)", req.Username, req.Email)
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Register sukses"})
}

func Login(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	var creds Credentials
	json.NewDecoder(r.Body).Decode(&creds)

	var user models.User
	err := config.DB.QueryRow(context.Background(),
		"SELECT id, password, role FROM users WHERE email=$1", creds.Email).Scan(&user.ID, &user.Password, &user.Role)
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, "User tidak ditemukan")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(creds.Password)); err != nil {
		writeJSONError(w, http.StatusUnauthorized, "Password salah")
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString(jwtKey)
	json.NewEncoder(w).Encode(map[string]string{
		"token": tokenString,
		"role":  user.Role,
	})
}

func AdminHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		writeJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	tokenString := authHeader[len("Bearer "):]

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, nil
		}
		return jwtKey, nil
	})
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid || claims["role"] != "admin" {
		writeJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Welcome, admin"})
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"message": message})
}
