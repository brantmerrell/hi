/**
 * App.tsx — root component with client-side routing.
 *
 * NOTE: react-router-dom must be installed before this will work:
 *   cd frontend && npm install react-router-dom
 *
 * Routes:
 *   /      -> Reader (main reading page)
 *   /auth  -> Auth   (magic link email entry / token verification)
 */
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Auth from "./pages/Auth";
import Reader from "./pages/Reader";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Reader />} />
        <Route path="/auth" element={<Auth />} />
        {/* Catch-all: redirect unknown paths to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
