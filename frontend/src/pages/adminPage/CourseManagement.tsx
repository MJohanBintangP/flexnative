import { useState, useEffect } from 'react';
import * as Phosphor from '@phosphor-icons/react';

interface Course {
  id: number;
  title: string;
  description: string;
  level: string;
  duration: string;
  instructor: string;
  videoUrl?: string;
}

interface Module {
  title: string;
  content: string;
  order: number;
  videoUrl?: string;
}

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    level: 'beginner',
    duration: '',
    instructor: '',
    videoUrl: '',
  });

  const [modules, setModules] = useState<Module[]>([{ title: '', content: '', order: 1, videoUrl: '' }]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:8000/api/courses', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data = await response.json();
      setCourses(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('Failed to load courses');
      setLoading(false);
    }
  };

  const handleDeleteClick = (course: Course) => {
    setCourseToDelete(course);
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = async () => {
    if (!courseToDelete) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Autentikasi diperlukan');
        return;
      }

      console.log(`Menghapus kursus dengan ID: ${courseToDelete.id}`);

      const response = await fetch(`http://localhost:8000/api/admin/courses/${courseToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Status response:', response.status);
      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      if (!response.ok) {
        let errorMessage = 'Gagal menghapus kursus';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response as JSON:', e);
        }
        throw new Error(errorMessage);
      }

      setCourses(courses.filter((course) => course.id !== courseToDelete.id));
      setShowDeleteModal(false);
      setCourseToDelete(null);
    } catch (err) {
      console.error('Error deleting course:', err);
      setError(err instanceof Error ? err.message : 'Gagal menghapus kursus');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewCourse({
      ...newCourse,
      [name]: value,
    });
  };

  const handleModuleChange = (index: number, field: keyof Module, value: string) => {
    const updatedModules = [...modules];
    updatedModules[index] = {
      ...updatedModules[index],
      [field]: value,
    };
    setModules(updatedModules);
  };

  const addModule = () => {
    setModules([...modules, { title: '', content: '', order: modules.length + 1, videoUrl: '' }]);
  };

  const removeModule = (index: number) => {
    if (modules.length > 1) {
      const updatedModules = modules.filter((_, i) => i !== index);
      updatedModules.forEach((module, i) => {
        module.order = i + 1;
      });
      setModules(updatedModules);
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

  const handleAddCourse = async () => {
    try {
      if (!newCourse.title || !newCourse.description || !newCourse.duration || !newCourse.instructor || !newCourse.videoUrl) {
        setError('Semua kolom harus diisi');
        return;
      }

      const invalidModules = modules.filter((module) => !module.title || !module.content);
      if (invalidModules.length > 0) {
        setError('Semua modul harus memiliki judul dan konten');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      console.log('Sending course data:', { ...newCourse, modules });

      const videoId = getYouTubeVideoId(newCourse.videoUrl);
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      const response = await fetch('http://localhost:8000/api/admin/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newCourse,
          thumbnail: thumbnailUrl,
          modules: modules,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));

      const responseText = await response.text();
      console.log('Raw response text:', responseText);

      if (!response.ok) {
        let errorMessage = 'Failed to add course';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response as JSON:', e);
          if (responseText) errorMessage = responseText;
        }
        throw new Error(`${errorMessage} (Status: ${response.status})`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Success response:', data);
      } catch (e) {
        console.warn('Could not parse response as JSON:', e);
      }

      setNewCourse({
        title: '',
        description: '',
        level: 'beginner',
        duration: '',
        instructor: '',
        videoUrl: '',
      });
      setModules([{ title: '', content: '', order: 1 }]);
      setShowAddModal(false);

      fetchCourses();
    } catch (err) {
      console.error('Error adding course:', err);
      setError(err instanceof Error ? err.message : 'Failed to add course');
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Course Management</h2>
        <div className="flex gap-2">
          <button onClick={fetchCourses} className="cursor-pointer bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors">
            <Phosphor.ArrowsClockwiseIcon size={20} />
            Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} className="cursor-pointer bg-[#2B7FFF] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors">
            <Phosphor.PlusIcon size={20} />
            Tambah Kursus
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
                <div className="absolute top-2 right-2 flex gap-1">
                  <button onClick={() => handleDeleteClick(course)} className="cursor-pointer bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors">
                    <Phosphor.TrashIcon size={16} />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-1">{course.title}</h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{course.description}</p>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{getLevelText(course.level)}</span>
                  <span>{course.duration}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add New Course</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title*</label>
                <input type="text" name="title" value={newCourse.title} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level*</label>
                <select name="level" value={newCourse.level} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="beginner">Pemula</option>
                  <option value="intermediate">Menengah</option>
                  <option value="advanced">Lanjutan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration*</label>
                <input
                  type="text"
                  name="duration"
                  placeholder="e.g. 2 hours"
                  value={newCourse.duration}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructor*</label>
                <input type="text" name="instructor" value={newCourse.instructor} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description*</label>
                <textarea name="description" value={newCourse.description} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (YouTube)*</label>
                <input
                  type="text"
                  name="videoUrl"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={newCourse.videoUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Masukkan URL video YouTube atau ID video saja</p>

                {newCourse.videoUrl && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Preview thumbnail:</p>
                    <img
                      src={`https://img.youtube.com/vi/${getYouTubeVideoId(newCourse.videoUrl)}/mqdefault.jpg`}
                      alt="Thumbnail preview"
                      className="h-24 object-cover rounded-md"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/320x180?text=Invalid+YouTube+URL';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Modules Section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Course Modules*</label>
                <button type="button" onClick={addModule} className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1">
                  <Phosphor.PlusIcon size={16} />
                  Add Module
                </button>
              </div>

              {modules.map((module, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-4 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium">Module {module.order}</h4>
                    {modules.length > 1 && (
                      <button type="button" onClick={() => removeModule(index)} className="text-red-500 hover:text-red-700">
                        <Phosphor.TrashIcon size={16} />
                      </button>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Module Title*</label>
                    <input
                      type="text"
                      value={module.title}
                      onChange={(e) => handleModuleChange(index, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Module Content*</label>
                    <textarea
                      value={module.content}
                      onChange={(e) => handleModuleChange(index, 'content', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Module Video URL*</label>
                    <input
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={module.videoUrl || ''}
                      onChange={(e) => handleModuleChange(index, 'videoUrl', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Batal
              </button>
              <button type="button" onClick={handleAddCourse} className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                Tambah Kursus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Course Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-4">
              Are you sure you want to delete course <span className="font-semibold">{courseToDelete?.title}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowDeleteModal(false)} className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleDeleteSubmit} className="cursor-pointer px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
