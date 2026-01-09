import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Logo from '../../assets/logo.svg';
import * as Phosphor from '@phosphor-icons/react';

type AdminNavbarProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export default function AdminNavbar({ activeTab, setActiveTab }: AdminNavbarProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    fetch('http://localhost:8000/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data) => {
        setUsername(data.username || '');
        setEmail(data.email || '');
      })
      .catch((err) => {
        console.error('Error fetching profile:', err);
        setUsername('');
        setEmail('');
      });
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    navigate('/');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex justify-start pl-8 w-full py-8">
        <img className="w-50 justify-center" src={Logo} alt="Logo" />
      </div>

      {/* Admin Profile */}
      <div className="flex-shrink-0 px-6 mb-6">
        <div className="bg-white p-4 rounded-xl border border-[#E4E4E4]">
          <div className="flex flex-col justify-center">
            <div className="font-bold text-[#2B7FFF]">{username || 'Admin'}</div>
            <div className="text-xs text-[#9D9D9D]">{email || 'admin@flexnative.com'}</div>
            <div className="text-xs font-medium text-[#2B7FFF] mt-1">Administrator</div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 flex flex-col gap-5 px-6 mb-4 mt-4">
        <button
          onClick={() => setActiveTab('users')}
          className={`cursor-pointer flex items-center gap-4 py-3 px-4 rounded-xl font-semibold text-[#2B7FFF] ${activeTab === 'users' ? 'bg-white border border-[#E4E4E4]' : 'hover:bg-white border-[#E4E4E4]'}`}
        >
          <Phosphor.UsersIcon size={24} weight={activeTab === 'users' ? 'fill' : 'regular'} />
          Data Pengguna
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`cursor-pointer flex items-center gap-4 py-3 px-4 rounded-xl font-semibold text-[#2B7FFF] ${activeTab === 'courses' ? 'bg-white border border-[#E4E4E4]' : 'hover:bg-white border-[#E4E4E4]'}`}
        >
          <Phosphor.BooksIcon size={24} weight={activeTab === 'courses' ? 'fill' : 'regular'} />
          Data kursus
        </button>
      </nav>

      {/* Logout Button */}
      <div className="flex-shrink-0 px-6 mb-8">
        <button onClick={handleLogout} className="cursor-pointer w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
          <Phosphor.SignOutIcon size={20} weight="bold" />
          Logout
        </button>
      </div>
    </div>
  );
}
