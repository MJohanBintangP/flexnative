import { useState, useEffect } from 'react';
import AnimatedLoading from '../../components/AnimatedLoading';
import { BookmarkSimpleIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

interface Course {
  id: number;
  title: string;
  description: string;
  level: string;
  duration: string;
  instructor: string;
  videoUrl?: string;
  enrolled: boolean;
  bookmarked: boolean;
  completed: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isValidCourse = (obj: any): obj is Course => {
  return (
    obj &&
    typeof obj.id === 'number' &&
    typeof obj.title === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.level === 'string' &&
    typeof obj.duration === 'string' &&
    typeof obj.instructor === 'string' &&
    typeof obj.enrolled === 'boolean' &&
    typeof obj.bookmarked === 'boolean' &&
    typeof obj.completed === 'boolean'
  );
};

export default function Courses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const handleCourseClick = (courseId: number) => {
    navigate(`/Courses/${courseId}`);
  };

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('Attempting to fetch courses with token:', token.substring(0, 10) + '...');

      try {
        const response = await fetch('http://localhost:8000/api/courses', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('Courses API response status:', response.status);
        console.log('Courses API response headers:', Object.fromEntries([...response.headers.entries()]));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response text:', errorText);
          throw new Error(`Failed to fetch courses: ${response.status} ${response.statusText}`);
        }

        const responseText = await response.text();
        console.log('Raw response text:', responseText);

        let data;
        try {
          data = JSON.parse(responseText);
          console.log('Parsed courses data:', data);
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
          throw new Error('Failed to parse response as JSON');
        }

        if (Array.isArray(data)) {
          console.log(`Received ${data.length} courses from API`);

          const validCourses = data.filter((item) => isValidCourse(item));
          console.log(`Found ${validCourses.length} valid courses out of ${data.length}`);

          if (validCourses.length === 0 && data.length > 0) {
            console.error('No valid courses found in API response. First item:', data[0]);
          }

          setCourses(validCourses);
        } else {
          console.error('API did not return an array:', data);
          throw new Error('API did not return an array of courses');
        }
      } catch (fetchError) {
        console.error('Fetch error details:', fetchError);
      }
    } catch (err) {
      console.error('Error in fetchCourses:', err);
      setError('Failed to load courses. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    const refreshCourses = () => {
      fetchCourses();
    };

    window.addEventListener('userDataUpdated', refreshCourses);

    return () => {
      window.removeEventListener('userDataUpdated', refreshCourses);
    };
  }, []);

  const toggleBookmark = async (courseId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('http://localhost:8000/api/bookmarks/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle bookmark');
      }

      const result = await response.json();

      setCourses(courses.map((course) => (course.id === courseId ? { ...course, bookmarked: result.bookmarked } : course)));
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'Pemula';
      case 'intermediate':
        return 'Menengah';
      case 'advanced':
        return 'Lanjutan';
      default:
        return level;
    }
  };

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

  const filteredCourses = courses
    ? courses.filter((course) => {
        if (filter === 'all') return true;
        if (filter === 'enrolled') return course.enrolled;
        if (filter === 'bookmarked') return course.bookmarked;
        if (filter === 'completed') return course.completed;
        return true;
      })
    : [];

  console.log('Courses:', courses);
  console.log('Filtered courses:', filteredCourses);
  console.log('Current filter:', filter);

  return (
    <div className="py-6">
      <h1 className="text-3xl font-bold mb-6">Kursus</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`cursor-pointer px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          Semua Kursus
        </button>
        <button onClick={() => setFilter('completed')} className={`cursor-pointer px-4 py-2 rounded-lg ${filter === 'completed' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          Selesai
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <AnimatedLoading size={48} />
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center">
          <p className="text-gray-500 mb-4">Tidak ada kursus yang ditemukan.</p>
          <div className="flex justify-center gap-4">
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="text-blue-500 hover:underline">
                Lihat semua kursus
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div key={course.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
              <div className="relative h-48 bg-gray-200 cursor-pointer" onClick={() => handleCourseClick(course.id)}>
                {course.videoUrl ? (
                  <img
                    src={`https://img.youtube.com/vi/${getYouTubeVideoId(course.videoUrl)}/maxresdefault.jpg`}
                    alt={course.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://img.youtube.com/vi/${getYouTubeVideoId(course.videoUrl)}/hqdefault.jpg`;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <span className="text-gray-400">No thumbnail</span>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(course.id);
                  }}
                  className="cursor-pointer absolute top-2 right-2 p-2 bg-white rounded-full shadow-sm"
                >
                  <BookmarkSimpleIcon weight={course.bookmarked ? 'fill' : 'regular'} className={`w-5 h-5 ${course.bookmarked ? 'text-blue-500' : 'text-gray-500'}`} />
                </button>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-lg font-semibold">{course.title}</h2>
                  <span className={`text-xs px-2 py-1 rounded ${course.level === 'beginner' ? 'bg-green-100 text-green-800' : course.level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {getLevelText(course.level)}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <span>{course.duration}</span>
                  <span>{course.instructor}</span>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => handleCourseClick(course.id)}
                    className={`cursor-pointer w-full py-2 rounded-lg ${
                      course.completed ? 'bg-green-600 hover:bg-green-700' : course.enrolled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                    } text-white font-medium transition-colors`}
                  >
                    {course.completed ? 'Selesai' : course.enrolled ? 'Lanjutkan Belajar' : 'Mulai Belajar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
