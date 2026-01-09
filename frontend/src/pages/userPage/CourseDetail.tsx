import { useState, useEffect } from 'react';
import AnimatedLoading from '../../components/AnimatedLoading';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, BookmarkSimpleIcon, CheckCircleIcon } from '@phosphor-icons/react';

interface CourseDetail {
  id: number;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  instructor: string;
  videoUrl: string;
  bookmarked: boolean;
  enrolled: boolean;
  completed: boolean;
  modules: Module[];
  courseProgress?: number;
}

interface Module {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  content: string;
  videoUrl?: string;
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

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchCourseDetail = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Token autentikasi tidak ditemukan. Silakan refresh halaman.');
          setIsLoading(false);
          return;
        }

        const response = await fetch(`http://localhost:8000/api/courses/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 401) {
          console.error('Token tidak valid atau kedaluwarsa');
          setError('Sesi tidak valid. Silakan refresh halaman dan coba lagi.');
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        const responseText = await response.text();
        console.log('Raw API response:', responseText);

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
          throw new Error('Invalid JSON response from server');
        }

        console.log('Course detail data:', data);

        let normalizedData = data;

        if (data && typeof data === 'object') {
          if (!data.modules) {
            console.log('No modules found in response, adding empty array');
            normalizedData = {
              ...data,
              modules: [],
            };
          } else if (!Array.isArray(data.modules)) {
            console.error('modules is not an array:', data.modules);
            if (typeof data.modules === 'object') {
              const modulesArray = Object.values(data.modules);
              console.log('Converted modules object to array:', modulesArray);
              normalizedData = {
                ...data,
                modules: modulesArray,
              };
            } else {
              normalizedData = {
                ...data,
                modules: [],
              };
            }
          }
        } else {
          console.error('Invalid course data received:', data);
          throw new Error('Invalid course data format');
        }

        console.log('Normalized course data:', normalizedData);
        setCourse(normalizedData);

        if (normalizedData.courseProgress !== undefined) {
          setProgress(normalizedData.courseProgress);
          console.log(`Using course progress from API: ${normalizedData.courseProgress}%`);
        } else if (normalizedData.modules && normalizedData.modules.length > 0) {
          const completedModules = normalizedData.modules.filter((module: Module) => module.completed).length;
          const progressPercentage = Math.round((completedModules / normalizedData.modules.length) * 100);
          setProgress(progressPercentage);
          console.log(`Calculated course progress: ${progressPercentage}%`);
        }

        const firstUncompletedModule = normalizedData.modules.find((module: Module) => !module.completed);
        if (firstUncompletedModule) {
          setActiveModule(firstUncompletedModule.id);
        } else {
          setActiveModule(normalizedData.modules[0].id);
        }

        recordActivity(parseInt(id as string), 'course_view');
      } catch (err) {
        console.error('Error fetching course details:', err);
        setError('Failed to load course details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchCourseDetail();
    }
  }, [id]);

  const recordActivity = async (courseId: number, type: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      await fetch('http://localhost:8000/api/user/record-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId,
          type,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleBookmark = async () => {
    if (!course) return;

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
        body: JSON.stringify({ courseId: course.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle bookmark');
      }

      const result = await response.json();
      setCourse((prev) => (prev ? { ...prev, bookmarked: result.bookmarked } : null));
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };
  const markModuleComplete = async (moduleId: number) => {
    try {
      if (!course || !course.modules || !course.modules.some((m) => m.id === moduleId)) {
        console.error('Invalid module ID:', moduleId);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const courseId = parseInt(id as string);
      console.log('Sending progress update:', { courseId, moduleId, completed: true });

      const response = await fetch('http://localhost:8000/api/courses/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: courseId,
          moduleId: moduleId,
          completed: true,
        }),
      });

      console.log('Progress update response status:', response.status);
      const responseText = await response.text();
      console.log('Progress update response body:', responseText);

      if (!response.ok) {
        throw new Error(`Failed to update progress: ${response.status} - ${responseText}`);
      }
      let responseData;
      if (responseText && responseText.trim()) {
        try {
          responseData = JSON.parse(responseText);
          console.log('Parsed response data:', responseData);

          if (responseData.progress !== undefined) {
            console.log('Server returned progress:', responseData.progress);
          }
        } catch (e) {
          console.warn('Could not parse response as JSON:', e);
        }
      }

      if (course && course.modules) {
        const updatedModules = course.modules.map((module) => (module.id === moduleId ? { ...module, completed: true } : module));

        setCourse({
          ...course,
          modules: updatedModules,
          completed: responseData?.courseCompleted || false,
        });

        const completedModules = updatedModules.filter((module) => module.completed).length;
        const courseProgressPercentage = Math.round((completedModules / updatedModules.length) * 100);
        setProgress(courseProgressPercentage);
        console.log(`Updated course-specific progress: ${courseProgressPercentage}% (${completedModules}/${updatedModules.length} modules)`);

        const currentIndex = updatedModules.findIndex((module) => module.id === moduleId);
        if (currentIndex < updatedModules.length - 1) {
          setActiveModule(updatedModules[currentIndex + 1].id);
        }
      }

      recordActivity(parseInt(id as string), 'module_complete');

      await syncCompletedCourses();

      console.log('Dispatching userDataUpdated event to update global progress');
      const userDataEvent = new CustomEvent('userDataUpdated');
      window.dispatchEvent(userDataEvent);
    } catch (err) {
      console.error('Error updating progress:', err);
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

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <AnimatedLoading size={48} />
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p className="mb-4">{error || 'Course not found'}</p>
          <div className="text-sm mb-4">
            <p>Kursus ID: {id}</p>
            <p>Coba refresh halaman atau periksa koneksi internet Anda.</p>
          </div>
          <Link to="/Courses" className="text-blue-500 hover:underline mt-2 inline-block">
            Kembali ke Daftar Kursus
          </Link>
        </div>
      </div>
    );
  }

  if (!course.modules) {
    course.modules = [];
  } else if (!Array.isArray(course.modules)) {
    console.error('course.modules is not an array:', course.modules);
    course.modules = [];
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/Courses" className="flex items-center text-blue-500 hover:underline">
          <ArrowLeftIcon size={20} className="mr-1" />
          Kembali ke Daftar Kursus
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="relative h-64 bg-gray-200">
          <img
            src={`https://img.youtube.com/vi/${getYouTubeVideoId(course.videoUrl)}/maxresdefault.jpg`}
            alt={course.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://img.youtube.com/vi/${getYouTubeVideoId(course.videoUrl)}/hqdefault.jpg`;
            }}
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-end">
            <div className="p-6 text-white">
              <div className="flex flex-col gap-12 items-start">
                <button onClick={toggleBookmark} className="cursor-pointer p-2 rounded-full bg-white text-gray-800 hover:bg-gray-100">
                  {course.bookmarked ? <BookmarkSimpleIcon weight="fill" className="w-5 h-5 text-blue-500" /> : <BookmarkSimpleIcon className="w-5 h-5" />}
                </button>
                <div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs ${getLevelColor(course.level)} mb-2`}>{getLevelText(course.level)}</span>
                  <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
                  <p className="text-sm opacity-90 mb-1">Instruktur: {course.instructor}</p>
                  <p className="text-sm opacity-90">Durasi: {course.duration}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Deskripsi Kursus</h2>
            <p className="text-gray-600">{course.description}</p>
          </div>

          {course.videoUrl && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Video Pengantar</h2>
              <div className="aspect-w-16 aspect-h-9">
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(course.videoUrl)}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded-lg"
                ></iframe>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Progress Belajar</h2>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-sm text-gray-600">{progress}% selesai</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <h2 className="text-xl font-semibold mb-4">Modul Pembelajaran</h2>
              <div className="space-y-2">
                {(() => {
                  if (!course.modules || course.modules.length === 0) {
                    return <p>Tidak ada modul tersedia</p>;
                  }

                  const displayedModuleIds = new Set();
                  return course.modules
                    .filter((module) => {
                      if (displayedModuleIds.has(module.id)) {
                        return false;
                      }
                      displayedModuleIds.add(module.id);
                      return true;
                    })
                    .map((module) => (
                      <button
                        key={module.id}
                        onClick={() => setActiveModule(module.id)}
                        className={`cursor-pointer w-full text-left p-3 rounded-lg flex items-center justify-between ${activeModule === module.id ? 'bg-blue-50 border border-blue-200' : 'border border-gray-200 hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center">
                          {module.completed ? (
                            <CheckCircleIcon weight="fill" className="w-5 h-5 text-green-500 mr-2" />
                          ) : (
                            <div className={`w-5 h-5 rounded-full border ${activeModule === module.id ? 'border-blue-500' : 'border-gray-300'} mr-2`}></div>
                          )}
                          <span className={module.completed ? 'text-gray-500' : ''}>{module.title}</span>
                        </div>
                      </button>
                    ));
                })()}
              </div>
            </div>

            <div className="md:col-span-2">
              {activeModule && course.modules && course.modules.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  {course.modules.map(
                    (module) =>
                      module.id === activeModule && (
                        <div key={module.id}>
                          <h3 className="text-xl font-semibold mb-4">{module.title}</h3>

                          {module.videoUrl && (
                            <div className="mb-6">
                              <div className="aspect-w-16 aspect-h-9">
                                <iframe
                                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(module.videoUrl)}`}
                                  title={`${module.title} video`}
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full h-full rounded-lg"
                                ></iframe>
                              </div>
                            </div>
                          )}

                          <div className="prose max-w-none mb-6">
                            <div dangerouslySetInnerHTML={{ __html: module.content }} />
                          </div>

                          {!module.completed && (
                            <button onClick={() => markModuleComplete(module.id)} className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                              Tandai Selesai & Lanjutkan
                            </button>
                          )}
                          {module.completed && (
                            <div className="flex items-center text-green-500">
                              <CheckCircleIcon weight="fill" className="w-5 h-5 mr-2" />
                              <span>Modul ini telah diselesaikan</span>
                            </div>
                          )}
                        </div>
                      )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const syncCompletedCourses = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      return;
    }

    await fetch('http://localhost:8000/api/user/sync-completed-courses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error syncing completed courses count:', error);
  }
};
