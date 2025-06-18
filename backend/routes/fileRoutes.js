// backend/routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const prisma = require('../db');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');

// Bu router'daki tüm endpoint'ler artık authMiddleware'den geçecek
router.use(authMiddleware);

// DELETE /api/files/documents/:documentId - Bir evrağı sil
router.delete('/documents/:documentId', async (req, res) => {
    const { documentId } = req.params;

    try {
        const document = await prisma.document.findUnique({
            where: { id: documentId },
        });

        if (!document) {
            return res.status(404).json({ error: 'Evrak bulunamadı.' });
        }

        // 1. Fiziksel dosyayı sunucudan sil
        const filePath = path.join(__dirname, '..', document.filePath); // filePath veritabanında 'uploads/...' şeklinde
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    // Dosya silinemese bile DB'den silmeye devam et, ama logla
                    console.error(`Fiziksel dosya silinemedi (${filePath}):`, err);
                }
            });
        } else {
            console.warn(`Silinecek fiziksel dosya bulunamadı: ${filePath}`);
        }

        // 2. Veritabanından evrak kaydını sil
        await prisma.document.delete({
            where: { id: documentId },
        });

        res.status(200).json({ message: 'Evrak başarıyla silindi.' });
    } catch (error) {
        if (error.code === 'P2023' || (error.message && error.message.includes("Malformed UUID"))) {
            return res.status(400).json({ error: 'Geçersiz evrak ID formatı.' });
        }
        if (error.code === 'P2025') { // Kayıt bulunamadı hatası (delete için)
             return res.status(404).json({ error: 'Silinecek evrak veritabanında bulunamadı.' });
        }
        console.error("Evrak silinirken hata:", error);
        res.status(500).json({ error: 'Evrak silinemedi.', details: error.message });
    }
});

module.exports = router;