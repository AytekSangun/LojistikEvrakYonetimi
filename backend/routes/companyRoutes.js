// backend/routes/companyRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams önemli!
const prisma = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// Bu router'daki tüm endpoint'ler artık authMiddleware'den geçecek
router.use(authMiddleware);

// POST /api/operations/:operationId/companies - Bir operasyona yeni firma ekle
router.post('/', async (req, res) => {
    const { operationId } = req.params; // Üst route'dan operationId'yi almak için mergeParams: true gerekir
    const { name, role } = req.body;

    if (!name || !role) {
        return res.status(400).json({ error: 'Firma adı (name) ve rol (role) alanları zorunludur.' });
    }

    const validRoles = ['tedarikci', 'alici', 'musteri'];
    if (!validRoles.includes(role.toLowerCase())) {
        return res.status(400).json({ error: `Rol (role) alanı "${validRoles.join('", "')}" değerlerinden biri olmalıdır.` });
    }

    try {
        // Önce operasyonun var olup olmadığını kontrol et
        const operation = await prisma.operation.findUnique({
            where: { id: operationId },
        });

        if (!operation) {
            return res.status(404).json({ error: 'İlgili operasyon bulunamadı.' });
        }

        // Aynı operasyon içinde aynı role sahip aynı isimde bir firma olup olmadığını kontrol et (isteğe bağlı)
        // Bu, veri tekrarını önleyebilir ama bazen aynı isimde farklı tedarikçilerle çalışılabilir.
        // Şimdilik bu kontrolü ekleyelim, ihtiyaca göre kaldırılabilir.
        const existingCompanyInOperation = await prisma.company.findFirst({
            where: {
                operationId: operationId,
                name: name,
                role: role.toLowerCase()
            }
        });

        if (existingCompanyInOperation) {
            return res.status(400).json({ error: `Bu operasyonda "${name}" isimli ve "${role}" rolünde bir firma zaten mevcut.` });
        }

        const newCompany = await prisma.company.create({
            data: {
                name,
                role: role.toLowerCase(),
                operationId: operationId, // operation: { connect: { id: operationId } } şeklinde de olur
            },
        });
        res.status(201).json(newCompany);
    } catch (error) {
        // operationId geçersiz formatta ise Prisma hata verebilir
        if (error.code === 'P2023' || (error.message && error.message.includes("Malformed UUID")) || (error.code === 'P2025' && error.meta?.cause?.includes('OperationToCompany'))) {
             return res.status(400).json({ error: 'Geçersiz operasyon ID formatı veya bulunamayan operasyon.' });
        }
        // Diğer Prisma hataları (örn: foreign key constraint)
        if (error.code === 'P2003' && error.meta?.field_name?.includes('operationId')) {
            return res.status(404).json({ error: 'İlgili operasyon bulunamadı (foreign key constraint).' });
        }
        console.error("Firma oluşturulurken hata:", error);
        res.status(500).json({ error: 'Firma oluşturulamadı.', details: error.message });
    }
});

// TODO: Diğer company route'ları (GET, PUT, DELETE) buraya eklenebilir.
// Örneğin, belirli bir operasyondaki tüm firmaları listelemek için:
// GET /api/operations/:operationId/companies
router.get('/', async (req, res) => {
    const { operationId } = req.params;
    try {
        // Operasyonun varlığını kontrol et
        const operationExists = await prisma.operation.findUnique({
            where: { id: operationId },
            select: { id: true } // Sadece id'yi seçerek performansı artır
        });

        if (!operationExists) {
            return res.status(404).json({ error: 'İlgili operasyon bulunamadı.' });
        }

        const companies = await prisma.company.findMany({
            where: {
                operationId: operationId,
            },
            orderBy: {
                createdAt: 'asc', // Veya role göre sıralama da yapılabilir
            },
            // İleride her firmanın kaç dokümanı olduğunu da getirebiliriz
            // include: {
            //   _count: { select: { documents: true } }
            // }
        });
        res.status(200).json(companies);
    } catch (error) {
        if (error.code === 'P2023' || (error.message && error.message.includes("Malformed UUID"))) {
             return res.status(400).json({ error: 'Geçersiz operasyon ID formatı.' });
        }
        console.error(`Operasyon (${operationId}) firmaları listelenirken hata:`, error);
        res.status(500).json({ error: 'Firmalar listelenemedi.', details: error.message });
    }
});


module.exports = router;