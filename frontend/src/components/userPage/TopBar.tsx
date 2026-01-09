import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  username?: string;
}

interface SearchResult {
  id: number;
  title: string;
  level: string;
  videoUrl?: string;
}

export default function TopBar({ username = 'User' }: TopBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [displayName, setDisplayName] = useState(username);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  useEffect(() => {
    if (username && username !== 'User') {
      setDisplayName(username);
      console.log('TopBar received username:', username);
    }
  }, [username]);

  useEffect(() => {
    if (!username || username === 'User') {
      const storedUsername = localStorage.getItem('username');
      if (storedUsername) {
        setDisplayName(storedUsername);
        console.log('TopBar using username from localStorage:', storedUsername);
      }
    }
  }, [username]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchCourses(searchQuery);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const searchCourses = async (query: string) => {
    if (!query.trim()) return;

    try {
      setIsSearching(true);
      const token = localStorage.getItem('token');

      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`http://localhost:8000/api/courses/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching courses:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/Courses?search=${encodeURIComponent(searchQuery)}`);
      setShowResults(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');

    sessionStorage.clear();

    document.cookie.split(';').forEach(function (c) {
      document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });

    navigate('/');
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
    <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
      {/* Search Bar */}
      <div className="relative w-1/3" ref={searchRef}>
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Cari kursus..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button type="submit" className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </form>

        {/* Search Results Dropdown */}
        {showResults && searchQuery.trim().length >= 2 && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg py-1 z-20 max-h-80 overflow-y-auto">
            {isSearching ? (
              <div className="px-4 py-2 text-gray-500 text-center">
                <div className="inline-block animate-spin h-4 w-4 border-t-2 border-blue-500 rounded-full mr-2"></div>
                Mencari...
              </div>
            ) : searchResults.length > 0 ? (
              <>
                {searchResults.map((course) => (
                  <a key={course.id} href={`/Courses/${course.id}`} className="flex items-center px-4 py-2 hover:bg-gray-100" onClick={() => setShowResults(false)}>
                    <div className="h-10 w-10 bg-gray-200 rounded mr-3 overflow-hidden">
                      <img
                        src={`https://img.youtube.com/vi/${getYouTubeVideoId(course.videoUrl)}/maxresdefault.jpg`}
                        alt={course.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/40x40?text=Course';
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{course.title}</p>
                      <p className="text-xs text-gray-500">{getLevelText(course.level)}</p>
                    </div>
                  </a>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/Courses`);
                      setShowResults(false);
                    }}
                    className="cursor-pointer block w-full text-center px-4 py-2 text-blue-500 hover:bg-gray-100 text-sm"
                  >
                    Lihat semua kursus
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4 py-2 text-gray-500 text-center">Tidak ada kursus yang ditemukan</div>
            )}
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowDropdown(!showDropdown)}>
          <div className="text-right">
            <p className="font-medium">{displayName}</p>
            <p className="text-xs text-gray-500">Student</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">{displayName.charAt(0).toUpperCase()}</div>
        </div>

        {/* Dropdown Menu */}
        {showDropdown && (
          <button onClick={handleLogout} className="absolute top-13 right-0 w-48 bg-white rounded-xl border-[#C7C7C7] border z-10 cursor-pointer block text-left px-4 py-3 hover:bg-red-600 hover:font-medium hover:text-white text-red-600">
            LogOut
          </button>
        )}
      </div>
    </div>
  );
}
