import { useState, useEffect } from 'react';
import AnimatedLoading from '../../components/AnimatedLoading';
import { Link } from 'react-router-dom';
import ilustrasi from '../../assets/ilustrasi.svg';

interface UserProfile {
  username: string;
  email: string;
  progress: number;
  completedCourses: number;
  status: string;
}

interface Activity {
  id: number;
  courseId: number;
  title: string;
  type: string;
  date: string;
}

interface Course {
  id: number;
  title: string;
  level: string;
  videoUrl?: string;
}

export default function Home() {
  const [profile, setProfile] = useState<UserProfile>({
    username: localStorage.getItem('username') || 'User',
    email: 'user@example.com',
    progress: 0,
    completedCourses: 0,
    status: 'Pemula React Native',
  });

  const getYouTubeVideoId = (url: string | undefined): string => {
    if (!url) return '0-S5a0eXPoc';

    if (!url.includes('/') && !url.includes('.')) {
      return url;
    }

    const patterns = [/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/i, /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/i, /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/i];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return '0-S5a0eXPoc';
  };

  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      console.log('Fetching user profile...');
      const profileResponse = await fetch('http://localhost:8000/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('Profile data received:', profileData);

        setProfile({
          username: profileData.username || localStorage.getItem('username') || 'User',
          email: profileData.email || 'user@example.com',
          progress: profileData.progress || 0,
          completedCourses: profileData.completed_courses || 0,
          status: profileData.status || 'Pemula React Native',
        });

        console.log('Progress from API:', profileData.progress);
        console.log('Completed courses from API:', profileData.completed_courses);
      } else {
        console.error('Failed to fetch profile:', profileResponse.statusText);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const activitiesResponse = await fetch('http://localhost:8000/api/user/activities', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        console.log('Activities data received:', activitiesData);

        if (Array.isArray(activitiesData)) {
          const validActivities = activitiesData.filter((activity) => {
            const isValid = activity && typeof activity.courseId === 'number';
            if (!isValid) {
              console.warn('Invalid activity data:', activity);
            }
            return isValid;
          });

          console.log('Valid activities:', validActivities);
          setRecentActivities(validActivities);
        } else {
          console.error('Activities data is not an array:', activitiesData);
        }
      } else {
        console.error('Failed to fetch activities:', activitiesResponse.statusText);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchRecommendedCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      console.log('Fetching recommended courses...');
      const coursesResponse = await fetch('http://localhost:8000/api/user/recommended-courses', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Courses response status:', coursesResponse.status);

      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        console.log('Recommended courses data:', coursesData);

        if (Array.isArray(coursesData)) {
          console.log('Setting courses from array:', coursesData.length, 'courses');
          setRecommendedCourses(coursesData);
        } else if (coursesData && typeof coursesData === 'object' && coursesData.courses && Array.isArray(coursesData.courses)) {
          console.log('Setting courses from object.courses:', coursesData.courses.length, 'courses');
          setRecommendedCourses(coursesData.courses);
        } else {
          console.error('Unexpected response format:', coursesData);
          setRecommendedCourses([]);
        }
      } else {
        console.error('Failed to fetch recommended courses:', coursesResponse.statusText);
        setRecommendedCourses([]);
      }
    } catch (error) {
      console.error('Error fetching recommended courses:', error);
      setRecommendedCourses([]);
    }
  };

  const syncUserProgress = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      console.log('Syncing user progress...');
      const response = await fetch('http://localhost:8000/api/user/sync-progress', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Synced user progress:', data);

        setProfile((prev) => ({
          ...prev,
          progress: data.progress,
          completed_courses: data.completed_courses,
        }));

        console.log('Updated profile with synced progress:', data.progress);
      } else {
        console.error('Failed to sync user progress:', response.statusText);
      }
    } catch (error) {
      console.error('Error syncing user progress:', error);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        await fetchProfile();

        await syncUserProgress();

        await fetchRecentActivities();
        await fetchRecommendedCourses();
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const refreshUserData = () => {
      fetchProfile();
      fetchRecentActivities();
      fetchRecommendedCourses();
    };

    window.addEventListener('userDataUpdated', refreshUserData);

    return () => {
      window.removeEventListener('userDataUpdated', refreshUserData);
    };
  }, []);

  useEffect(() => {
    const handleUserDataUpdated = async () => {
      console.log('User data updated event received, syncing progress...');
      await syncUserProgress();
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdated);

    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdated);
    };
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'course_view':
        return (
          <div className="bg-blue-100 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        );
      case 'module_complete':
        return (
          <div className="bg-green-100 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="bg-purple-100 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="py-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <AnimatedLoading size={64} />
        </div>
      ) : (
        <>
          <div className="bg-blue-50 rounded-lg p-6 mb-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Selamat datang, {profile.username}!</h2>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm flex-1">
                <p className="text-gray-500 mb-1">Progress Belajar</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${profile.progress}%` }}></div>
                </div>
                <p className="text-sm text-gray-600">{profile.progress}% selesai</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm flex-1">
                <p className="text-gray-500 mb-1">Kursus Selesai</p>
                <p className="text-2xl font-bold text-blue-600">{profile.completedCourses}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm flex-1">
                <p className="text-gray-500 mb-1">Status</p>
                <p className="text-lg font-medium">{profile.status || 'Pemula React Native'}</p>
              </div>
            </div>
          </div>

          <div className=" grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow-sm h-full">
                <div className="flex mb-4">
                  <h3 className="text-lg font-semibold">Aktivitas Terbaru</h3>
                </div>

                {recentActivities.length > 0 ? (
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                    {recentActivities.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
                        {getActivityIcon(activity.type)}
                        <div className="flex-1">
                          <h4 className="font-medium">{activity.title}</h4>
                          <p className="text-sm text-gray-500">{formatDate(activity.date)}</p>
                        </div>
                        <Link to={`/Courses/${activity.courseId}`} className="text-blue-500 hover:text-blue-700">
                          Lanjutkan
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <img src={ilustrasi} alt="Tidak ada aktivitas" className="w-52 mb-4" />
                    <p className="text-gray-500">Belum ada aktivitas terbaru !</p>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-lg shadow-sm h-full">
                <h3 className="text-lg font-semibold mb-6">Rekomendasi Kursus</h3>

                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : recommendedCourses && recommendedCourses.length > 0 ? (
                  <div className="space-y-3 max-h-62 overflow-y-auto pr-2">
                    {recommendedCourses.map((course) => (
                      <Link key={course.id} to={`/Courses/${course.id}`} className="block p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition duration-150">
                        <div className="flex items-center">
                          <div className="w-12 h-12 mr-3 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                            <img src={`https://img.youtube.com/vi/${getYouTubeVideoId(course.videoUrl)}/maxresdefault.jpg`} alt={course.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="font-medium text-sm truncate">{course.title}</h4>
                            <p className="text-xs text-gray-500 mt-1">Level: {course.level === 'beginner' ? 'Pemula' : course.level === 'intermediate' ? 'Menengah' : 'Lanjutan'}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-gray-500">Tidak ada rekomendasi kursus saat ini</p>
                  </div>
                )}

                <div className="mt-6">
                  <Link to="/Courses" className="block w-full text-center py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition duration-150">
                    Lihat Semua Kursus
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
