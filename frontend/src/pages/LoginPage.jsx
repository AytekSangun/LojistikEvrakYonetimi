// src/pages/LoginPage.jsx
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, Link, useLocation } from 'react-router-dom'; // useLocation eklendi
import { toast } from 'react-toastify';

const LoginPage = () => {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        defaultValues: { username: '', password: ''}
    });
    const { login, currentUser } = useAuth(); // currentUser'ı alalım
    const navigate = useNavigate();
    const location = useLocation(); // Yönlendirme için
    const from = location.state?.from?.pathname || "/"; // Nereden geldi?

    // Eğer kullanıcı zaten giriş yapmışsa ve login sayfasına gelmişse ana sayfaya yönlendir
    useEffect(() => {
        if (currentUser) {
            navigate(from, { replace: true });
        }
    }, [currentUser, navigate, from]);


    const onSubmit = async (data) => {
        try {
            // Kullanıcı ID'sini trim et
            const username = data.username.trim();
            await login(username, data.password);
            toast.success("Başarıyla giriş yapıldı!");
            navigate(from, { replace: true }); // Geldiği sayfaya veya ana sayfaya yönlendir
        } catch (error) {
            toast.error(error.message || "Giriş başarısız oldu.");
        }
    };

    return (
        <div className="auth-page">
            <h2>Giriş Yap</h2>
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="form-group">
                    <label htmlFor="username">Kullanıcı ID:</label>
                    <input
                        type="text"
                        id="username"
                        placeholder="L-000000"
                        {...register("username", {
                            required: "Kullanıcı ID zorunludur",
                            pattern: {
                                value: /^L-\d{6}$/,
                                message: "Geçersiz Kullanıcı ID formatı (L-000000 gibi olmalı)."
                            }
                        })}
                    />
                    {errors.username && <p className="error-text">{errors.username.message}</p>}
                </div>
                <div className="form-group">
                    <label htmlFor="password">Şifre:</label>
                    <input
                        type="password"
                        id="password"
                        placeholder="********"
                        {...register("password", { required: "Şifre zorunludur" })}
                    />
                    {errors.password && <p className="error-text">{errors.password.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting} className="button primary-button">
                    {isSubmitting ? "Giriş Yapılıyor..." : "Giriş Yap"}
                </button>
            </form>
            {/* Kayıt linkini kaldırıyoruz */}
            {/* <p style={{marginTop: '1rem'}}>
                Hesabınız yok mu? <Link to="/register">Kayıt Olun</Link>
            </p> */}
        </div>
    );
};
export default LoginPage;