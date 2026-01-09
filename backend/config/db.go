package config

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

func ConnectDB() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	log.Println("Connecting to database...")
	
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Unable to parse DATABASE_URL: %v", err)
	}
	
	config.MaxConns = 10
	config.MinConns = 1
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	
	var db *pgxpool.Pool
	maxRetries := 5
	retryDelay := 2 * time.Second
	
	for i := 0; i < maxRetries; i++ {
		db, err = pgxpool.NewWithConfig(context.Background(), config)
		if err == nil {
			err = db.Ping(context.Background())
			if err == nil {
				log.Println("Successfully connected to database")
				break
			}
		}
		
		if i < maxRetries-1 {
			time.Sleep(retryDelay)
			retryDelay *= 2
		} else {
			log.Fatalf("Failed to connect to database after %d attempts: %v", maxRetries, err)
		}
	}
	
	DB = db

	var version string
	err = DB.QueryRow(context.Background(), "SELECT version()").Scan(&version)
	if err != nil {
		log.Printf("Warning: Could not query database version: %v", err)
	} else {
		log.Printf("Connected to PostgreSQL: %s", version)
	}
}
