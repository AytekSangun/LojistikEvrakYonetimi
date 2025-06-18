// backend/routes/operationRoutes.js
const express = require('express');
const router = express.Router();
console.log("operationRoutes.js dosyası yüklendi!");
const prisma = require('../db'); // Prisma Client'ı import ediyoruz
const fs = require('fs'); // Dosya sistemi işlemleri için
const path = require('path'); // Dosya yolları için
const authMiddleware = require('../middleware/authMiddleware');

// Bu router'daki tüm endpoint'ler artık authMiddleware'den geçecek
router.use(authMiddleware);

// Helper fonksiyon: Operasyon numarasını formatlamak için
// Bu fonksiyonu daha merkezi bir yere de taşıyabilirsiniz (örn: utils klasörü)
async function generateOperationNumber() {
    const currentYear = new Date().getFullYear();
    // Yıla ait son operasyonu bulup numarasını artıracağız
    // Veya daha basit bir unique ID üretebilirsiniz. Şimdilik basit tutalım.
    // Gerçek bir uygulamada daha karmaşık bir sıra numarası mantığı gerekebilir.
    // Örneğin: "OP-YYYY-NNNN" formatında, NNNN o yılki sıra numarası.
    // Basitlik adına şimdilik timestamp veya rastgele bir şey kullanabiliriz
    // veya sadece kullanıcıdan alabiliriz.
    // Şimdilik kullanıcıdan `operationNumber` almayı varsayalım ve benzersizliğini kontrol edelim.
    // Eğer otomatik üretmek isterseniz, buradaki mantığı geliştirmeniz gerekir.

    // Örnek: OP-2024-001 gibi bir format için:
    const lastOperation = await prisma.operation.findFirst({
        where: {
            operationNumber: {
                startsWith: `OP-${currentYear}-`
            }
        },
        orderBy: {
            operationNumber: 'desc'
        }
    });

    let nextNumber = 1;
    if (lastOperation) {
        const lastNumStr = lastOperation.operationNumber.split('-').pop();
        nextNumber = parseInt(lastNumStr, 10) + 1;
    }
    return `OP-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
}

// Slugify helper fonksiyonu (eğer bu dosyada yoksa, import edin veya tanımlayın)
function slugify(text) { // Bu fonksiyonu daha önce participantRoutes veya documentRoutes'da tanımlamıştık
    if (!text) return '';
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// DELETE /api/operations/:id - Bir operasyonu ve tüm bağlı verilerini sil
router.delete('/:id', async (req, res) => {
    console.log("DELETE /api/operations/:id route'una istek geldi. ID:", req.params.id); // << ROUTE'A GELİNİP GELİNMEDİĞİNİ GÖRMEK İÇİN
    const { id: operationId } = req.params;

    try {
        // 1. Operasyona bağlı tüm katılımcıları ve onların dokümanlarını bul
        const operationToDelete = await prisma.operation.findUnique({
            where: { id: operationId },
            include: {
                participants: {
                    include: {
                        documents: true,      // Her katılımcının dokümanlarını al
                        globalCompany: true,  // Klasör yolu için gerekebilir
                        operation: true       // Klasör yolu için gerekebilir
                    }
                }
            }
        });

        if (!operationToDelete) {
            return res.status(404).json({ error: 'Silinecek operasyon bulunamadı.' });
        }

        // 2. Tüm fiziksel doküman dosyalarını sil
        if (operationToDelete.participants) {
            for (const participant of operationToDelete.participants) {
                if (participant.documents) {
                    for (const doc of participant.documents) {
                        // doc.filePath zaten 'uploads/OP_NUM_SLUG/COMP_NAME-ROLE_SLUG/filename.ext' formatında olmalı
                        const physicalFilePath = path.join(__dirname, '..', doc.filePath);
                        if (fs.existsSync(physicalFilePath)) {
                            try {
                                fs.unlinkSync(physicalFilePath); // Senkron silme
                                console.log(`Fiziksel dosya silindi: ${physicalFilePath}`);
                            } catch (fileErr) {
                                console.error(`Operasyon silinirken bağlı dosya silinemedi (${physicalFilePath}):`, fileErr);
                                // Hata olsa bile devam et, en azından DB kayıtları silinsin
                            }
                        } else {
                            console.warn(`Operasyon silinirken silinecek bağlı fiziksel dosya bulunamadı: ${physicalFilePath}`);
                        }
                    }
                }
            }
        }

        // 3. Operasyonu veritabanından sil.
        // schema.prisma'da Operation -> OperationParticipant ilişkisinde onDelete: Cascade,
        // ve OperationParticipant -> Document ilişkisinde onDelete: Cascade tanımladığımız için,
        // operasyonu sildiğimizde Prisma otomatik olarak bağlı OperationParticipant ve Document
        // kayıtlarını da silecektir.
        // Bu yüzden manuel olarak participant.deleteMany veya document.deleteMany yapmamıza gerek yok.
        const deletedOperationDetails = await prisma.operation.delete({
            where: { id: operationId },
        });

        // 4. (İsteğe Bağlı) Operasyona ait ana klasörleri de sil (uploads/OPERATION_NUMBER_SLUG/...)
        // Bu adım daha karmaşık olabilir çünkü bir klasörün sadece bu operasyona mı ait olduğunu
        // yoksa başka bir nedenle mi var olduğunu bilmek zor olabilir.
        // Şimdilik sadece dokümanları siliyoruz, boş klasörler kalabilir.
        // Eğer operasyon bazlı ana klasörleri de silmek isterseniz (örn: uploads/OP-XYZ-789/),
        // bu klasörün içindeki tüm alt klasörleri (COMPANY_NAME-ROLE_SLUG) ve dosyaları sildikten sonra
        // ana klasörü de silebilirsiniz. fs.rmdir(path, { recursive: true }) veya fs.rm(path, { recursive: true, force: true }) kullanılabilir.
        // Ancak dikkatli olunmalı, yanlışlıkla başka dosyaların olduğu bir üst klasörü silmeyin.

        // Örnek: Operasyonun ana klasörünü (eğer varsa ve slugify edilmiş operationNumber üzerinden gidiyorsak) silme
        const operationNumberSlug = slugify(operationToDelete.operationNumber); // Silinen operasyonun numarasını kullan
        const operationBaseFolderPath = path.join(__dirname, '..', 'uploads', operationNumberSlug);

        if (fs.existsSync(operationBaseFolderPath)) {
            // Klasörün içindeki tüm katılımcı klasörlerinin de boş olduğunu varsayarak veya
            // katılımcı klasörlerini de tek tek silerek bu işlem yapılabilir.
            // En güvenlisi, katılımcı klasörlerini (örn: COMPANY_NAME-ROLE_SLUG) de silmek.
            if (operationToDelete.participants) {
                for (const participant of operationToDelete.participants) {
                    if (participant.globalCompany && participant.operation) { // operation burada operationToDelete ile aynı olmalı
                        const companyNameSlug = slugify(participant.globalCompany.name);
                        const roleSlug = slugify(participant.role);
                        const participantFolderPath = path.join(operationBaseFolderPath, `${companyNameSlug}-${roleSlug}`);
                        if (fs.existsSync(participantFolderPath)) {
                            try {
                                fs.rmSync(participantFolderPath, { recursive: true, force: true }); // Node 14.14+
                                console.log(`Katılımcı klasörü silindi: ${participantFolderPath}`);
                            } catch (folderErr) {
                                console.error(`Katılımcı klasörü silinemedi (${participantFolderPath}):`, folderErr);
                            }
                        }
                    }
                }
            }

            // Katılımcı klasörleri silindikten sonra, operasyon ana klasörü boşsa silinebilir.
            // Ya da direkt recursive silme ile (içindekilerle birlikte)
            try {
                // Eğer yukarıda katılımcı klasörleri silindiyse ve ana klasörün de silinmesini istiyorsak
                // ve başka bir şey içermediğinden eminsek:
                const filesInOperationFolder = fs.readdirSync(operationBaseFolderPath);
                if (filesInOperationFolder.length === 0) { // Sadece boşsa sil
                    fs.rmdirSync(operationBaseFolderPath);
                    console.log(`Operasyon ana klasörü (boş olduğu için) silindi: ${operationBaseFolderPath}`);
                } else {
                     // Eğer hala dosya/klasör varsa ve yine de silmek istiyorsak (dikkatli olun!)
                    // fs.rmSync(operationBaseFolderPath, { recursive: true, force: true });
                    // console.log(`Operasyon ana klasörü (içindekilerle) silindi: ${operationBaseFolderPath}`);
                    console.warn(`Operasyon ana klasörü (${operationBaseFolderPath}) içindekiler nedeniyle silinmedi. İçerik: ${filesInOperationFolder.join(', ')}`);
                }
            } catch (baseFolderErr) {
                console.error(`Operasyon ana klasörü silinirken hata (${operationBaseFolderPath}):`, baseFolderErr);
            }
        }


        res.status(200).json({ message: `Operasyon '${operationToDelete.name}' ve tüm bağlı verileri başarıyla silindi.` });

    } catch (error) {
        if (error.code === 'P2023' || (error.message && error.message.includes("Malformed UUID"))) {
            return res.status(400).json({ error: 'Geçersiz operasyon ID formatı.' });
        }
        if (error.code === 'P2025') { // Kayıt bulunamadı (delete için)
             // Bu hata artık operationToDelete kontrolü ile en başta yakalanıyor.
             return res.status(404).json({ error: 'Silinecek operasyon bulunamadı (DB). P2025' });
        }
        console.error("Operasyon silinirken hata:", error);
        res.status(500).json({ error: 'Operasyon silinemedi.', details: error.message });
    }
});

// GET /api/operations - Tüm operasyonları listele (arama ve filtreleme ile)
router.get('/', async (req, res) => {
    const {
        searchTerm,
        typeFilter,
        sortBy = 'createdAt', // Varsayılan değerler
        sortOrder = 'desc',   // Varsayılan değerler
        page = '1',           // String olarak gelir, parse edilmeli
        limit = '5'           // String olarak gelir, parse edilmeli
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Geçerli sayfa ve limit değerleri olduğundan emin ol
    if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'Geçersiz sayfa numarası.' });
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) { // Max limit de eklenebilir
        return res.status(400).json({ error: 'Geçersiz limit değeri (1-100 arası olmalı).' });
    }


    try {
        const whereClause = {};
        if (searchTerm) {
            whereClause.OR = [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { operationNumber: { contains: searchTerm, mode: 'insensitive' } }
            ];
        }
        if (typeFilter && (typeFilter === 'ithalat' || typeFilter === 'ihracat')) {
            whereClause.type = typeFilter;
        }

        const totalOperations = await prisma.operation.count({
            where: whereClause,
        });

        const operations = await prisma.operation.findMany({
            where: whereClause,
            orderBy: {
                [sortBy]: sortOrder,
            },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        });

        res.status(200).json({
            operations,
            currentPage: pageNum,
            totalPages: Math.ceil(totalOperations / limitNum),
            totalItems: totalOperations // İsteğe bağlı, toplam öğe sayısı
        });
    } catch (error) {
        console.error("Operasyonlar listelenirken hata:", error);
        res.status(500).json({ error: 'Operasyonlar listelenemedi.', details: error.message });
    }
});

// POST /api/operations - Yeni bir operasyon oluştur
router.post('/', async (req, res) => {
    let { name, type, operationNumberInput } = req.body; // operationNumberInput kullanıcıdan gelen numara
    
    // Gelen verileri trim et
    if (name) name = name.trim();
    if (operationNumberInput) operationNumberInput = operationNumberInput.trim();
    // type için trim genellikle gerekmez ama istenirse eklenebilir.

    if (!name || !type || !operationNumberInput) {
        return res.status(400).json({ error: 'İsim (name), tip (type) ve operasyon numarası (operationNumberInput) alanları zorunludur.' });
    }

    if (type !== 'ithalat' && type !== 'ihracat') {
        return res.status(400).json({ error: 'Tip (type) alanı "ithalat" veya "ihracat" olmalıdır.' });
    }

    try {
        // Gelen operasyon numarasının benzersiz olup olmadığını kontrol et
        const existingOperation = await prisma.operation.findUnique({
            where: { operationNumber: operationNumberInput }
        });

        if (existingOperation) {
            return res.status(400).json({ error: `Bu operasyon numarası (${operationNumberInput}) zaten kullanılıyor.` });
        }

        // Eğer otomatik numara üretmek isterseniz:
        // const operationNumber = await generateOperationNumber();
        // Ve `operationNumberInput` yerine `operationNumber` kullanın.
        // Şimdilik kullanıcıdan gelen `operationNumberInput`'ı kullanıyoruz.

        const newOperation = await prisma.operation.create({
            data: {
                name,
                type,
                operationNumber: operationNumberInput, // Kullanıcıdan gelen numara
            },
        });
        res.status(201).json(newOperation);
    } catch (error) {
        console.error("Operasyon oluşturulurken hata:", error);
        // Prisma'nın unique constraint hatası gibi özel hatalarını yakalayabilirsiniz
        if (error.code === 'P2002' && error.meta?.target?.includes('operationNumber')) {
             return res.status(400).json({ error: `Bu operasyon numarası (${operationNumberInput}) zaten kullanılıyor (DB constraint).` });
        }
        res.status(500).json({ error: 'Operasyon oluşturulamadı.', details: error.message });
    }
});

// GET /api/operations/:id - Belirli bir operasyonun tüm detaylarını getir
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const operation = await prisma.operation.findUnique({
            where: { id: id },
            include: {
                participants: { // Operasyona bağlı katılımcıları (OperationParticipant) getir
                    orderBy: {
                        // Katılımcıları önce role (örn: tedarikçi, alıcı, müşteri sırasıyla)
                        // sonra firma adına göre sıralayabiliriz.
                        // Bu, frontend'de gösterimi kolaylaştırabilir.
                        // Şimdilik sadece role göre sıralayalım, isteğe bağlı olarak geliştirilebilir.
                        role: 'asc', // veya createdAt
                    },
                    include: {
                        globalCompany: true, // Her katılımcının bağlı olduğu GlobalCompany bilgilerini getir
                        documents: {         // Her katılımcıya bağlı dokümanları getir
                            orderBy: {
                                uploadedAt: 'desc' // Dokümanları yüklenme tarihine göre sırala
                            }
                        }
                    }
                }
            }
        });

        if (!operation) {
            return res.status(404).json({ error: 'Operasyon bulunamadı.' });
        }

        // Dokümanlara fullPath ekleyelim
        if (operation.participants) {
            operation.participants = operation.participants.map(participant => {
                if (participant.documents) {
                    participant.documents = participant.documents.map(doc => {
                        return {
                            ...doc,
                            fullPath: `${req.protocol}://${req.get('host')}/${doc.filePath}`
                        };
                    });
                }
                return participant;
            });
        }



        res.status(200).json(operation);
    } catch (error) {
        if (error.code === 'P2023' || (error.message && error.message.includes("Malformed UUID"))) {
            return res.status(400).json({ error: 'Geçersiz operasyon ID formatı.' });
        }
        console.error("Operasyon detayı getirilirken hata:", error);
        res.status(500).json({ error: 'Operasyon detayı getirilemedi.', details: error.message });
    }
});

