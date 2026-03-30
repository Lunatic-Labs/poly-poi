import { Routes, Route } from "react-router-dom";

// Visitor app: /app/:slug — tenant-branded experience
// Admin portal: /admin — protected dashboard
// These routes will expand in Phase 2–4

function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center text-gray-500">
      <p>Page not found</p>
    </div>
  );
}

function Home() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-xl font-semibold text-gray-700">PolyPOI</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
