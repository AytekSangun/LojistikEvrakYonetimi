// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'varsayilanGizliAnahtarDegistirBunu';

module.exports = function (req, res, next) {
    // Header'dan token'ı al
    const authHeader = req.header('Authorization');

    // Token yoksa
    if (!authHeader) {
        return res.status(401).json({ error: 'Yetkilendirme reddedildi, token bulunamadı.' });
    }

    // Token formatını kontrol et ("Bearer TOKEN_DEGERI")
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Token formatı geçersiz (Bearer <token> olmalı).' });
    }
    const token = parts[1];

    try {
        // Token'ı doğrula
        const decoded = jwt.verify(token, JWT_SECRET);
        // Doğrulanmış kullanıcı bilgisini request objesine ekle
        req.user = decoded.user;
        next(); // Sonraki middleware'e veya route handler'a geç
    } catch (err) {
        res.status(401).json({ error: 'Token geçersiz veya süresi dolmuş.' });
    }
};