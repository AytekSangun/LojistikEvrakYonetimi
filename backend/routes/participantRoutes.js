// backend/routes/participantRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // operationId'yi req.params'tan alabilmek için
const prisma = require('../db');
const fs = require('fs'); // Dosya silme işlemleri için
const path = require('path'); // Dosya yolları için
const authMiddleware = require('../middleware/authMiddleware');

// Bu router'daki tüm endpoint'ler artık authMiddleware'den geçecek
router.use(authMiddleware);

// Helper fonksiyon (daha önce documentRoutes'da vardı, buraya da taşıyabiliriz veya ortak bir utils'e)
function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// POST /api/operations/:operationId/participants - Bir operasyona katılımcı ekle
router.post('/', async (req, res) => {
    const { operationId } = req.params;
    const { globalCompanyId, role } = req.body;

    if (!globalCompanyId || !role) {
        return res.status(400).json({ error: 'Global Firma ID (globalCompanyId) ve Rol (role) zorunludur.' });
    }

    const validRoles = ['tedarikci', 'alici', 'musteri'];
    if (!validRoles.includes(role.toLowerCase())) {
        return res.status(400).json({ error: `Rol (role) alanı "${validRoles.join('", "')}" değerlerinden biri olmalıdır.` });
    }

    try {
        // Operasyonun ve global firmanın varlığını kontrol et
        const operation = await prisma.operation.findUnique({ where: { id: operationId } });
        if (!operation) {
            return res.status(404).json({ error: 'Operasyon bulunamadı.' });
        }

        const globalCompany = await prisma.globalCompany.findUnique({ where: { id: globalCompanyId } });
        if (!globalCompany) {
            return res.status(404).json({ error: 'Global firma bulunamadı.' });
        }

        const newParticipant = await prisma.operationParticipant.create({
            data: {
                operationId,
                globalCompanyId,
                role: role.toLowerCase(),
            },
            include: { // Yanıtta global firma bilgilerini de gönder
                globalCompany: true,
            },
        });
        res.status(201).json(newParticipant);
    } catch (error) {
        if (error.code === 'P2002') { // Unique constraint ihlali (operationId, globalCompanyId, role)
            return res.status(400).json({ error: 'Bu firma bu operasyonda belirtilen rolle zaten mevcut.' });
        }
        if (error.code === 'P2003') { // Foreign key constraint (örn: operationId veya globalCompanyId bulunamadı)
            if (error.meta?.field_name?.includes('operationId')) {
                return res.status(404).json({ error: 'İlgili operasyon bulunamadı.' });
            }
            if (error.meta?.field_name?.includes('globalCompanyId')) {
                return res.status(404).json({ error: 'İlgili global firma bulunamadı.' });
            }
        }
        console.error("Katılımcı eklenirken hata:", error);
        res.status(500).json({ error: 'Katılımcı eklenemedi.', details: error.message });
    }
});

// GET /api/operations/:operationId/participants - Bir operasyondaki tüm katılımcıları listele
router.get('/', async (req, res) => {
    const { operationId } = req.params;
    try {
        const operation = await prisma.operation.findUnique({ where: { id: operationId } });
        if (!operation) {
            return res.status(404).json({ error: 'Operasyon bulunamadı.' });
        }

        const participants = await prisma.operationParticipant.findMany({
            where: { operationId: operationId },
            include: {
                globalCompany: true, // Her katılımcının global firma bilgilerini getir
                _count: { select: { documents: true } } // Her katılımcının kaç dokümanı olduğunu say
            },
            orderBy: {
                globalCompany: { name: 'asc' } // Katılımcıları firma adına göre sırala
            }
        });
        res.status(200).json(participants);
    } catch (error) {
        console.error(`Operasyon (${operationId}) katılımcıları listelenirken hata:`, error);
        res.status(500).json({ error: 'Katılımcılar listelenemedi.', details: error.message });
    }
});

// DELETE /api/operations/:operationId/participants/:participantId - Bir katılımcıyı operasyondan çıkar
router.delete('/:participantId', async (req, res) => {
    const { operationId, participantId } = req.params; // operationId'yi de alıyoruz, gerekirse yetkilendirme için

    try {
        // Katılımcının varlığını ve doğru operasyona ait olduğunu kontrol et (isteğe bağlı ama iyi bir pratik)
        const participant = await prisma.operationParticipant.findUnique({
            where: { id: participantId },
            include: {
                documents: true, // Silinecek dokümanları al
                operation: true, // Operasyon bilgilerini al (slugify için)
                globalCompany: true // Firma bilgilerini al (slugify için)
            }
        });

        if (!participant) {
            return res.status(404).json({ error: 'Katılımcı bulunamadı.' });
        }
        if (participant.operationId !== operationId) {
            return res.status(403).json({ error: 'Bu katılımcı belirtilen operasyona ait değil.' });
        }

        // 1. Katılımcıya ait tüm dokümanların fiziksel dosyalarını sil
        if (participant.documents && participant.documents.length > 0) {
            // Klasör yolu: uploads/OPERATION_NUMBER_SLUG/COMPANY_NAME_SLUG
            // Bu bilgileri participant üzerinden almamız lazım.
            // Eğer filePath tam yolu içeriyorsa direkt onu kullanırız,
            // değilse operation.operationNumber ve globalCompany.name'den oluştururuz.
            // schema.prisma'daki filePath: "uploads/op_id/comp_id/uuid_fatura.pdf" şeklindeydi.
            // Bu yolu silme işlemi için de kullanacağız.

            for (const doc of participant.documents) {
                // filePath'in tam yol olduğunu varsayıyoruz (örn: 'uploads/op_num/comp_name_slug/file.pdf')
                // Eğer değilse, burada operation ve globalCompany bilgilerinden oluşturmanız gerekir.
                // Şimdilik schema'daki filePath tanımına güveniyoruz.
                const physicalFilePath = path.join(__dirname, '..', doc.filePath);
                if (fs.existsSync(physicalFilePath)) {
                    try {
                        fs.unlinkSync(physicalFilePath);
                    } catch (fileErr) {
                        console.error(`Katılımcı silinirken bağlı dosya silinemedi (${physicalFilePath}):`, fileErr);
                    }
                } else {
                    console.warn(`Katılımcı silinirken silinecek bağlı dosya bulunamadı: ${physicalFilePath}`);
                }
            }
        }

        // 2. Katılımcıyı ve ona bağlı dokümanları (DB'den) sil
        // schema.prisma'da OperationParticipant -> Document ilişkisinde onDelete: Cascade olduğu için
        // participant silindiğinde dokümanları da otomatik silinecektir.
        // Bu yüzden ayrıca document.deleteMany yapmaya gerek yok.
        const deletedParticipant = await prisma.operationParticipant.delete({
            where: { id: participantId },
            include: { globalCompany: true } // Silinen katılımcının firma adını mesajda kullanmak için
        });

        res.status(200).json({
            message: `Katılımcı '${deletedParticipant.globalCompany.name}' (${deletedParticipant.role} rolünde) operasyondan ve bağlı tüm evrakları başarıyla çıkarıldı.`
        });

    } catch (error) {
        if (error.code === 'P2025') { // Kayıt bulunamadı
            return res.status(404).json({ error: 'Silinecek katılımcı bulunamadı.' });
        }
        console.error("Katılımcı silinirken hata:", error);
        res.status(500).json({ error: 'Katılımcı silinemedi.', details: error.message });
    }
});

module.exports = router;