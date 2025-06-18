// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios'; // Axios instance'ını da buradan yönetebiliriz

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token')); // Token'ı localStorage'dan al
    const [loading, setLoading] = useState(true); // Başlangıçta token kontrolü için

    // Axios için global Authorization header'ı ayarla
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Token'ı localStorage'a kaydet (zaten oradan alıyoruz ama her token değişiminde güncelleyebiliriz)
            localStorage.setItem('token', token);
        } else {
            delete axios.defaults.headers.common['Authorization'];
            localStorage.removeItem('token');
        }
    }, [token]);

    // Sayfa yüklendiğinde token varsa kullanıcıyı çekmeye çalış
    useEffect(() => {
        const verifyUser = async () => {
            if (token) {
                try {
                    // Backend'de /api/auth/me gibi bir endpoint oluşturup token ile kullanıcıyı çekebiliriz
                    // VEYA token'ı decode edip kullanıcı bilgisini alabiliriz (daha az güvenli olabilir)
                    // Şimdilik, token varsa ve localStorage'da kullanıcı bilgisi varsa onu kullanalım.
                    // Daha iyisi: /api/auth/me endpoint'i ile sunucudan doğrula.
                    const storedUser = localStorage.getItem('user');
                    if (storedUser) {
                        setCurrentUser(JSON.parse(storedUser));
                    } else {
                        // Eğer /api/auth/me endpoint'i olsaydı:
                        // const response = await axios.get(`${API_URL}/auth/me`);
                        // setCurrentUser(response.data.user);
                        // localStorage.setItem('user', JSON.stringify(response.data.user));
                        // Şimdilik bu kısmı atlıyoruz, login'de user'ı kaydedeceğiz.
                        // Eğer token var ama user yoksa, logout yapabiliriz.
                        logout(); // Güvenlik için
                    }
                } catch (error) {
                    console.error("Token doğrulama hatası veya kullanıcı bilgisi alınamadı:", error);
                    logout(); // Hata durumunda token'ı temizle
                }
            }
            setLoading(false);
        };
        verifyUser();
    }, [token]);


    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, { username, password });
            setToken(response.data.token);
            setCurrentUser(response.data.user);
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user)); // Kullanıcı bilgilerini de sakla
            return response.data;
        } catch (error) {
            console.error("Login error:", error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : new Error("Giriş başarısız");
        }
    };

    const logout = () => {
        setToken(null);
        setCurrentUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // İsteğe bağlı: delete axios.defaults.headers.common['Authorization']; (zaten useEffect'te yapılıyor)
    };

    const value = {
        currentUser,
        token,
        loadingAuthState: loading, // Auth state'inin yüklenme durumu
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children} {/* Auth state yüklenene kadar çocukları render etme */}
        </AuthContext.Provider>
    );
};