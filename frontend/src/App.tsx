import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import LayoutDashboard from './pages/userPage/LayoutDashboard';
import Home from './pages/userPage/Home';
import Bookmarks from './pages/userPage/Bookmarks';
import AdminDashboard from './pages/adminPage/AdminDashboard';
import Courses from './pages/userPage/Courses';
import CourseDetail from './pages/userPage/CourseDetail';

function App() {
  return (
    <div className="font-[poppins]">
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/Register" element={<Register />} />
          <Route path="/AdminDashboard" element={<AdminDashboard />} />
          <Route path="/" element={<LayoutDashboard />}>
            <Route path="Home" element={<Home />} />
            <Route path="Bookmarks" element={<Bookmarks />} />
            <Route path="Courses" element={<Courses />} />
            <Route path="Courses/:id" element={<CourseDetail />} />
          </Route>
        </Routes>
      </Router>
    </div>
  );
}

export default App;
