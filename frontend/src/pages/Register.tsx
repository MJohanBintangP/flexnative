import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AnimatedLoading from '../components/AnimatedLoading';
import logo from '../assets/logo.svg';
import { useEffect } from 'react';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'FlexNative | Register';
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Gagal daftar');
        setLoading(false);
        return;
      }

      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Gagal koneksi ke server');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-center px-6 py-8">
        {/* Left side - Form */}
        <div className="w-full md:w-1/2 max-w-md bg-white p-8 rounded-2xl shadow-md">
          <div className="flex justify-center mb-10 mt-2">
            <img src={logo} alt="FlexNative Logo" className="h-12" />
          </div>

          <h1 className="text-2xl font-bold mb-2 text-[#2B7FFF]">Buat akun-mu !</h1>
          <p className="text-gray-500 mb-6 text-sm">Daftar untuk menggunakan FlexNative</p>

          <form onSubmit={handleSubmit} className="w-full">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}

            <div className="mb-4">
              <label htmlFor="username" className="block font-medium text-gray-700 mb-1 text-sm">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Buat username baru"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2B7FFF] focus:border-transparent transition-all text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="email" className="block font-medium text-gray-700 mb-1 text-sm">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="Masukkan email kamu"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2B7FFF] focus:border-transparent transition-all text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="block font-medium text-gray-700 mb-1 text-sm">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Buat password baru"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2B7FFF] focus:border-transparent transition-all text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="cursor-pointer w-full bg-[#2B7FFF] hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center text-sm" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <AnimatedLoading size={20} />
                  Processing...
                </span>
              ) : (
                'Daftar'
              )}
            </button>

            <p className="text-sm text-gray-600 mt-6 text-center">
              Sudah punya akun?{' '}
              <span className="text-[#2B7FFF] hover:underline cursor-pointer font-medium" onClick={() => navigate('/')}>
                Masuk
              </span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
