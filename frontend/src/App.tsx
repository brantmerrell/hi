/**
 * App.tsx — root component with client-side routing.
 *
 * NOTE: react-router-dom must be installed before this will work:
 *   cd frontend && npm install react-router-dom
 *
 * Routes:
 *   /                                    -> Reader (redirects to bookmark or first story)
 *   /:authorSlug/:storyNum/:sentenceNum  -> Reader (also /:authorSlug and /:authorSlug/:storyNum)
 *   /:storyNum/:sentenceNum              -> legacy form; Reader redirects to the new form
 *   /auth  -> Auth   (magic link email entry / token verification)
 */
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Auth from "./pages/Auth";
import Reader from "./pages/Reader";
import Words from "./pages/Words";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/words" element={<Words />} />
          <Route path="/:authorSlug/:storyNum/:sentenceNum" element={<Reader />} />
          <Route path="/:authorSlug/:storyNum" element={<Reader />} />
          <Route path="/:authorSlug" element={<Reader />} />
          <Route path="/" element={<Reader />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
