import AdminNavbar from '../../components/adminPage/AdminNavbar';
import UserManagement from './UserManagement';
import CourseManagement from './CourseManagement';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 1024);
    };

    checkScreenSize();

    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  useEffect(() => {
    document.title = 'FlexNative | AdminDashboard';
  }, []);

  if (isSmallScreen) {
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
          <AdminNavbar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-5">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'courses' && <CourseManagement />}
        </div>
      </main>
    </div>
  );
}
