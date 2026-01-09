package utils

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)
var jwtKey = []byte(getJWTSecret())

func getJWTSecret() string {
    secret := os.Getenv("JWT_SECRET")
    if secret == "" {
        return "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    }
    return secret
}

func VerifyToken(tokenString string) (jwt.MapClaims, error) {
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return jwtKey, nil
    })

    if err != nil {
        return nil, err
    }

    if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
        return claims, nil
    }

    return nil, errors.New("invalid token")
}

func GenerateToken(userID int, username string, role string) (string, error) {
    claims := jwt.MapClaims{
        "user_id":  userID,
        "username": username,
        "role":     role,
        "exp":      time.Now().Add(24 * time.Hour).Unix(),
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(jwtKey)
}
