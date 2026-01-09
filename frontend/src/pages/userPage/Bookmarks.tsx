import { useState, useEffect } from 'react';
import AnimatedLoading from '../../components/AnimatedLoading';
import { BookmarkSimpleIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import ilustrasi from '../../assets/ilustrasi.svg';

interface Course {
  id: number;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  instructor: string;
  videoUrl?: string;
  enrolled: boolean;
  bookmarked: boolean;
  completed: boolean;
}

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch('http://localhost:8000/api/bookmarks', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch bookmarks: ${response.status}`);
        }

        const data = await response.json();
        console.log('Bookmarks data:', data);

        if (Array.isArray(data)) {
          setBookmarks(
            data.map((course) => ({
              ...course,
              bookmarked: true,
              videoUrl: course.videoUrl || 'dQw4w9WgXcQ',
            }))
          );
          setError(null);
        } else if (data && typeof data === 'object' && data.bookmarks && Array.isArray(data.bookmarks)) {
          const bookmarksData = data.bookmarks.map((course: Partial<Course>) => {
            return {
              ...course,
              bookmarked: true,

              title: course.title || 'Untitled Course',
              description: course.description || 'No description available',
              level: course.level || 'beginner',
              duration: course.duration || '0 jam',
              instructor: course.instructor || 'Unknown',
              videoUrl: course.videoUrl || 'dQw4w9WgXcQ',
              enrolled: !!course.enrolled,
            };
          });
          setBookmarks(bookmarksData);
          setError(null);
        } else if (data && typeof data === 'object' && data.message === 'No bookmarks found') {
          setBookmarks([]);
          setError(null);
        } else {
          console.error('Unexpected response format:', data);
          setBookmarks([]);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching bookmarks:', err);
        setBookmarks([]);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookmarks();
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

      if (!result.bookmarked) {
        setBookmarks(bookmarks.filter((course) => course.id !== courseId));
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="py-6 flex justify-center items-center h-64">
        <AnimatedLoading size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="py-6 flex flex-col items-center justify-center h-[70vh]">
        <img src={ilustrasi} alt="No bookmarks" className="w-64 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Belum ada bookmark !</h2>
        <p className="text-gray-500">Anda belum menyimpan kursus apapun</p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold mb-6">Tersimpan</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bookmarks.map((course) => (
          <div key={course.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="h-40 bg-gray-200 relative">
              <img
                src={`https://img.youtube.com/vi/${getYouTubeVideoId(course.videoUrl)}/maxresdefault.jpg`}
                alt={course.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://img.youtube.com/vi/${getYouTubeVideoId(course.videoUrl)}/hqdefault.jpg`;
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(course.id);
                }}
                className="cursor-pointer absolute top-2 right-2 p-2 bg-white rounded-full shadow-sm"
              >
                <BookmarkSimpleIcon weight="fill" className="w-5 h-5 text-blue-500" />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">{course.title}</h3>
              <p className="text-gray-600 mb-4 text-sm line-clamp-2">{course.description}</p>
              <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                <div className="flex items-center">
                  <span>{course.duration}</span>
                </div>
                <div>{course.instructor}</div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => navigate(`/Courses/${course.id}`)} className={`cursor-pointer bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition ${course.completed ? 'bg-green-500 hover:bg-green-600' : ''}`}>
                  {course.completed ? 'Selesai' : course.enrolled ? 'Lanjutkan' : 'Mulai Kursus'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
