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
import { AuthProvider } from "./context/AuthContext";
import Auth from "./pages/Auth";
import Reader from "./pages/Reader";
import Stats from "./pages/Stats";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/:storyNum/:sentenceNum" element={<Reader />} />
          <Route path="/" element={<Reader />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
