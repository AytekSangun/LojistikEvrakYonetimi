// backend/routes/documentRoutes.js
const express = require('express');
// Router'ı mergeParams: true ile başlatıyoruz çünkü /api/participants/:participantId/documents gibi bir yoldan gelecek
const router = express.Router({ mergeParams: true });
const prisma = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/authMiddleware');

// Bu router'daki tüm endpoint'ler artık authMiddleware'den geçecek
router.use(authMiddleware);

// Slugify helper fonksiyonu
function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// Multer için disk depolama ayarları
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        // Artık companyId değil, participantId geliyor
        const { participantId } = req.params;
        if (!participantId) {
            return cb(new Error("Participant ID not found in request params for destination"));
        }

        try {
            // Participant'ı, bağlı olduğu operasyon ve global firma bilgileriyle çek
            const participant = await prisma.operationParticipant.findUnique({
                where: { id: participantId },
                include: {
                    operation: true,      // Operasyon bilgileri (operationNumber için)
                    globalCompany: true   // Global Firma bilgileri (name için)
                }
            });

            if (!participant || !participant.operation || !participant.globalCompany) {
                return cb(new Error("Participant, associated operation, or global company not found for destination."));
            }

            const operationNumberSlug = slugify(participant.operation.operationNumber);
            const companyNameSlug = slugify(participant.globalCompany.name); // Artık globalCompany.name
            const roleSlug = slugify(participant.role); // Rolü de ekleyebiliriz (isteğe bağlı)

            // Klasör yolu: uploads/OPERATION_NUMBER_SLUG/COMPANY_NAME_SLUG-ROLE_SLUG
            // Rolü eklemek, aynı firmanın farklı rollerde olduğu durumlarda karışıklığı önleyebilir.
            // Veya sadece COMPANY_NAME_SLUG yeterli olabilir. Şimdilik rolü de ekleyelim.
            const uploadPath = path.join(__dirname, '..', 'uploads', operationNumberSlug, `${companyNameSlug}-${roleSlug}`);

            if (!fs.existsSync(uploadPath)) {
                fs.mkdir(uploadPath, { recursive: true }, (err) => {
                    if (err) {
                        console.error("Error creating directory:", err);
                        return cb(err);
                    }
                    cb(null, uploadPath);
                });
            } else {
                cb(null, uploadPath);
            }

        } catch (error) {
            console.error("Error in multer destination setup:", error);
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const originalNameSlug = slugify(path.parse(file.originalname).name);
        const extension = path.extname(file.originalname);
        const uniqueFileName = `${uuidv4()}_${originalNameSlug}${extension}`;
        cb(null, uniqueFileName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg', 'image/png', 'image/gif'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Geçersiz dosya tipi.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 10 }, // 10 MB
    fileFilter: fileFilter
});

// POST /api/participants/:participantId/documents - Bir katılımcıya yeni evrak yükle
router.post('/', upload.single('evrak'), async (req, res) => {
    const { participantId } = req.params;

    if (!req.file) {
        return res.status(400).json({ error: 'Lütfen bir dosya seçin.' });
    }

    try {
        const participant = await prisma.operationParticipant.findUnique({
            where: { id: participantId },
            include: { operation: true, globalCompany: true } // Dosya yolu için gerekli
        });

        if (!participant || !participant.operation || !participant.globalCompany) {
            return res.status(404).json({ error: 'İlgili katılımcı, operasyon veya global firma bulunamadı.' });
        }

        const operationNumberSlug = slugify(participant.operation.operationNumber);
        const companyNameSlug = slugify(participant.globalCompany.name);
        const roleSlug = slugify(participant.role);

        // Veritabanına kaydedilecek dosya yolu
        const relativeFilePath = `uploads/${operationNumberSlug}/${companyNameSlug}-${roleSlug}/${req.file.filename}`;

        const newDocument = await prisma.document.create({
            data: {
                originalFileName: req.file.originalname,
                storedFileName: req.file.filename,
                filePath: relativeFilePath,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                participantId: participantId, // Artık participantId
            },
        });

        const fullPath = `${req.protocol}://${req.get('host')}/${relativeFilePath}`;
        res.status(201).json({ ...newDocument, fullPath });

    } catch (error) {
        console.error("Evrak yüklenirken hata:", error);
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Hata sonrası dosya silinemedi:", err);
            });
        }
        if (error.code === 'P2003' && error.meta?.field_name?.includes('participantId')) {
            return res.status(404).json({ error: 'İlgili katılımcı bulunamadı (foreign key constraint).' });
        }
        res.status(500).json({ error: 'Evrak yüklenemedi.', details: error.message });
    }
});

// GET /api/participants/:participantId/documents - Bir katılımcıya ait evrakları listele
router.get('/', async (req, res) => {
    const { participantId } = req.params;
    try {
        const participantExists = await prisma.operationParticipant.findUnique({
            where: { id: participantId },
            select: { id: true }
        });
        if (!participantExists) {
            return res.status(404).json({ error: "İlgili katılımcı bulunamadı." });
        }

        const documents = await prisma.document.findMany({
            where: { participantId: participantId }, // Artık participantId
            orderBy: { uploadedAt: 'desc' }
        });

        const documentsWithFullPath = documents.map(doc => ({
            ...doc,
            fullPath: `${req.protocol}://${req.get('host')}/${doc.filePath}`
        }));

        res.status(200).json(documentsWithFullPath);
    } catch (error) {
        console.error("Evraklar listelenirken hata:", error);
        res.status(500).json({ error: 'Evraklar listelenemedi.', details: error.message });
    }
});

module.exports = router;