// PUT /api/operations/:id - Bir operasyonun adını ve/veya tipini güncelle
router.put('/:id', async (req, res) => {
    const { id: operationId } = req.params;
    const { name, type } = req.body; // Sadece name ve type alıyoruz

    // Güncellenecek en az bir alan gönderilmeli
    if (name === undefined && type === undefined) {
        return res.status(400).json({ error: 'Güncellenecek en az bir alan gönderilmelidir (name, type).' });
    }

    // Tip kontrolü (eğer gönderildiyse)
    if (type !== undefined && type !== 'ithalat' && type !== 'ihracat') {
        return res.status(400).json({ error: 'Tip (type) alanı "ithalat" veya "ihracat" olmalıdır veya gönderilmemelidir.' });
    }

    try {
        // Güncellenecek operasyonu bul (var olup olmadığını kontrol etmek için)
        const operationToUpdate = await prisma.operation.findUnique({
            where: { id: operationId },
        });

        if (!operationToUpdate) {
            return res.status(404).json({ error: 'Güncellenecek operasyon bulunamadı.' });
        }

        // Veri objesini sadece gönderilen alanlarla oluştur
        const dataToUpdate = {};
        if (name !== undefined) dataToUpdate.name = name;
        if (type !== undefined) dataToUpdate.type = type;

        // operationNumber artık güncellenmiyor, bu yüzden dosya/klasör taşıma işlemleri yok.

        const updatedOperation = await prisma.operation.update({
            where: { id: operationId },
            data: dataToUpdate,
        });

        res.status(200).json(updatedOperation);
    } catch (error) {
        if (error.code === 'P2023' || (error.message && error.message.includes("Malformed UUID"))) {
            return res.status(400).json({ error: 'Geçersiz operasyon ID formatı.' });
        }
        if (error.code === 'P2025') { // Kayıt bulunamadı (update için)
             return res.status(404).json({ error: 'Güncellenecek operasyon bulunamadı.' });
        }
        // operationNumber unique constraint hatası artık bu endpoint için geçerli değil
        console.error("Operasyon güncellenirken hata:", error);
        res.status(500).json({ error: 'Operasyon güncellenemedi.', details: error.message });
    }
});

module.exports = router;