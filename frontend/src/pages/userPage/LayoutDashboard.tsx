import DashboardNavbar from '../../components/userPage/DashboardNavbar';
import TopBar from '../../components/userPage/TopBar';
import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function LayoutDashboard() {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [username, setUsername] = useState('User');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'FlexNative | Dashboard';
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      console.log('Username from localStorage:', storedUsername);
    }

    const token = localStorage.getItem('token');
    if (token) {
      fetch('http://localhost:8000/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to fetch profile');
          }
          return res.json();
        })
        .then((data) => {
          if (data.username) {
            console.log('Username from API:', data.username);
            setUsername(data.username);
            localStorage.setItem('username', data.username);
          }
        })
        .catch((err) => {
          console.error('Error fetching user profile:', err);
        });
    }

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  if (isMobileDevice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 md:p-30 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-black mb-4">Perangkat Tidak Didukung !</h1>
        <p className="text-[#737373] text-md md:text-lg mb-6">Web ini sementara belum mendukung ukuran layar dari device anda. Silakan akses menggunakan perangkat desktop atau laptop untuk pengalaman terbaik.</p>

        <button onClick={() => navigate('/')} className="cursor-pointer mt-6 bg-blue-500 text-white px-6 md:px-8 py-2 rounded-xl font-medium">
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white h-screen flex overflow-hidden">
      <aside className="w-76 bg-[#FBFBFB] h-screen flex-shrink-0 border-r-1 border-[#C7C7C7]">
        <div className="h-full flex flex-col overflow-hidden">
          <DashboardNavbar />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-20 py-5">
        <TopBar username={username} />
        <div className="container mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
