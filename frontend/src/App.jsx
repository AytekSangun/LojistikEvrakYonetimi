// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify'; // react-toastify import
import 'react-toastify/dist/ReactToastify.css'; // react-toastify CSS import
import './App.css'; // Temel stiller için

// Sayfa component'lerini import et
import OperationListPage from './pages/OperationListPage';
import NewOperationPage from './pages/NewOperationPage';
import OperationDetailPage from './pages/OperationDetailPage';
import GlobalCompanyListPage from './pages/GlobalCompanyListPage';

import LoginPage from './pages/LoginPage'; // YENİ
import { useAuth } from './context/AuthContext.jsx'; // YENİ

// Korumalı Route'lar için bir component
const ProtectedRoute = ({ children }) => {
    const { currentUser, loadingAuthState } = useAuth();
    const location = useLocation(); // Yönlendirme için

    if (loadingAuthState) {
        return <div className="loading-message">Yetki kontrol ediliyor...</div>; // Veya bir spinner
    }

    if (!currentUser) {
        // Kullanıcı giriş yapmamışsa login sayfasına yönlendir,
        // geldiği sayfayı state olarak sakla ki login sonrası oraya dönebilsin
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return children; // Kullanıcı giriş yapmışsa istenen component'i render et
};

function App() {
  const { currentUser, logout, loadingAuthState } = useAuth(); // Auth context'ten al
  return (
    <Router>
      <div className="app-container">
        <ToastContainer // Toast konteynırını ekliyoruz
          position="top-right" // Pozisyon (top-left, top-center, bottom-right vb.)
          autoClose={3000} // Otomatik kapanma süresi (ms) - 3 saniye
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored" // "light", "dark", "colored"
        />
        <nav className="navbar">
          <ul>
            {currentUser && <li><Link to="/">Operasyonlar</Link></li>}
            {currentUser && <li><Link to="/operations/new">Yeni Operasyon</Link></li>}
            {currentUser && <li><Link to="/global-companies">Firmalar</Link></li>}
          </ul>
          <div className="navbar-auth">
            {currentUser ? (
              <>
                <span style={{marginRight: "10px", color: "white"}}>Merhaba, {currentUser.name || currentUser.username}</span>
                <button onClick={logout} className="button-small danger">Çıkış Yap</button>
              </>
            ) : (
              !loadingAuthState && <> {/* Auth state yüklenirken butonları gösterme */}
                <Link to="/login" className="button-small" style={{marginRight: "10px"}}>Giriş Yap</Link>
              </>
            )}
          </div>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
           
            {/* Korumalı Route'lar */}
            <Route path="/" element={<ProtectedRoute><OperationListPage /></ProtectedRoute>} />
            <Route path="/operations/new" element={<ProtectedRoute><NewOperationPage /></ProtectedRoute>} />
            <Route path="/operations/:id" element={<ProtectedRoute><OperationDetailPage /></ProtectedRoute>} />
            <Route path="/global-companies" element={<ProtectedRoute><GlobalCompanyListPage /></ProtectedRoute>} />

            {/* Eşleşmeyen yollar için bir "Not Found" sayfası eklenebilir */}
            <Route path="*" element={<h2>404 - Sayfa Bulunamadı</h2>} />
          </Routes>
        </main>
        {/* ... (footer) ... */}
      </div>
    </Router>
  );
}

export default App;