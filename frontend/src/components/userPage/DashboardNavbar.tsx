import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '../../assets/Home.svg';
import BookmarkIcon from '../../assets/Bookmark.svg';
import CoursesIcon from '../../assets/Teacher.svg';
import Logo from '../../assets/logo.svg';

export default function DashboardNavbar() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-start pl-8 w-full py-8">
        <img className="w-50 justify-center" src={Logo} alt="Logo" />
      </div>

      {/* Menu */}
      <nav className="flex-1 flex flex-col gap-5 px-6 mb-4 mt-4">
        <Link to="/Home" className={`flex items-center gap-4 py-3 px-4 rounded-xl font-semibold text-[#2B7FFF] ${isActive('/Home') ? 'bg-white border border-[#E4E4E4]' : 'hover:bg-white  border-[#E4E4E4]'}`}>
          <img src={HomeIcon} alt="CoursesIcon" /> Beranda
        </Link>
        <Link to="/Bookmarks" className={`flex items-center gap-4 py-3 px-4 rounded-xl font-semibold text-[#2B7FFF] ${isActive('/Bookmark') ? 'bg-white border border-[#E4E4E4]' : 'hover:bg-white  border-[#E4E4E4]'}`}>
          <img color="#2B7FFF" src={BookmarkIcon} alt="CoursesIcon" /> Tersimpan
        </Link>
        <Link to="/Courses" className={`flex items-center gap-4 py-3 px-4 rounded-xl font-semibold text-[#2B7FFF] ${isActive('/Courses') ? 'bg-white border border-[#E4E4E4]' : 'hover:bg-white  border-[#E4E4E4]'}`}>
          <img src={CoursesIcon} alt="CoursesIcon" /> Kursus
        </Link>
      </nav>
    </div>
  );
}
