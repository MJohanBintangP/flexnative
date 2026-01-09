package models

type User struct {
	ID               int    `json:"id"`
	Username         string `json:"username"`
	Email            string `json:"email"`
	Password         string `json:"password,omitempty"`
	Role             string `json:"role"`
	Progress         int    `json:"progress"`
	CompletedCourses int    `json:"completedCourses"`
	Status           string `json:"status"`
}

type Course struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Level       string `json:"level"`
	Duration    string `json:"duration"`
	Instructor  string `json:"instructor"`
}

type CourseResponse struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Level       string `json:"level"`
	Duration    string `json:"duration"`
	Instructor  string `json:"instructor"`
	Enrolled    bool   `json:"enrolled"`
}

type UserCourse struct {
	ID          int    `json:"id"`
	UserID      int    `json:"userId"`
	CourseID    int    `json:"courseId"`
	Progress    int    `json:"progress"`
	Completed   bool   `json:"completed"`
	EnrolledAt  string `json:"enrolledAt"`
	CompletedAt string `json:"completedAt,omitempty"`
}
