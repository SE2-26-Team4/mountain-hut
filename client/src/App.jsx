import { useAuthLogic } from './hooks/useAuthLogic';

function App() {
  const { user, loading, logout } = useAuthLogic();

  if (loading) {
    return (
      <main>
        <p>Loading session...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Mountain Hut</h1>
      {user ? (
        <div>
          <p>
            Welcome, <strong>{user.full_name}</strong> ({user.role})
          </p>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <p>No active session. Please log in.</p>
      )}
    </main>
  );
}

export default App
