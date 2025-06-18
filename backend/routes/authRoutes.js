// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const prisma = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 3;

// POST /api/auth/register - Kullanıcı Kaydı (Username ile)
router.post('/register', async (req, res) => {
    let { username, password, name } = req.body;

    if (username) username = username.trim();
    if (name) name = name.trim();

    if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı ID ve şifre zorunludur.' });
    }
    if (!/^L-\d{6}$/.test(username)) {
        return res.status(400).json({ error: 'Kullanıcı ID formatı geçersiz (L-000000 gibi olmalı).' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Bu Kullanıcı ID zaten kullanılıyor.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
            },
        });
        res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi.', userId: user.id, username: user.username });
    } catch (error) {
        console.error("Kayıt sırasında hata:", error);
        if (error.code === 'P2002') { // Prisma unique constraint error
            return res.status(400).json({ error: 'Bu Kullanıcı ID zaten kullanılıyor.' });
        }
        res.status(500).json({ error: 'Kayıt sırasında bir sunucu hatası oluştu.' });
    }
});

// POST /api/auth/login - Kullanıcı Girişi (Username ile ve Brute-Force Korumalı)
router.post('/login', async (req, res) => {
    let { username, password } = req.body;

    if (username) username = username.trim();

    if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı ID ve şifre zorunludur.' });
    }
    // İsteğe bağlı: Backend'de de format kontrolü
    // if (!/^L-\d{6}$/.test(username)) {
    //     return res.status(400).json({ error: 'Geçersiz Kullanıcı ID formatı.' });
    // }

    try {
        const user = await prisma.user.findUnique({ where: { username } });

        if (!user) {
            return res.status(401).json({ error: 'Geçersiz Kullanıcı ID veya şifre.' });
        }

        if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
            const timeLeft = Math.ceil((new Date(user.lockedUntil).getTime() - new Date().getTime()) / (1000 * 60));
            return res.status(429).json({ error: `Çok fazla başarısız deneme. Hesabınız ${timeLeft} dakika daha kilitli.` });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            let attempts = user.loginAttempts + 1;
            let updateData = { loginAttempts: attempts };

            if (attempts >= MAX_LOGIN_ATTEMPTS) {
                updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
                updateData.loginAttempts = 0; // Kilitlendikten sonra denemeleri sıfırla
                await prisma.user.update({ where: { id: user.id }, data: updateData });
                return res.status(429).json({ error: `Çok fazla başarısız deneme. Hesabınız ${LOCKOUT_DURATION_MINUTES} dakika kilitlendi.` });
            } else {
                await prisma.user.update({ where: { id: user.id }, data: updateData });
            }
            return res.status(401).json({ error: 'Geçersiz Kullanıcı ID veya şifre.' });
        }

        if (user.loginAttempts > 0 || user.lockedUntil) {
            await prisma.user.update({
                where: { id: user.id },
                data: { loginAttempts: 0, lockedUntil: null },
            });
        }

        const payload = {
            user: { id: user.id, username: user.username, name: user.name }
        };
        jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: { id: user.id, username: user.username, name: user.name }
            });
        });

    } catch (error) {
        console.error("Giriş sırasında hata:", error);
        res.status(500).json({ error: 'Giriş sırasında bir sunucu hatası oluştu.' });
    }
});

module.exports = router;