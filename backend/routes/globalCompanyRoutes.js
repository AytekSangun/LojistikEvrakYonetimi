// backend/routes/globalCompanyRoutes.js
const express = require('express');
const router = express.Router();
const prisma = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// Bu router'daki tüm endpoint'ler artık authMiddleware'den geçecek
router.use(authMiddleware);

// POST /api/global-companies - Yeni bir global firma oluştur
router.post('/', async (req, res) => {
    const { name, address, taxNumber, contact } = req.body; // Şemadaki opsiyonel alanları da ekledim

    if (!name) {
        return res.status(400).json({ error: 'Firma adı (name) zorunludur.' });
    }

    try {
        const newGlobalCompany = await prisma.globalCompany.create({
            data: {
                name,
                address,     // Opsiyonel, gelmezse null/undefined olur
                taxNumber,   // Opsiyonel
                contact      // Opsiyonel
            },
        });
        res.status(201).json(newGlobalCompany);
    } catch (error) {
        if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
            return res.status(400).json({ error: `Bu firma adı (${name}) zaten kullanılıyor.` });
        }
        console.error("Global firma oluşturulurken hata:", error);
        res.status(500).json({ error: 'Global firma oluşturulamadı.', details: error.message });
    }
});

// GET /api/global-companies/all - Tüm global firmaları sayfalama olmadan listele
router.get('/all', async (req, res) => {
    try {
        const companies = await prisma.globalCompany.findMany({
            orderBy: {
                name: 'asc' // Ada göre sıralı
            }
        });
        res.status(200).json(companies); // Doğrudan dizi döndür
    } catch (error) {
        console.error("Tüm global firmalar listelenirken hata:", error);
        res.status(500).json({ error: 'Tüm global firmalar listelenemedi.', details: error.message });
    }
});

// GET /api/global-companies - Tüm global firmaları listele (arama, sayfalama, sıralama ile)
router.get('/', async (req, res) => {
    const {
        searchTerm,
        sortBy = 'name',    // Varsayılan sıralama alanı
        sortOrder = 'asc',  // Varsayılan sıralama yönü
        page = '1',
        limit = '5'
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'Geçersiz sayfa numarası.' });
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ error: 'Geçersiz limit değeri (1-100 arası olmalı).' });
    }

    try {
        const whereClause = {};

        if (searchTerm) {
            whereClause.OR = [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { address: { contains: searchTerm, mode: 'insensitive' } },
                { taxNumber: { contains: searchTerm, mode: 'insensitive' } },
                { contact: { contains: searchTerm, mode: 'insensitive' } }
            ];
        }

        const totalCompanies = await prisma.globalCompany.count({
            where: whereClause,
        });

        const companies = await prisma.globalCompany.findMany({
            where: whereClause,
            orderBy: {
                [sortBy]: sortOrder,
            },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        });

        res.status(200).json({
            companies,
            currentPage: pageNum,
            totalPages: Math.ceil(totalCompanies / limitNum),
            totalItems: totalCompanies
        });
    } catch (error) {
        console.error("Global firmalar listelenirken hata:", error);
        res.status(500).json({ error: 'Global firmalar listelenemedi.', details: error.message });
    }
});

// GET /api/global-companies/:id - Tek bir global firma detayını getir
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const company = await prisma.globalCompany.findUnique({
            where: { id: id },
        });
        if (!company) {
            return res.status(404).json({ error: 'Global firma bulunamadı.' });
        }
        res.status(200).json(company);
    } catch (error) {
        if (error.code === 'P2023' || error.message.includes("Malformed UUID")) {
            return res.status(400).json({ error: 'Geçersiz firma ID formatı.' });
        }
        console.error("Global firma detayı getirilirken hata:", error);
        res.status(500).json({ error: 'Global firma detayı getirilemedi.', details: error.message });
    }
});

// PUT /api/global-companies/:id - Bir global firmayı güncelle
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, taxNumber, contact } = req.body;

    // En az bir güncelleme alanı olmalı (bu kontrolü daha detaylı yapabilirsiniz)
    if (!name && !address && !taxNumber && !contact) {
        return res.status(400).json({ error: 'Güncellenecek en az bir alan gönderilmelidir (name, address, taxNumber, contact).' });
    }

    try {
        const companyToUpdate = await prisma.globalCompany.findUnique({ where: { id } });
        if (!companyToUpdate) {
             return res.status(404).json({ error: 'Güncellenecek global firma bulunamadı.' });
        }

        const updatedCompany = await prisma.globalCompany.update({
            where: { id: id },
            data: {
                name: name !== undefined ? name : companyToUpdate.name, // Sadece gönderilen alanları güncelle
                address: address !== undefined ? address : companyToUpdate.address,
                taxNumber: taxNumber !== undefined ? taxNumber : companyToUpdate.taxNumber,
                contact: contact !== undefined ? contact : companyToUpdate.contact,
            },
        });
        res.status(200).json(updatedCompany);
    } catch (error) {
        if (error.code === 'P2023' || error.message.includes("Malformed UUID")) {
            return res.status(400).json({ error: 'Geçersiz firma ID formatı.' });
        }
        if (error.code === 'P2002' && error.meta?.target?.includes('name')) { // Eğer yeni isim başkası tarafından kullanılıyorsa
            return res.status(400).json({ error: `Bu firma adı (${name}) zaten başka bir firma tarafından kullanılıyor.` });
        }
        if (error.code === 'P2025') { // Kayıt bulunamadı (update için)
             return res.status(404).json({ error: 'Güncellenecek global firma bulunamadı.' });
        }
        console.error("Global firma güncellenirken hata:", error);
        res.status(500).json({ error: 'Global firma güncellenemedi.', details: error.message });
    }
});

// DELETE /api/global-companies/:id - Bir global firmayı sil
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Firmanın herhangi bir operasyona katılımcı olup olmadığını kontrol et
        const participantCount = await prisma.operationParticipant.count({
            where: { globalCompanyId: id },
        });

        if (participantCount > 0) {
            return res.status(400).json({
                error: `Bu firma ${participantCount} operasyona kayıtlı. Silebilmek için önce tüm operasyonlardan çıkarılmalıdır.`,
            });
        }

        const deletedCompany = await prisma.globalCompany.delete({
            where: { id: id },
        });
        res.status(200).json({ message: `Global firma '${deletedCompany.name}' başarıyla silindi.` });
    } catch (error) {
        if (error.code === 'P2023' || error.message.includes("Malformed UUID")) {
            return res.status(400).json({ error: 'Geçersiz firma ID formatı.' });
        }
        if (error.code === 'P2025') { // Kayıt bulunamadı (delete için)
             return res.status(404).json({ error: 'Silinecek global firma bulunamadı.' });
        }
        console.error("Global firma silinirken hata:", error);
        res.status(500).json({ error: 'Global firma silinemedi.', details: error.message });
    }
});

module.exports = router;