import { useState, useEffect } from 'react';
import * as Phosphor from '@phosphor-icons/react';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  progress: number;
  completed_courses: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      console.log('Fetching users from API...');
      const response = await fetch('http://localhost:8000/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Users data received:', data);
      setUsers(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
      setLoading(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setNewUsername(user.username);
    setShowEditModal(true);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleEditSubmit = async () => {
    if (!editingUser || !newUsername.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      setUsers(users.map((user) => (user.id === editingUser.id ? { ...user, username: newUsername } : user)));

      setShowEditModal(false);
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user');
    }
  };

  const handleDeleteSubmit = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete user');
      }

      setUsers(users.filter((user) => user.id !== userToDelete.id));
      setShowDeleteModal(false);
      setUserToDelete(null);
      setLoading(false);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      setShowDeleteModal(false);
      setUserToDelete(null);
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <button onClick={fetchUsers} className="cursor-pointer bg-[#2B7FFF] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors">
          <Phosphor.ArrowsClockwiseIcon size={20} />
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed Courses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{user.role}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${user.progress}%` }}></div>
                    </div>
                    <span className="text-xs">{user.progress}%</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.completed_courses}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button onClick={() => handleEditClick(user)} className="cursor-pointer text-indigo-600 hover:text-indigo-900">
                        <Phosphor.PencilSimpleIcon size={20} />
                      </button>
                      <button onClick={() => handleDeleteClick(user)} className="cursor-pointer text-red-600 hover:text-red-900">
                        <Phosphor.TrashIcon size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowEditModal(false)} className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleEditSubmit} className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-4">
              Apakah kamu yakin ingin menghapus pengguna <span className="font-semibold">{userToDelete?.username}</span>? Tindakan ini tidak dapat dibatalkan.
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
