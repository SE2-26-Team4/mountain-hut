import { Link, Route, Routes } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main>
            <h1>Mountain Hut</h1>
            <p>Frontend is up and running.</p>
          </main>
        }
      />

      <Route
        path="*"
        element={
          <main>
            <h1>Page not found</h1>
            <Link to="/">Return to home</Link>
          </main>
        }
      />
    </Routes>
  );
}

export default App;